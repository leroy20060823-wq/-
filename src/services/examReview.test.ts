import { test } from "node:test";
import assert from "node:assert/strict";
import { parseReviewSeverity, needsFix, reviewAndFix } from "./examReview.js";

test("parseReviewSeverity counts tagged defect lines", () => {
  const text = [
    "## 결함 목록",
    "- [치명] 3번 복수 정답 — B와 D 모두 성립",
    "- [중대] 7번 함정 선지 모호",
    "- [경미] 12번 어미 반복",
    "- [경미] 14번 띄어쓰기",
  ].join("\n");
  assert.deepEqual(parseReviewSeverity(text), { critical: 1, major: 1, minor: 2 });
});

test("parseReviewSeverity ignores the legend line and prose 없음", () => {
  const text = [
    "정답률을 심각도(치명/중대/경미)로 분류했습니다.", // legend — all three → ignored
    "치명적인 결함은 없습니다.", // 치명적 → not counted
    "중대한 문제도 없어요.", // 중대한 → not counted
    "경미한 사안만 약간 있습니다.", // 경미한 → not counted
  ].join("\n");
  assert.deepEqual(parseReviewSeverity(text), { critical: 0, major: 0, minor: 0 });
});

test("parseReviewSeverity reads a markdown severity table", () => {
  const text = [
    "| 문항 | 심각도 | 수정 |",
    "|---|---|---|",
    "| 3 | 치명 | 키를 D로 |",
    "| 9 | 치명 | 무정답, 선지 교체 |",
    "| 5 | 중대 | 함정 완화 |",
  ].join("\n");
  assert.deepEqual(parseReviewSeverity(text), { critical: 2, major: 1, minor: 0 });
});

test("needsFix triggers on 치명/중대 only", () => {
  assert.equal(needsFix({ critical: 1, major: 0, minor: 0 }), true);
  assert.equal(needsFix({ critical: 0, major: 2, minor: 5 }), true);
  assert.equal(needsFix({ critical: 0, major: 0, minor: 9 }), false);
  assert.equal(needsFix({ critical: 0, major: 0, minor: 0 }), false);
});

const usage = (i: number, o: number) => ({ inputTokens: i, outputTokens: o });

test("reviewAndFix: clean (경미 only) → no fixer call, no change", async () => {
  let fixCalls = 0;
  const r = await reviewAndFix("EXAM", {
    reviewExam: async () => ({ reviewText: "- [경미] 12번 어미 반복", usage: usage(100, 200) }),
    fixExam: async () => {
      fixCalls++;
      return { fixedMarkdown: "SHOULD-NOT-RUN", usage: usage(0, 0) };
    },
  });
  assert.equal(fixCalls, 0, "fixer must not run when only 경미");
  assert.equal(r.changed, false);
  assert.equal(r.fixedMarkdown, null);
  assert.deepEqual(r.severity, { critical: 0, major: 0, minor: 1 });
  assert.deepEqual(r.usage, { inputTokens: 100, outputTokens: 200 });
});

test("reviewAndFix: 치명 → fixer runs, returns corrected markdown, sums usage", async () => {
  let fixCalls = 0;
  const r = await reviewAndFix("EXAM ORIGINAL", {
    reviewExam: async () => ({ reviewText: "- [치명] 3번 복수 정답", usage: usage(100, 200) }),
    fixExam: async (md, review) => {
      fixCalls++;
      assert.match(md, /EXAM ORIGINAL/);
      assert.match(review, /치명/);
      return { fixedMarkdown: "EXAM FIXED", usage: usage(300, 400) };
    },
  });
  assert.equal(fixCalls, 1);
  assert.equal(r.changed, true);
  assert.equal(r.fixedMarkdown, "EXAM FIXED");
  assert.deepEqual(r.usage, { inputTokens: 400, outputTokens: 600 });
});

test("reviewAndFix: fixer returns identical text → changed=false", async () => {
  const r = await reviewAndFix("SAME", {
    reviewExam: async () => ({ reviewText: "- [중대] 7번 모호", usage: usage(10, 20) }),
    fixExam: async () => ({ fixedMarkdown: "  SAME  ", usage: usage(5, 5) }),
  });
  assert.equal(r.changed, false, "identical (trimmed) fixer output is not a real change");
  assert.equal(r.fixedMarkdown, null);
  assert.deepEqual(r.usage, { inputTokens: 15, outputTokens: 25 });
});
