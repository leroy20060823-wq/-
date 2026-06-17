import { test } from "node:test";
import assert from "node:assert/strict";
import { recommendThemes, PRESETS, getPreset } from "./design.js";

test("recommends the business theme for a business mood", () => {
  const recs = recommendThemes({ mood: "비즈니스 신뢰", topic: "분기 실적 보고" });
  assert.equal(recs[0]?.preset.id, "trust");
});

test("recommends the warm theme for an emotional/education mood", () => {
  const recs = recommendThemes({ mood: "따뜻 감성", audience: "학생", topic: "교육 강연" });
  assert.equal(recs[0]?.preset.id, "warm");
});

test("returns 3 recommendations even with empty input", () => {
  const recs = recommendThemes({});
  assert.equal(recs.length, 3);
  assert.equal(recs[0]?.reason, "기본 추천");
});

test("every preset declares web fonts and a palette", () => {
  for (const p of PRESETS) {
    assert.ok(p.heading.webFont && p.body.webFont, `${p.id} missing fonts`);
    assert.ok(p.palette.bg && p.palette.accent && p.palette.ink, `${p.id} missing palette`);
  }
});

test("getPreset finds by id", () => {
  assert.equal(getPreset("impact")?.name, "강렬 임팩트");
  assert.equal(getPreset("nope"), undefined);
});
