/**
 * Module-aware QA review (generalizes the exam review to other modules).
 * Same shape as examReview: an INDEPENDENT review call, then a fixer call when
 * 치명/중대 defects are found. Reuses the severity parsing + gating from
 * examReview so behaviour is identical across modules.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "../anthropic.js";
import { MODELS } from "../routing.js";
import { config } from "../config.js";
import {
  REVIEW_CAPSTONE_PROMPT,
  parseReviewSeverity,
  needsFix,
  type SeverityCounts,
  type Usage,
  type ReviewAndFixResult,
} from "./examReview.js";

// Per-module review system prompts (mirror docs/prompt-backlog.md A3–A6).
const VOCAB_REVIEW = [
  "You are a bilingual lexicographer reviewing a generated 단어장 (American English) before publishing. For EACH entry:",
  "1. IPA: American/rhotic and correct for the headword (ɚ/ɝ not ə(r); oʊ not əʊ; no British forms).",
  "2. Spelling: American (color/analyze/vapor), never British.",
  "3. 품사 & 뜻: part of speech correct; the Korean gloss fits the unit/context, concise.",
  "4. Example: natural, grammatical, exactly one per word; context makes the meaning clear; the Korean translation matches.",
  "List only entries with issues, ranked by severity (치명/중대/경미), each defect on its own line tagged like '- [중대] …'. Output: 단어 | 문제 유형 | 원문 | 수정안. Respond in Korean; keep English in English.",
].join("\n");

const PPT_REVIEW = [
  "You are reviewing a generated slide-deck outline before it is rendered. Report fixes in Korean, each defect on its own line tagged by severity (치명/중대/경미), e.g. '- [중대] …'.",
  "1. Overflow: title > ~22 KR chars; any slide with > 5 bullets; any bullet > ~35 KR chars or holding two ideas. Give a tighter rewrite.",
  "2. Structure: a title slide AND a closing summary/Q&A slide? Each content slide makes ONE point advancing a clear arc? Flag repeats/wandering.",
  "3. Speaker notes: present on every content slide and adding delivery value (not restating bullets)?",
  "4. Parallelism: bullets within a slide grammatically parallel and comparable in length?",
  "Output: 슬라이드 | 문제 유형 | 원문 | 수정안. End with a one-line verdict.",
].join("\n");

const EXCEL_REVIEW = [
  "You are an adversarial spreadsheet reviewer. Do NOT assume a formula is right because it looks plausible. For EACH formula:",
  "1. Invent a small concrete sample (3–4 rows) and COMPUTE the result by hand; state whether it matches the stated goal.",
  "2. Validate it in the SPECIFIED tool (Excel vs Google Sheets): function exists, argument order, argument separator for the locale.",
  "3. Check references ($ absolute/relative, ranges, off-by-one), error cases (empty/zero/text), assumed array/spill behavior.",
  "4. Verdict per formula: 정확(O) / 틀림(X) / 취약(△). Tag X as 치명/중대 and △ as 경미, each on its own line like '- [치명] …', with a corrected formula.",
  "Output a table, then a summary. Respond in Korean.",
].join("\n");

const STUDY_REVIEW = [
  "You are reviewing generated study material (학습지/퀴즈 등) before delivery. Respond in Korean; tag each defect on its own line by severity (치명/중대/경미), e.g. '- [치명] …'.",
  "1. Correctness & self-containment: every item is answerable from what is printed; each answer key entry is right and uniquely defensible (no double/no-answer).",
  "2. Clarity: each 발문 has a clear instruction; difficulty is consistent with the stated level.",
  "3. Format/format: numbering and the 정답·해설 section are consistent and complete.",
  "List defects with the minimal fix for each. Output: 문항 | 문제 유형 | 수정안.",
].join("\n");

const GENERIC_REVIEW = [
  "You are an independent reviewer auditing a generated document before delivery. Respond in Korean.",
  "Find correctness errors, internal inconsistencies, missing/!incomplete sections, and clarity problems.",
  "Rank each defect by severity (치명/중대/경미) on its own line, e.g. '- [중대] …', and give the minimal fix. Do not flatter the document.",
].join("\n");

export const MODULE_REVIEW_PROMPTS: Record<string, string> = {
  exam: REVIEW_CAPSTONE_PROMPT,
  vocabulary: VOCAB_REVIEW,
  ppt: PPT_REVIEW,
  excel: EXCEL_REVIEW,
  worksheet: STUDY_REVIEW,
  quiz: STUDY_REVIEW,
};

/** Modules that expose a review action. */
export const REVIEWABLE = new Set(Object.keys(MODULE_REVIEW_PROMPTS));

