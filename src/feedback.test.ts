import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFeedback } from "./feedback.js";

test("parseFeedback normalizes a full submission", () => {
  const fb = parseFeedback({
    rating: 5,
    usable: "yes",
    easyForm: "ok",
    reuse: "maybe",
    comment: "좋아요",
    module: "exam",
  });
  assert.ok(fb);
  assert.deepEqual(fb, { rating: 5, usable: "yes", easyForm: "ok", reuse: "maybe", comment: "좋아요", module: "exam" });
});

test("parseFeedback rejects empty / non-object", () => {
  assert.equal(parseFeedback(null), null);
  assert.equal(parseFeedback({}), null);
  assert.equal(parseFeedback({ rating: 0, usable: "nope" }), null); // out of range + bad enum → no signal
});

test("parseFeedback accepts a partial submission (rating only, or comment only)", () => {
  assert.ok(parseFeedback({ rating: 3 }));
  assert.ok(parseFeedback({ comment: "한 줄 의견" }));
});

test("parseFeedback clamps rating range and drops bad enums", () => {
  assert.equal(parseFeedback({ rating: 9, usable: "yes" })?.rating, null);
  assert.equal(parseFeedback({ rating: 4 })?.rating, 4);
  assert.equal(parseFeedback({ rating: 2, easyForm: "weird" })?.easyForm, null);
});

test("parseFeedback caps comment length and strips control chars", () => {
  const long = "가".repeat(900);
  const fb = parseFeedback({ comment: long });
  assert.ok(fb);
  assert.equal(fb.comment.length, 500);
});
