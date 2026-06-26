#!/usr/bin/env node
/**
 * CLI: verify the formulas in a generated 엑셀 answer against a small synthetic
 * dataset (HyperFormula). Flags unknown functions / syntax errors; known-answer
 * correctness lives in src/excel/verifyFormulas.test.ts.
 *   npm run verify:excel -- <answer.md>     (or pipe Markdown on stdin)
 * Exits non-zero if any formula is flagged.
 */
import { readFileSync } from "node:fs";
const { verifyAnswer } = await import("../src/excel/verifyFormulas.ts");

// Generic synthetic table the formulas are evaluated against (header in row 1).
const GRID = [
  ["날짜", "지역", "금액", "수량"],
  ["2025-01-05", "서울", 100, 2],
  ["2025-01-18", "부산", 200, 1],
  ["2025-02-03", "서울", 300, 5],
  ["2025-02-20", "대구", 50, 3],
];

const file = process.argv[2];
const md = file ? readFileSync(file, "utf8") : readFileSync(0, "utf8");
const rep = verifyAnswer(md, GRID);

if (rep.total === 0) {
  console.log("verify-excel: 수식(코드 스팬 `=...`)을 찾지 못했어요.");
  process.exit(0);
}
console.log(`verify-excel: 총 ${rep.total} · 평가됨 ${rep.ok} · 플래그 ${rep.flagged}\n`);
for (const r of rep.rows) {
  const mark = r.status === "ok" ? "O" : "X";
  console.log(`[${mark}] ${r.formula}  →  ${JSON.stringify(r.value)}${r.note ? `  (${r.note})` : ""}`);
}
process.exit(rep.flagged > 0 ? 1 : 0);
