import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGenerateRequest, normalizeOptionValues } from "./validation.js";
import { getModule } from "./modules.js";

const ALLOWED = ["claude-haiku-4-5", "claude-sonnet-4-6"] as const;

test("accepts a valid request", () => {
  const result = parseGenerateRequest({ module: "exam", input: "10 questions" }, ALLOWED);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.options.module.id, "exam");
    assert.equal(result.options.input, "10 questions");
    assert.equal(result.options.model, undefined);
  }
});

test("trims whitespace from input", () => {
  const result = parseGenerateRequest({ module: "ppt", input: "  topic  " }, ALLOWED);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.options.input, "topic");
});

test("rejects a missing module", () => {
  const result = parseGenerateRequest({ input: "hi" }, ALLOWED);
  assert.equal(result.ok, false);
});

test("rejects a missing input", () => {
  const result = parseGenerateRequest({ module: "exam" }, ALLOWED);
  assert.equal(result.ok, false);
});

test("rejects an unknown module", () => {
  const result = parseGenerateRequest({ module: "nope", input: "hi" }, ALLOWED);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /Unknown module/);
});

test("accepts an allowed model override", () => {
  const result = parseGenerateRequest(
    { module: "exam", input: "hi", model: "claude-sonnet-4-6" },
    ALLOWED,
  );
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.options.model, "claude-sonnet-4-6");
});

test("rejects a model override outside the allow-list", () => {
  const result = parseGenerateRequest(
    { module: "exam", input: "hi", model: "claude-opus-4-8" },
    ALLOWED,
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /Model not allowed/);
});

test("ignores non-string fields", () => {
  const result = parseGenerateRequest({ module: 123, input: ["x"] }, ALLOWED);
  assert.equal(result.ok, false);
});

test("normalizes valid option values (coerces numbers, keeps valid selects)", () => {
  const exam = getModule("exam")!;
  const values = normalizeOptionValues(exam, { difficulty: "중", count: "10" });
  assert.deepEqual(values, { difficulty: "중", count: 10 });
});

test("clamps numbers to the declared min/max", () => {
  const exam = getModule("exam")!;
  assert.equal(normalizeOptionValues(exam, { count: 999 }).count, 50);
  assert.equal(normalizeOptionValues(exam, { count: 0 }).count, 1);
});

test("drops select values outside the choices and unknown keys", () => {
  const exam = getModule("exam")!;
  const values = normalizeOptionValues(exam, { difficulty: "X", bogus: "y" });
  assert.deepEqual(values, {});
});

test("a module without options yields no option values", () => {
  const notes = getModule("study-notes")!;
  assert.deepEqual(normalizeOptionValues(notes, { anything: "1" }), {});
});

test("parseGenerateRequest attaches normalized optionValues", () => {
  const result = parseGenerateRequest(
    { module: "quiz", input: "광합성", options: { difficulty: "상", count: "5", type: "단답형" } },
    ALLOWED,
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.options.optionValues, {
      difficulty: "상",
      count: 5,
      type: "단답형",
    });
  }
});
