import { test } from "node:test";
import assert from "node:assert/strict";
import { getModule, listModules } from "./modules.js";

test("listModules returns the registered modules", () => {
  const ids = listModules().map((m) => m.id);
  assert.ok(ids.includes("exam"));
  assert.ok(ids.includes("ppt"));
  assert.ok(ids.includes("study-notes"));
  assert.ok(ids.includes("worksheet"));
  assert.ok(ids.includes("quiz"));
});

test("module ids are unique", () => {
  const ids = listModules().map((m) => m.id);
  assert.equal(ids.length, new Set(ids).size);
});

test("every module has a non-empty system prompt", () => {
  for (const module of listModules()) {
    assert.ok(module.systemPrompt.trim().length > 0, `${module.id} has an empty system prompt`);
  }
});

test("getModule returns a known module", () => {
  const module = getModule("exam");
  assert.equal(module?.id, "exam");
});

test("getModule returns undefined for an unknown id", () => {
  assert.equal(getModule("does-not-exist"), undefined);
});
