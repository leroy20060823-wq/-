#!/usr/bin/env node
/**
 * CLI for the mechanical Korean-text linter (src/lint/koLint.ts).
 * Run via the npm script so the TS core loads through tsx:
 *   npm run lint:ko -- <artifact.md>      (or pipe Markdown on stdin)
 * Exits non-zero if any 중대 issue is found.
 */
import { readFileSync } from "node:fs";
const { lintKorean, lintSummary } = await import("../src/lint/koLint.ts");

const file = process.argv[2];
const md = file ? readFileSync(file, "utf8") : readFileSync(0, "utf8");

const issues = lintKorean(md);
const summary = lintSummary(issues);

if (!issues.length) {
  console.log("✅ ko-lint: 기계적 문제 없음");
  process.exit(0);
}
console.log(`ko-lint: 중대 ${summary.중대} · 경미 ${summary.경미}\n`);
for (const i of issues) {
  console.log(`[${i.severity}] ${i.type} — ${i.message}${i.sample ? `  (예: ${i.sample})` : ""}`);
}
process.exit(summary.중대 > 0 ? 1 : 0);
