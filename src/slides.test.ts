import { test } from "node:test";
import assert from "node:assert/strict";

// slides.js is a browser ES module under public/. Import it at runtime via a URL
// so tsc (rootDir: src) doesn't pull it into the typecheck program. Its parser is
// pure (no DOM), so it loads fine under Node.
const mod = (await import(new URL("../public/slides.js", import.meta.url).href)) as {
  parseDeck: (md: string) => { slides: Slide[] } | null;
  capDeck: (deck: { slides: Slide[] }) => Slide[];
  CAPS: { maxBullets: number };
};
const { parseDeck, capDeck, CAPS } = mod;

interface Slide {
  kind?: string;
  title: string;
  subtitle?: string;
  bullets: string[];
  notes?: string;
  continued?: boolean;
}

test("parseDeck returns null for non-deck text", () => {
  assert.equal(parseDeck(""), null);
  assert.equal(parseDeck("just a paragraph with no headings"), null);
});

test("parseDeck extracts title (stripping 'Slide N:'), bullets, subtitle, notes", () => {
  const md = [
    "## Slide 1: 발표 제목",
    "부제목입니다",
    "",
    "## Slide 2: 핵심 내용",
    "- 첫 번째 포인트",
    "- 두 번째 포인트",
    "> Speaker notes: 발표자에게만 보이는 메모.",
  ].join("\n");
  const deck = parseDeck(md);
  assert.ok(deck);
  assert.equal(deck.slides.length, 2);

  const s1 = deck.slides[0]!;
  const s2 = deck.slides[1]!;
  assert.equal(s1.title, "발표 제목");
  assert.equal(s1.subtitle, "부제목입니다");
  assert.equal(s1.bullets.length, 0);
  assert.equal(s1.kind, "title"); // first slide, no bullets

  assert.equal(s2.title, "핵심 내용");
  assert.deepEqual(s2.bullets, ["첫 번째 포인트", "두 번째 포인트"]);
  assert.equal(s2.notes, "발표자에게만 보이는 메모.");
  assert.equal(s2.kind, "content");
});

test("parseDeck strips markdown emphasis from titles and bullets", () => {
  const deck = parseDeck("## Slide 1: **굵은 제목**\n- `코드` 포인트\n- [링크](http://x)만 텍스트");
  assert.ok(deck);
  assert.equal(deck.slides[0]!.title, "굵은 제목");
  assert.deepEqual(deck.slides[0]!.bullets, ["코드 포인트", "링크만 텍스트"]);
});

test("parseDeck drops the design-guide section", () => {
  const md = "## Slide 1: 내용\n- 포인트\n\n## 디자인 가이드\n- 배경 #fff\n- 강조 #2f6db5";
  const deck = parseDeck(md);
  assert.ok(deck);
  assert.equal(deck.slides.length, 1);
  assert.equal(deck.slides[0]!.title, "내용");
});

test("capDeck splits slides exceeding the bullet cap into continuation slides", () => {
  const bullets = Array.from({ length: CAPS.maxBullets + 3 }, (_, i) => `포인트 ${i + 1}`);
  const out = capDeck({ slides: [{ title: "많은 항목", bullets, kind: "content" }] });
  assert.equal(out.length, 2);
  assert.equal(out[0]!.bullets.length, CAPS.maxBullets);
  assert.equal(out[1]!.bullets.length, 3);
  assert.ok(!out[0]!.continued); // first chunk is not a continuation
  assert.equal(out[1]!.continued, true);
});

test("capDeck leaves within-cap slides untouched", () => {
  const out = capDeck({ slides: [{ title: "적당함", bullets: ["a", "b"], kind: "content" }] });
  assert.equal(out.length, 1);
  assert.deepEqual(out[0]!.bullets, ["a", "b"]);
});