export function reviewPromptFor(moduleId: string): string {
  return MODULE_REVIEW_PROMPTS[moduleId] || GENERIC_REVIEW;
}

const FIXER_PROMPT = [
  "You are correcting a generated document using a defect list from an independent reviewer.",
  "Apply ONLY the 치명 and 중대 fixes (leave 경미 unless trivial). Preserve the document's structure, headings, and Markdown format EXACTLY — change only what the defects require.",
  "Return ONLY the corrected full Markdown — no preamble, no commentary, no code fences.",
].join("\n");

function textOf(resp: Anthropic.Message): string {
  return resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}
function usageOf(resp: Anthropic.Message): Usage {
  return { inputTokens: resp.usage.input_tokens, outputTokens: resp.usage.output_tokens };
}

async function callReview(moduleId: string, markdown: string): Promise<{ reviewText: string; usage: Usage }> {
  const resp = await anthropic.messages.create({
    model: MODELS.heavy,
    max_tokens: 8000,
    temperature: 0.3,
    system: reviewPromptFor(moduleId),
    messages: [{ role: "user", content: `검토 대상:\n\n${markdown}` }],
  });
  return { reviewText: textOf(resp), usage: usageOf(resp) };
}

async function callFix(
  _moduleId: string,
  markdown: string,
  reviewText: string,
): Promise<{ fixedMarkdown: string; usage: Usage }> {
  const resp = await anthropic.messages.create({
    model: MODELS.heavy,
    max_tokens: Math.min(16000, config.maxOutputTokens),
    temperature: 0.4,
    system: FIXER_PROMPT,
    messages: [{ role: "user", content: `[ARTIFACT]\n${markdown}\n\n[DEFECTS]\n${reviewText}` }],
  });
  return { fixedMarkdown: textOf(resp), usage: usageOf(resp) };
}

export interface ReviewDeps {
  review: (moduleId: string, markdown: string) => Promise<{ reviewText: string; usage: Usage }>;
  fix: (moduleId: string, markdown: string, reviewText: string) => Promise<{ fixedMarkdown: string; usage: Usage }>;
}

/** Review one artifact, then fix it if 치명/중대 defects are found. */
export async function reviewArtifact(
  moduleId: string,
  markdown: string,
  deps: ReviewDeps = { review: callReview, fix: callFix },
): Promise<ReviewAndFixResult> {
  const { reviewText, usage: reviewUsage } = await deps.review(moduleId, markdown);
  const severity: SeverityCounts = parseReviewSeverity(reviewText);

  let changed = false;
  let fixedMarkdown: string | null = null;
  let usage: Usage = { ...reviewUsage };

  if (needsFix(severity)) {
    const { fixedMarkdown: fixed, usage: fixUsage } = await deps.fix(moduleId, markdown, reviewText);
    usage = {
      inputTokens: usage.inputTokens + fixUsage.inputTokens,
      outputTokens: usage.outputTokens + fixUsage.outputTokens,
    };
    if (fixed && fixed.trim() && fixed.trim() !== markdown.trim()) {
      fixedMarkdown = fixed;
      changed = true;
    }
  }

  return { reviewText, severity, changed, fixedMarkdown, usage };
}
