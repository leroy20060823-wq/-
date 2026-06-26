/**
 * Exam QA pipeline: an INDEPENDENT adversarial review of a generated exam, then
 * (only if 치명/중대 defects are found) a fixer pass that returns corrected
 * Markdown. Generation and review are separate model calls on purpose — the
 * author never grades itself in the same turn.
 *
 * Prompts mirror scripts/exam-review-protocol.md (#9 capstone + fixer).
 */
import type Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "../anthropic.js";
import { MODELS } from "../routing.js";
import { config } from "../config.js";

// #9 — four-stage adversarial verification (the capstone, used as the single QA pass).
export const REVIEW_CAPSTONE_PROMPT = [
  "Run a four-stage adversarial verification of this entire exam. Move through every stage explicitly; do not skip self-doubt.",
  "",
  "Stage 1 — 검토: Solve every item from scratch as a top student would, recording your answer and your reasoning from the passage/rule.",
  "Stage 2 — 자기 의심: For every item where you matched the key, actively try to prove yourself wrong — find a reading under which a different option is correct. For every mismatch, assume YOU are wrong first and re-derive.",
  "Stage 3 — 반박: Play a 1등급 student who paid for this exam and is furious about any defect. Write that student's strongest objections to every weak item.",
  "Stage 4 — 재검토: Resolve each objection — defend the item with evidence, or concede it's defective and give a surgical fix.",
  "",
  "Deliver: (1) every item where your independent answer differs from the printed key, with resolution; (2) a defect list ranked by severity (치명/중대/경미); (3) the minimal fix for each. Cite the passage or textbook rule for every judgment. Respond in Korean. Do not flatter the exam — your job is to find what's broken.",
  "",
  "Format the defect list so each defect is on its OWN line tagged with its severity, e.g. '- [치명] 3번 …' / '- [중대] 7번 …' / '- [경미] 12번 …'. If there are no defects of a given severity, omit it.",
].join("\n");

// Fixer — applies ONLY 치명/중대 fixes and returns the corrected full Markdown.
export const FIXER_PROMPT = [
  "You are correcting an exam. The user message has the exam Markdown followed by a defect list from independent reviewers.",
  "Apply ONLY the 치명 and 중대 fixes (leave 경미 unless trivial). Preserve the output contract EXACTLY: the '## 배점표' table header (파트 | 파트명 | 유형 | 문항 범위 | 문항 수 | 문항당 배점 | 파트 총점), parts headed '## P1.' …, items '**N. <type> [N점]**' with FIVE options 'A) '…'E) ' (서술형: '✏️ ____'), '## 정답표', and '## 정밀 해설지' cards.",
  "Keep the 배점표 total at 100 and keep counts/numbering consistent across 배점표 · items · 정답표.",
  "Return ONLY the corrected full exam Markdown — no preamble, no commentary, no code fences.",
].join("\n");

export interface SeverityCounts {
  critical: number;
  major: number;
  minor: number;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export interface ReviewAndFixResult {
  reviewText: string;
  severity: SeverityCounts;
  /** true when the fixer produced corrected Markdown that differs from the input. */
  changed: boolean;
  fixedMarkdown: string | null;
  usage: Usage;
}

/**
 * Count severity-tagged defects from the (free-form Korean) review text.
 * Robust to prose: '치명적' / '중대한' / '경미한' (token + Korean syllable) are NOT
 * counted, and a legend line listing all three together is ignored. Approximate
 * for display; the gating decision (needsFix) only needs presence.
 */
export function parseReviewSeverity(text: string): SeverityCounts {
  const counts: SeverityCounts = { critical: 0, major: 0, minor: 0 };
  for (const raw of (text ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const c = (line.match(/치명(?![가-힣])/g) || []).length;
    const j = (line.match(/중대(?![가-힣])/g) || []).length;
    const m = (line.match(/경미(?![가-힣])/g) || []).length;
    // Legend/scale line listing all three — not a defect.
    if (c > 0 && j > 0 && m > 0) continue;
    counts.critical += c;
    counts.major += j;
    counts.minor += m;
  }
  return counts;
}

/** A fix is warranted only for 치명 (critical) or 중대 (major) defects. */
export function needsFix(s: SeverityCounts): boolean {
  return s.critical > 0 || s.major > 0;
}

function textOf(resp: Anthropic.Message): string {
  return resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}
function usageOf(resp: Anthropic.Message): Usage {
  return { inputTokens: resp.usage.input_tokens, outputTokens: resp.usage.output_tokens };
}

/** Independent review pass (heavy tier, low temperature). */
export async function reviewExam(markdown: string): Promise<{ reviewText: string; usage: Usage }> {
  const resp = await anthropic.messages.create({
    model: MODELS.heavy,
    max_tokens: 8000,
    temperature: 0.3,
    system: REVIEW_CAPSTONE_PROMPT,
    messages: [{ role: "user", content: `검토 대상 시험지:\n\n${markdown}` }],
  });
  return { reviewText: textOf(resp), usage: usageOf(resp) };
}

/** Fixer pass — returns corrected full Markdown. */
export async function fixExam(markdown: string, reviewText: string): Promise<{ fixedMarkdown: string; usage: Usage }> {
  const resp = await anthropic.messages.create({
    model: MODELS.heavy,
    max_tokens: Math.min(16000, config.maxOutputTokens),
    temperature: 0.4,
    system: FIXER_PROMPT,
    messages: [{ role: "user", content: `[EXAM]\n${markdown}\n\n[DEFECTS]\n${reviewText}` }],
  });
  return { fixedMarkdown: textOf(resp), usage: usageOf(resp) };
}

/**
 * Orchestrate review → (conditional) fix. `deps` is injectable so the gating
 * logic can be unit-tested without hitting the API.
 */
export async function reviewAndFix(
  markdown: string,
  deps: { reviewExam: typeof reviewExam; fixExam: typeof fixExam } = { reviewExam, fixExam },
): Promise<ReviewAndFixResult> {
  const { reviewText, usage: reviewUsage } = await deps.reviewExam(markdown);
  const severity = parseReviewSeverity(reviewText);

  let changed = false;
  let fixedMarkdown: string | null = null;
  let usage: Usage = { ...reviewUsage };

  if (needsFix(severity)) {
    const { fixedMarkdown: fixed, usage: fixUsage } = await deps.fixExam(markdown, reviewText);
    usage = {
      inputTokens: usage.inputTokens + fixUsage.inputTokens,
      outputTokens: usage.outputTokens + fixUsage.outputTokens,
    };
    // Only treat it as a change if the fixer returned non-empty, different content.
    if (fixed && fixed.trim() && fixed.trim() !== markdown.trim()) {
      fixedMarkdown = fixed;
      changed = true;
    }
  }

  return { reviewText, severity, changed, fixedMarkdown, usage };
}
