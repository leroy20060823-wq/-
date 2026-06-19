import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGenerateRequest, normalizeOptionValues, sanitizeText } from "./validation.js";
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

test("rejects input longer than maxInputChars", () => {
  const result = parseGenerateRequest(
    { module: "exam", input: "x".repeat(50) },
    ALLOWED,
    20,
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /너무 깁니다/);
});

test("sanitizeText drops control chars but keeps tab/newline/CR", () => {
  const NUL = String.fromCharCode(0);
  const BEL = String.fromCharCode(7);
  const DEL = String.fromCharCode(127);
  const dirty = `a${NUL}b${BEL}c${DEL}d\te\nf\rg`;
  assert.equal(sanitizeText(dirty), "abcd\te\nf\rg");
});

test("parseGenerateRequest strips control chars from input", () => {
  const NUL = String.fromCharCode(0);
  const result = parseGenerateRequest({ module: "exam", input: `안녕${NUL}하세요` }, ALLOWED);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.options.input, "안녕하세요");
});

test("rejects a per-field value longer than maxFieldChars", () => {
  const result = parseGenerateRequest(
    { module: "exam", input: "hi", options: { note: "x".repeat(40) } },
    ALLOWED,
    8000,
    20,
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /한 항목이 너무 깁니다/);
});

test("normalizes valid option values (coerces numbers, keeps valid selects)", () => {
  const exam = getModule("exam")!;
  const values = normalizeOptionValues(exam, { difficulty: "중", count: "10" });
  assert.deepEqual(values, { difficulty: "중", count: 10 });
});

test("clamps numbers to the declared min/max", () => {
  const exam = getModule("exam")!; // count: default 33, min 10, max 50
  assert.equal(normalizeOptionValues(exam, { count: 999 }).count, 50);
  assert.equal(normalizeOptionValues(exam, { count: 0 }).count, 10);
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

const PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

test("accepts a valid image attachment and switches to grounded mode", () => {
  const r = parseGenerateRequest(
    { module: "exam", input: "영어 시험", attachments: [{ kind: "image", mediaType: "image/png", data: PNG_B64 }] },
    ALLOWED,
  );
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.options.attachments?.length, 1);
    assert.equal(r.options.attachments?.[0]?.kind, "image");
  }
});

test("allows attachment-only or source-only requests (no form text)", () => {
  const imgOnly = parseGenerateRequest(
    { module: "exam", input: "", attachments: [{ kind: "image", mediaType: "image/jpeg", data: PNG_B64 }] },
    ALLOWED,
  );
  assert.equal(imgOnly.ok, true);
  const srcOnly = parseGenerateRequest({ module: "exam", input: "", sourceText: "지문 내용" }, ALLOWED);
  assert.equal(srcOnly.ok, true);
  if (srcOnly.ok) assert.equal(srcOnly.options.sourceText, "지문 내용");
});

test("rejects too many attachments", () => {
  const many = Array.from({ length: 11 }, () => ({ kind: "image", mediaType: "image/png", data: PNG_B64 }));
  const r = parseGenerateRequest({ module: "exam", input: "x", attachments: many }, ALLOWED, 8000, 3000, {
    maxAttachments: 10,
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /최대 10개/);
});

test("rejects an unsupported attachment media type", () => {
  const r = parseGenerateRequest(
    { module: "exam", input: "x", attachments: [{ kind: "image", mediaType: "image/svg+xml", data: PNG_B64 }] },
    ALLOWED,
  );
  assert.equal(r.ok, false);
});

test("rejects an oversized image (per-file cap)", () => {
  const big = "A".repeat(2000); // ~1.5KB decoded
  const r = parseGenerateRequest(
    { module: "exam", input: "x", attachments: [{ kind: "image", mediaType: "image/png", data: big }] },
    ALLOWED,
    8000,
    3000,
    { maxImageBytes: 1000 },
  );
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /너무 커요/);
});

test("rejects a request with neither text nor material", () => {
  const r = parseGenerateRequest({ module: "exam", input: "" }, ALLOWED);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /입력하거나 자료/);
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
