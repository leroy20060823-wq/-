import { test } from "node:test";
import assert from "node:assert/strict";
import { reviewArtifact, reviewPromptFor, REVIEWABLE, MODULE_REVIEW_PROMPTS } from "./review.js";
import { REVIEW_CAPSTONE_PROMPT } from "./examReview.js";

test("REVIEWABLE covers the content modules", () => {
  for (const m of ["exam", "vocabulary", "worksheet", "quiz", "ppt", "excel"]) {
    assert.ok(REVIEWABLE.has(m), `${m} should be reviewable`);
  }
});

test("reviewPromptFor picks the module prompt; exam = capstone; unknown = generic", () => {
  assert.equal(reviewPromptFor("exam"), REVIEW_CAPSTONE_PROMPT);
  assert.match(reviewPromptFor("vocabulary"), /lexicographer|IPA/);
  assert.match(reviewPromptFor("excel"), /spreadsheet/i);
  assert.match(reviewPromptFor("ppt"), /slide-deck|Overflow/);
  assert.equal(MODULE_REVIEW_PROMPTS.worksheet, MODULE_REVIEW_PROMPTS.quiz);
  // unknown → generic (not in the map)
  assert.ok(!Object.keys(MODULE_REVIEW_PROMPTS).includes("creative-writing"));
  assert.match(reviewPromptFor("creative-writing"), /independent reviewer/i);
});

const usage = (i: number, o: number) => ({ inputTokens: i, outputTokens: o });

test("reviewArtifact: 경미 only → no fix", async () => {
  let fixCalls = 0;
  const r = await reviewArtifact("vocabulary", "ART", {
    review: async (m) => {
      assert.equal(m, "vocabulary");
      return { reviewText: "- [경미] vapour는 vapor로", usage: usage(50, 60) };
    },
    fix: async () => {
      fixCalls++;
      return { fixedMarkdown: "X", usage: usage(0, 0) };
    },
  });
  assert.equal(fixCalls, 0);
  assert.equal(r.changed, false);
  assert.deepEqual(r.severity, { critical: 0, major: 0, minor: 1 });
});

test("reviewArtifact: 중대 → fix runs, sums usage, passes module to fixer", async () => {
  const r = await reviewArtifact("excel", "ORIG", {
    review: async () => ({ reviewText: "- [중대] SUMIFS 범위 어긋남", usage: usage(10, 20) }),
    fix: async (m, md) => {
      assert.equal(m, "excel");
      assert.match(md, /ORIG/);
      return { fixedMarkdown: "FIXED", usage: usage(30, 40) };
    },
  });
  assert.equal(r.changed, true);
  assert.equal(r.fixedMarkdown, "FIXED");
  assert.deepEqual(r.usage, { inputTokens: 40, outputTokens: 60 });
});
