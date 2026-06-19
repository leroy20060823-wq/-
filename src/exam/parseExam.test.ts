import { test } from "node:test";
import assert from "node:assert/strict";
import { buildExamModel } from "./parseExam.js";

const FULL = [
  "# 영어 읽기와 쓰기 · 기말 대비 모의고사",
  "총 33문항 · 시험시간 45분 · 100점 만점 | 출제 범위: 교재 Unit 3~4 · 난이도 중·표준",
  "",
  "## 응시 안내",
  "1. 객관식은 4지선다이며 정답은 하나입니다.",
  "2. 28~29번은 서술형입니다.",
  "",
  "| 파트 | 파트명 | 유형 | 문항 범위 | 문항 수 | 배점 | 총점 |",
  "|---|---|---|---|---|---|---|",
  "| P1 | 어휘 & 문법 | 객관식 | 1~2 | 2 | 3점 | 6점 |",
  "| P2 | 독해 | 객관식 | 3~3 | 1 | 4점 | 4점 |",
  "| 합계 | | | | 3 | | 100점 |",
  "",
  "**1. 어휘 — 정의 [3점]**",
  '다음 정의에 해당하는 단어를 고르세요. "a person who studies the stars"',
  "A) farmer  B) astronomer  C) sailor  D) painter",
  "",
  "**2. 문법 — 시제 [3점] ★Killer**",
  "빈칸에 알맞은 것은?",
  "A) go  B) goes  C) went  D) gone",
  "",
  "### The Night Sky — 천문 에세이",
  "The night sky has fascinated humans for millennia.",
  "Astronomers study distant stars to understand the universe.",
  "",
  "**3. 독해 — 추론 [4점]**",
  "What can be inferred from the passage?",
  "A) Stars are close  B) Astronomy is ancient  C) The sky is empty  D) Humans dislike stars",
  "",
  "## 정답표 (Answer Key)",
  "P1 어휘 & 문법",
  "1. B  2. C★",
  "P2 독해",
  "3. B",
  "",
  "## 정밀 해설지 (Detailed Explanations)",
  "P1 어휘 & 문법",
  "1. 정답 B — 정의의 핵심은 '별을 연구하는 사람'이에요.",
  "핵심  astronomer = 천문학자",
  "오답 체크  farmer·sailor·painter는 무관해요.",
].join("\n");

test("parses title, meta, difficulty", () => {
  const m = buildExamModel(FULL);
  assert.match(m.title, /기말 대비 모의고사/);
  assert.equal(m.meta.totalQuestions, 33);
  assert.equal(m.meta.timeMinutes, 45);
  assert.equal(m.meta.totalPoints, 100);
  assert.match(m.meta.scope, /Unit 3~4/);
  assert.ok(!/난이도/.test(m.meta.scope), "scope should not include the difficulty tail");
  assert.match(m.difficulty, /중/);
});

test("parses the 배점표 with a summary row", () => {
  const m = buildExamModel(FULL);
  assert.ok(m.scoreTable);
  assert.ok(m.scoreTable!.headers.includes("파트"));
  assert.equal(m.scoreTable!.rows.length, 2);
  assert.ok(m.scoreTable!.summary);
  assert.equal(m.scoreTable!.summary![0], "합계");
});

test("buckets items into parts by the 배점표 ranges, parses choices + killer + example", () => {
  const m = buildExamModel(FULL);
  const p1 = m.parts.find((p) => p.code === "P1");
  const p2 = m.parts.find((p) => p.code === "P2");
  assert.ok(p1 && p2);
  const items1 = p1!.blocks.filter((b) => b.type === "item");
  assert.equal(items1.length, 2);
  const first = items1[0] as Extract<(typeof items1)[number], { type: "item" }>;
  assert.equal(first.number, 1);
  assert.equal(first.points, 3);
  assert.deepEqual(first.choices, ["farmer", "astronomer", "sailor", "painter"]);
  assert.equal(first.example, "a person who studies the stars");
  const second = items1[1] as Extract<(typeof items1)[number], { type: "item" }>;
  assert.equal(second.killer, true);
});

test("captures the reading passage in P2", () => {
  const m = buildExamModel(FULL);
  const p2 = m.parts.find((p) => p.code === "P2")!;
  const passage = p2.blocks.find((b) => b.type === "passage");
  assert.ok(passage);
  assert.equal((passage as Extract<typeof passage, { type: "passage" }>).title, "The Night Sky");
  assert.equal((passage as Extract<typeof passage, { type: "passage" }>).tag, "천문 에세이");
});

test("parses the answer key (with killer mark) and explanation cards", () => {
  const m = buildExamModel(FULL);
  const allAnswers = m.answerKey.flatMap((g) => g.answers);
  assert.deepEqual(
    allAnswers.find((a) => a.n === 1),
    { n: 1, a: "B", killer: false },
  );
  assert.equal(allAnswers.find((a) => a.n === 2)?.killer, true);

  const cards = m.explanations.flatMap((g) => g.cards);
  const c1 = cards.find((c) => c.number === 1)!;
  assert.equal(c1.answer, "B");
  assert.match(c1.key, /astronomer/);
  assert.match(c1.wrong, /farmer/);
});

test("respects explicit overrides and neutral branding defaults", () => {
  const m = buildExamModel(FULL, { title: "내 시험", brand: "", motto: "", difficulty: "상·심화" });
  assert.equal(m.title, "내 시험");
  assert.equal(m.brand, "");
  assert.equal(m.motto, "");
  assert.equal(m.difficulty, "상·심화");
});

test("never throws and returns a valid model on garbage input", () => {
  const m = buildExamModel("그냥 평범한 줄글, 표도 문항도 없음.\n두 번째 줄.");
  assert.ok(m.title);
  assert.equal(m.meta.totalPoints, 100);
  assert.ok(Array.isArray(m.parts) && m.parts.length >= 1);
});
