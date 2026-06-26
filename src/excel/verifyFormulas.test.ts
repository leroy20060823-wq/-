import { test } from "node:test";
import assert from "node:assert/strict";
import { extractFormulas, verifyFormula, verifyAnswer } from "./verifyFormulas.js";

// A fixed 5-row table with a header → known-answer checks.
const GRID = [
  ["지역", "금액"],
  ["서울", 100],
  ["부산", 200],
  ["서울", 300],
  ["대구", 50],
];

test("extractFormulas pulls distinct '=' code spans", () => {
  const md = [
    "합계는 `=SUM(B2:B5)` 입니다.",
    "조건 합계: `=SUMIFS(B2:B5, A2:A5, \"서울\")`.",
    "중복: `=SUM(B2:B5)` (같은 수식).",
    "코드 아님: `B2:B5`.",
  ].join("\n");
  assert.deepEqual(extractFormulas(md), ['=SUM(B2:B5)', '=SUMIFS(B2:B5, A2:A5, "서울")']);
});

test("known-answer: SUM over the table", () => {
  const r = verifyFormula("=SUM(B2:B5)", GRID);
  assert.equal(r.status, "ok");
  assert.equal(r.value, 650);
});

test("known-answer: SUMIFS for 서울 = 400", () => {
  const r = verifyFormula('=SUMIFS(B2:B5, A2:A5, "서울")', GRID);
  assert.equal(r.status, "ok");
  assert.equal(r.value, 400);
});

test("known-answer: VLOOKUP 부산 → 200", () => {
  const r = verifyFormula('=VLOOKUP("부산", A2:B5, 2, FALSE)', GRID);
  assert.equal(r.status, "ok");
  assert.equal(r.value, 200);
});

test("flags an unknown/misspelled function", () => {
  const r = verifyFormula("=SUMIFFS(B2:B5, A2:A5)", GRID);
  assert.equal(r.status, "flag");
  assert.match(r.note, /알 수 없는/);
});

test("flags a syntax error", () => {
  const r = verifyFormula("=SUM(B2:B5", GRID);
  assert.equal(r.status, "flag");
  assert.match(r.note, /구문/);
});

test("verifyAnswer tallies ok vs flagged", () => {
  const md = "좋은: `=SUM(B2:B5)`\n나쁜: `=NOTAFUNC(1)`";
  const rep = verifyAnswer(md, GRID);
  assert.equal(rep.total, 2);
  assert.equal(rep.ok, 1);
  assert.equal(rep.flagged, 1);
});
