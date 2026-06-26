/**
 * Mechanical Korean-text linter for 발문·해설 (review prompt #8, the cheap part).
 * Catches recurring issues a regex can decide; the judgement calls (naturalness,
 * explanation completeness) are left to the LLM review pass. Pure + testable.
 */

export type LintSeverity = "중대" | "경미";
export interface LintIssue {
  type: string;
  severity: LintSeverity;
  message: string;
  sample?: string;
}

// Instruction verbs that make a 발문 a clear directive (Korean), plus a trailing
// "?" which is a valid English/Korean question stem.
const INSTRUCTION_VERBS =
  /(고르|골라|쓰시|쓰세|쓰라|서술|논술|구하|배열|나열|완성|설명|찾|연결|작성|답하|고치|바꾸|밑줄|짝지|분류)/;

function endingOf(line: string): string | null {
  // The two characters just before a sentence-final period (해설 어미 반복 감지용).
  const m = line.match(/([가-힣]{2})[.!?]\s*$/);
  return m ? (m[1] ?? null) : null;
}

/** Lint a generated exam/worksheet Markdown. Returns the list of issues found. */
export function lintKorean(markdown: string): LintIssue[] {
  const issues: LintIssue[] = [];
  const text = typeof markdown === "string" ? markdown : "";
  const lines = text.split(/\r?\n/);

  // 1) Terminology consistency — don't mix near-synonyms within one paper.
  const pairs: [RegExp, RegExp, string, string][] = [
    [/지문/, /본문/, "지문", "본문"],
    [/선지/, /보기/, "선지", "보기"],
  ];
  for (const [a, b, an, bn] of pairs) {
    if (a.test(text) && b.test(text)) {
      issues.push({
        type: "용어 혼용",
        severity: "경미",
        message: `'${an}'와 '${bn}'를 한 문서에서 혼용했어요. 하나로 통일하세요.`,
      });
    }
  }

  // 2) 해설 어미 반복 — within the 정밀 해설지 section.
  const exIdx = lines.findIndex((l) => /^#{1,3}\s*.*(정밀\s*해설|해설지|Detailed Explanations)/i.test(l));
  if (exIdx >= 0) {
    const counts = new Map<string, number>();
    let counted = 0;
    for (let i = exIdx + 1; i < lines.length; i++) {
      const l = (lines[i] ?? "").trim();
      if (!l || /^#{1,3}\s/.test(l) || /^(핵심|오답)/.test(l) || l.includes("|")) continue;
      const e = endingOf(l);
      if (!e) continue;
      counts.set(e, (counts.get(e) ?? 0) + 1);
      counted++;
    }
    let top = "";
    let topN = 0;
    for (const [e, n] of counts) if (n > topN) ((topN = n), (top = e));
    if (counted >= 4 && topN >= 3 && topN / counted >= 0.5) {
      issues.push({
        type: "어미 반복",
        severity: "경미",
        message: `해설 문장 ${counted}개 중 ${topN}개가 '…${top}.'로 끝나요. 어미를 다양화하세요.`,
        sample: `…${top}.`,
      });
    }
  }

  // 3) 발문에 지시 동사 없음 — each 객관식/서술형 item stem should be a clear directive.
  const itemHeader = /^\*{0,2}\s*(\d+)\s*[.)]/;
  const optionLine = /^\*{0,2}\s*[A-E]\s*[).]/;
  for (let i = 0; i < lines.length; i++) {
    const h = (lines[i] ?? "").trim();
    const hm = h.match(itemHeader);
    if (!hm) continue;
    // Collect the stem: following non-empty lines until an option / next item / heading.
    const stem: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      const l = (lines[j] ?? "").trim();
      if (!l) continue;
      if (optionLine.test(l) || itemHeader.test(l) || /^#{1,3}\s/.test(l) || /^✏/.test(l)) break;
      stem.push(l);
    }
    const stemText = stem.join(" ");
    if (!stemText) continue;
    const ok = INSTRUCTION_VERBS.test(stemText) || /\?/.test(stemText);
    if (!ok) {
      issues.push({
        type: "발문 모호",
        severity: "중대",
        message: `${hm[1]}번 발문에 지시 동사(고르시오/쓰시오 등)나 물음표가 없어요.`,
        sample: stemText.slice(0, 40),
      });
    }
  }

  return issues;
}

/** Group issues by severity (for a compact report). */
export function lintSummary(issues: LintIssue[]): { 중대: number; 경미: number } {
  return {
    중대: issues.filter((i) => i.severity === "중대").length,
    경미: issues.filter((i) => i.severity === "경미").length,
  };
}
