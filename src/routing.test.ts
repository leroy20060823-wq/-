import { test } from "node:test";
import assert from "node:assert/strict";
import { routeModel, routeTier, taskWeight, MODELS } from "./routing.js";

test("default (standard) module → Sonnet", () => {
  assert.equal(routeModel("vocabulary").model, MODELS.standard);
  assert.equal(routeModel("worksheet").model, "claude-sonnet-5");
});

test("complex modules → Opus", () => {
  assert.equal(routeModel("exam").model, MODELS.heavy);
  assert.equal(routeModel("cover-letter").model, "claude-opus-4-8");
  assert.equal(routeModel("creative-writing").model, MODELS.heavy);
});

test("난이도 상 escalates to Opus; 중 keeps base", () => {
  assert.equal(routeTier("worksheet", "상"), "heavy");
  assert.equal(routeTier("quiz", "상"), "heavy");
  assert.equal(routeTier("worksheet", "중"), "standard");
});

test("난이도 하 caps at Sonnet (never Haiku), and pulls a heavy module down", () => {
  assert.equal(routeTier("worksheet", "하"), "standard"); // stays Sonnet, not Haiku
  assert.equal(routeTier("exam", "하"), "standard"); // heavy → standard
});

test("very large input escalates a standard task to Opus", () => {
  assert.equal(routeTier("ppt", undefined, 50000), "heavy");
  assert.equal(routeTier("ppt", undefined, 100), "standard");
});

test("taskWeight maps tier → loading-note weight", () => {
  assert.equal(taskWeight("exam"), "heavy");
  assert.equal(taskWeight("vocabulary"), "light");
  assert.equal(taskWeight("worksheet", "상"), "heavy");
});

test("unknown module defaults to standard", () => {
  assert.equal(routeTier("nope-not-a-module"), "standard");
});
