import { test } from "node:test";
import assert from "node:assert/strict";

// docqa.js is a browser ES module; import it at runtime via URL so tsc (rootDir:
// src) doesn't pull it into the typecheck program. Its pure helpers (contrast,
// qaLoop, resolveColors) run fine under Node — only the render/measure paths use
// the DOM and those aren't exercised here.
const mod = (await import(new URL("../public/docqa.js", import.meta.url).href)) as {
  contrast: (a: string, b: string) => number;
  resolveColors: (p: { bg: string; ink?: string; sub?: string; accent?: string }) => {
    bg: string;
    ink: string;
    sub: string;
    accent: string;
  };
  qaLoop: (cfg: {
    render: (s: unknown) => Promise<void> | void;
    inspect: (s: unknown) => { type: string }[];
    repair: (issues: { type: string }[], s: unknown) => unknown;
    fallback?: (s: unknown) => unknown;
    initialState: unknown;
  }) => Promise<{ ok: boolean; passes: unknown[]; fellBack?: boolean }>;
  TYPE_SCALE: Record<string, { size: number; lh: number }>;
  PAGE: Record<string, { w: number; h: number; margin: number }>;
};
const { contrast, resolveColors, qaLoop, TYPE_SCALE, PAGE } = mod;

test("contrast: black/white is ~21:1, identical colors are 1:1", () => {
  assert.ok(Math.abs(contrast("#000000", "#ffffff") - 21) < 0.5);
  assert.equal(Math.round(contrast("#123456", "#123456")), 1);
});

test("resolveColors fixes unreadable ink against the background", () => {
  // near-black ink on a near-black bg → must be overridden to a light color.
  const c = resolveColors({ bg: "#101418", ink: "#0a0a0a" });
  assert.ok(contrast(c.bg, c.ink) >= 4.5, `ink contrast was ${contrast(c.bg, c.ink)}`);
});

test("geometry + type scale are defined once and sane", () => {
  assert.ok(PAGE.a4!.w > 0 && PAGE.a4!.h > PAGE.a4!.w); // portrait
  assert.ok(TYPE_SCALE.heading!.size > TYPE_SCALE.body!.size);
  assert.ok(TYPE_SCALE.body!.lh >= 1.5); // generous line-height for CJK
});

test("qaLoop returns ok on the first clean pass", async () => {
  let renders = 0;
  const res = await qaLoop({
    initialState: { scale: 1 },
    render: () => {
      renders += 1;
    },
    inspect: () => [],
    repair: () => null,
  });
  assert.equal(res.ok, true);
  assert.equal(res.passes.length, 1);
  assert.equal(renders, 1);
});

test("qaLoop repairs across passes then passes", async () => {
  let attempt = 0;
  const res = await qaLoop({
    initialState: { scale: 1 },
    render: () => {},
    inspect: () => (attempt >= 2 ? [] : [{ type: "overflow-v" }]),
    repair: (_issues, s) => {
      attempt += 1;
      return { ...(s as object), scale: 0.9 };
    },
  });
  assert.equal(res.ok, true);
  assert.ok(res.passes.length >= 2);
});

test("qaLoop falls back to the safest layout when it can't converge", async () => {
  const res = await qaLoop({
    initialState: { scale: 1 },
    render: () => {},
    inspect: () => [{ type: "overflow-v" }], // never clean
    repair: (_issues, s) => ({ ...(s as object), scale: 0.85 }),
    fallback: (s) => ({ ...(s as object), scale: 0.82, fellBack: true }),
  });
  assert.equal(res.fellBack, true);
  assert.equal(res.ok, false);
});
