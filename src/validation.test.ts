import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGenerateRequest } from "./validation.js";

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
