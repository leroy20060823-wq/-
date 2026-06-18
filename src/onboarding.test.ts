import { test } from "node:test";
import assert from "node:assert/strict";
import { guidanceFromAnswers, parseSurvey } from "./onboarding.js";

test("experienced user → lite", () => {
  // q1 yes, q2 yes, q3 yes, q4 no → score 0
  const level = guidanceFromAnswers({ q1: true, q2: true, q3: true, q4: false, q5: true });
  assert.equal(level, "lite");
});

test("beginner → guided", () => {
  // q1 no, q2 no, q3 no, q4 yes → score 4
  const level = guidanceFromAnswers({ q1: false, q2: false, q3: false, q4: true, q5: true });
  assert.equal(level, "guided");
});

test("boundary: score 1 → lite, score 2 → guided", () => {
  assert.equal(guidanceFromAnswers({ q1: true, q2: true, q3: true, q4: true, q5: false }), "lite"); // 1
  assert.equal(guidanceFromAnswers({ q1: false, q2: false, q3: true, q4: false, q5: false }), "guided"); // 2
});

test("q5 (motivation) does not affect the score", () => {
  const base = { q1: true, q2: true, q3: true, q4: false } as const;
  assert.equal(
    guidanceFromAnswers({ ...base, q5: true }),
    guidanceFromAnswers({ ...base, q5: false }),
  );
});

test("parseSurvey rejects non-boolean / missing fields", () => {
  assert.equal(parseSurvey({ q1: true, q2: true, q3: true, q4: true }), null);
  assert.equal(parseSurvey({ q1: "yes", q2: true, q3: true, q4: true, q5: true }), null);
  assert.equal(parseSurvey(null), null);
  assert.deepEqual(parseSurvey({ q1: true, q2: false, q3: true, q4: false, q5: true }), {
    q1: true,
    q2: false,
    q3: true,
    q4: false,
    q5: true,
  });
});
