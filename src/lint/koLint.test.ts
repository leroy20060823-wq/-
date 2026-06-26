import { test } from "node:test";
import assert from "node:assert/strict";
import { lintKorean, lintSummary } from "./koLint.js";

test("flags 지문/본문 terminology mix", () => {
  const issues = lintKorean("위 지문을 읽고...\n다음 본문에서 찾으세요.");
  assert.ok(issues.some((i) => i.type === "용어 혼용"));
});

test("no terminology issue when consistent", () => {
  const issues = lintKorean("위 지문을 읽고 지문에서 고르시오?");
  assert.ok(!issues.some((i) => i.type === "용어 혼용"));
});

test("flags repeated 해설 어미", () => {
  const md = [
    "## 정밀 해설지 (Detailed Explanations)",
    "이 문장은 매우 적절해요.",
    "다음 선택지도 적절해요.",
    "마지막도 역시 적절해요.",
    "그래서 정답은 적절해요.",
  ].join("\n");
  const issues = lintKorean(md);
  assert.ok(issues.some((i) => i.type === "어미 반복"), "should flag the repeated 요-ending");
});

test("does not flag varied 해설 endings", () => {
  const md = [
    "## 정밀 해설지 (Detailed Explanations)",
    "이 문장이 핵심을 담고 있어요.",
    "따라서 B가 정답이죠.",
    "나머지는 근거가 약합니다.",
    "지문 마지막을 보면 분명해집니다.",
  ].join("\n");
  const issues = lintKorean(md);
  assert.ok(!issues.some((i) => i.type === "어미 반복"));
});

test("flags 발문 with no instruction verb or question mark", () => {
  const md = ["**1. 어휘 [3점]**", "빈칸에 들어갈 단어.", "A) a", "B) b"].join("\n");
  const issues = lintKorean(md);
  assert.ok(issues.some((i) => i.type === "발문 모호" && i.severity === "중대"));
});

test("accepts 발문 with an instruction verb or '?'", () => {
  const md = [
    "**1. 어휘 [3점]**",
    "빈칸에 알맞은 것을 고르시오.",
    "A) a",
    "B) b",
    "**2. 독해 [3점]**",
    "What can be inferred?",
    "A) a",
    "B) b",
  ].join("\n");
  const issues = lintKorean(md);
  assert.ok(!issues.some((i) => i.type === "발문 모호"));
});

test("lintSummary tallies by severity", () => {
  const s = lintSummary([
    { type: "발문 모호", severity: "중대", message: "" },
    { type: "용어 혼용", severity: "경미", message: "" },
    { type: "어미 반복", severity: "경미", message: "" },
  ]);
  assert.deepEqual(s, { 중대: 1, 경미: 2 });
});
