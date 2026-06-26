import { test } from "node:test";
import assert from "node:assert/strict";
import { buildExamModel, type ExamBlock } from "./parseExam.js";

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
  "| P3 | 서술형 | 서술형 | 4~4 | 1 | 5점 | 5점 |",
  "| 합계 | | | | 4 | | 100점 |",
  "",
  "**1. 어휘 — 정의 [3점]**",
  '다음 정의에 해당하는 단어를 고르세요. "a person who studies the stars"',
  "A) farmer",
  "B) astronomer",
  "C) sailor",
  "D) painter",
  "E) writer",
  "",
  "**2. 문법 — 시제 [3점] ★Killer**",
  "빈칸에 알맞은 것은?",
  "A) go  B) goes  C) went  D) gone  E) going",
  "",
  "### The Night Sky — 천문 에세이",
  "The night sky has fascinated humans for millennia.",
  "Astronomers study distant stars to understand the universe.",
  "",
  "**3. 독해 — 추론 [4점]**",
  "What can be inferred from the passage?",
  "A) Stars are close  B) Astronomy is ancient  C) The sky is empty  D) Humans dislike stars  E) Stars are loud",
  "",
  "## P3. 서술형",
  "**4. 서술형 — 요지 쓰기 [5점]**",
  "윗글의 요지를 한 문장으로 쓰세요.",
  "✏️ ____",
  "",
  "마지막까지 최선을 다하세요!",
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
  assert.equal(m.scoreTable!.rows.length, 3);
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
  assert.deepEqual(first.choices, ["farmer", "astronomer", "sailor", "painter", "writer"]);
  assert.equal(first.example, "a person who studies the stars");
  const second = items1[1] as Extract<(typeof items1)[number], { type: "item" }>;
  assert.equal(second.killer, true);
  assert.equal(second.choices.length, 5);
});

test("parses 서술형 items as a blank (no choices) bucketed into P3", () => {
  const m = buildExamModel(FULL);
  const p3 = m.parts.find((p) => p.code === "P3");
  assert.ok(p3, "P3 should exist");
  const essay = p3!.blocks.find((b) => b.type === "item") as Extract<ExamBlock, { type: "item" }> | undefined;
  assert.ok(essay, "P3 should hold the 서술형 item");
  assert.equal(essay!.number, 4);
  assert.equal(essay!.blank, true);
  assert.equal(essay!.choices.length, 0);
  assert.ok(!/____|✏/.test(essay!.prompt), "the ✏️ blank marker should be stripped from the prompt");
  assert.ok(!/최선을 다하세요/.test(essay!.prompt), "the closing line must not be glued onto the last item");
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

test("parses an inline answer key: '**P1.**  1. A  2. E ★  3. C'", () => {
  const md = [
    "# T",
    "총 3문항 · 100점 만점",
    "## 정답표 (Answer Key)",
    "**P1.**  1. A  2. E ★  3. C",
    "## 정밀 해설지",
  ].join("\n");
  const m = buildExamModel(md);
  const ans = m.answerKey.flatMap((g) => g.answers);
  assert.deepEqual(
    ans.find((a) => a.n === 1),
    { n: 1, a: "A", killer: false },
  );
  assert.deepEqual(
    ans.find((a) => a.n === 2),
    { n: 2, a: "E", killer: true },
  );
  assert.equal(m.answerKey[0]?.part, "P1");
});

test("parses rich 해설 headers (killer · 난이도 · 배점), joining points/killer from items", () => {
  const md = [
    "# T",
    "총 2문항 · 100점 만점",
    "## 배점표",
    "| 파트 | 파트명 | 유형 | 문항 범위 | 문항 수 | 문항당 배점 | 파트 총점 |",
    "|---|---|---|---|---|---|---|",
    "| P1 | 독해 | 객관식 | 1~2 | 2 | 50점 | 100점 |",
    "## P1. 독해",
    "**1. 독해 — 추론 [4점] ★Killer**",
    "고르세요.",
    "A) a",
    "B) b",
    "C) c",
    "D) d",
    "E) e",
    "**2. 독해 — 사실 [3점]**",
    "고르세요.",
    "A) a",
    "B) b",
    "C) c",
    "D) d",
    "E) e",
    "## 정답표 (Answer Key)",
    "**P1.** 1. B ★  2. C",
    "## 정밀 해설지 (Detailed Explanations)",
    "**P1.**",
    "**1. 정답 B ★Killer · 고난도 (4점)**",
    "근거 문장이에요.",
    "핵심  rule X",
    "오답 체크  distractor Y",
    "**2. 정답 C**",
    "근거.",
  ].join("\n");
  const m = buildExamModel(md);
  const cards = m.explanations.flatMap((g) => g.cards);
  const c1 = cards.find((c) => c.number === 1)!;
  assert.equal(c1.answer, "B");
  assert.equal(c1.killer, true);
  assert.equal(c1.points, 4);
  assert.equal(c1.difficulty, "고난도");
  assert.match(c1.explanation, /근거 문장/);
  assert.match(c1.key, /rule X/);
  // header omits difficulty/points → joined from the item ([3점], not killer)
  const c2 = cards.find((c) => c.number === 2)!;
  assert.equal(c2.answer, "C");
  assert.equal(c2.killer, false);
  assert.equal(c2.points, 3);
  assert.equal(c2.difficulty, "");
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
