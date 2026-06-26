import { test } from "node:test";
import assert from "node:assert/strict";

// The verifier is a JS QA tool in scripts/ (no types); import its pure functions
// (the CLI main() is guarded so importing does not run it).
// @ts-ignore - untyped .mjs helper
import { extractFormulas, evaluateFormulas } from "../../scripts/verify-excel.mjs";

test("extractFormulas pulls inline code spans and '='-lines", () => {
  const md = [
    "Put `=SUM(A2:A30)` in E2.",
    "- 평균: `=AVERAGE(B2:B30)`",
    "=MAX(C2:C30)",
    "not a formula line",
  ].join("\n");
  const f = extractFormulas(md);
  assert.ok(f.includes("=SUM(A2:A30)"));
  assert.ok(f.includes("=AVERAGE(B2:B30)"));
  assert.ok(f.includes("=MAX(C2:C30)"));
  assert.equal(f.length, 3);
});

test("evaluateFormulas: valid formulas compute, broken ones are flagged", () => {
  const r = evaluateFormulas(["=SUM(B2:B30)", "=SUMM(A1)", "=1/0", "=SUMIFS(B2:B30)"]);
  const by = Object.fromEntries(r.map((x: { formula: string; ok: boolean; shown: string }) => [x.formula, x]));
  // valid: SUM evaluates to a number on the seeded grid
  assert.equal(by["=SUM(B2:B30)"].ok, true);
  assert.match(by["=SUM(B2:B30)"].shown, /^\d+$/);
  // broken: typo (#NAME?), div-by-zero (#DIV/0!), wrong arg count
  assert.equal(by["=SUMM(A1)"].ok, false);
  assert.equal(by["=1/0"].ok, false);
  assert.equal(by["=SUMIFS(B2:B30)"].ok, false);
});
