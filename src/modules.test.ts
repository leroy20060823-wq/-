import { test } from "node:test";
import assert from "node:assert/strict";
import { getModule, listModules } from "./modules.js";
import { getSample } from "./samples.js";

test("listModules returns the registered modules", () => {
  const ids = listModules().map((m) => m.id);
  assert.ok(ids.includes("exam"));
  assert.ok(ids.includes("ppt"));
  assert.ok(ids.includes("study-notes"));
  assert.ok(ids.includes("worksheet"));
  assert.ok(ids.includes("quiz"));
  assert.ok(ids.includes("lesson-plan"));
  assert.ok(ids.includes("resume"));
  assert.ok(ids.includes("vocabulary"));
  assert.ok(ids.includes("cover-letter"));
  assert.ok(ids.includes("creative-writing"));
  assert.ok(ids.includes("excel"));
});

test("guide fields are well-formed", () => {
  for (const m of listModules()) {
    for (const f of m.guide ?? []) {
      assert.ok(f.key, `${m.id} guide field missing key`);
      assert.ok(f.label, `${m.id}.${f.key} guide field missing label`);
      assert.ok(
        ["text", "textarea", "select", "number"].includes(f.type),
        `${m.id}.${f.key} bad guide type`,
      );
      if (f.type === "select") {
        assert.ok((f.choices ?? []).length > 0, `${m.id}.${f.key} select needs choices`);
      }
    }
  }
});

test("module ids are unique", () => {
  const ids = listModules().map((m) => m.id);
  assert.equal(ids.length, new Set(ids).size);
});

test("declared options are well-formed", () => {
  for (const m of listModules()) {
    for (const opt of m.options ?? []) {
      assert.ok(opt.key, `${m.id} option missing key`);
      assert.ok(opt.label, `${m.id}.${opt.key} missing label`);
      assert.ok(["select", "number", "text"].includes(opt.type), `${m.id}.${opt.key} bad type`);
      if (opt.type === "select") {
        assert.ok((opt.choices ?? []).length > 0, `${m.id}.${opt.key} select needs choices`);
      }
    }
  }
});

test("every module has a non-empty system prompt and purpose", () => {
  for (const module of listModules()) {
    assert.ok(module.systemPrompt.trim().length > 0, `${module.id} has an empty system prompt`);
    assert.ok(module.purpose.trim().length > 0, `${module.id} has an empty purpose`);
  }
});

test("every module has a non-empty demo sample", () => {
  for (const m of listModules()) {
    const s = getSample(m.id);
    assert.ok(s && s.trim().length > 0, `${m.id} has no sample`);
  }
});

test("wizard modules declare wizard + per-step beginner questions", () => {
  for (const id of ["exam", "cover-letter"]) {
    const m = getModule(id)!;
    assert.equal(m.wizard, true, `${id} should enable the wizard`);
    for (const f of m.guide ?? []) assert.ok(f.question, `${id}.${f.key} guide needs a question`);
    for (const o of m.options ?? []) assert.ok(o.question, `${id}.${o.key} option needs a question`);
  }
});

test("getModule returns a known module", () => {
  const module = getModule("exam");
  assert.equal(module?.id, "exam");
});

test("getModule returns undefined for an unknown id", () => {
  assert.equal(getModule("does-not-exist"), undefined);
});
