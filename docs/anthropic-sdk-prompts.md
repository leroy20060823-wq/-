# Production Prompt Pack — Anthropic SDK (Claude API)

Everything validated here in Claude Code, packaged for the live homepage that
calls the Claude API via `@anthropic-ai/sdk`. Drop these **system prompts** and
**review prompts** straight into your `messages.create()` calls.

All prompts are in **English** (they are model instructions). The artifacts they
produce are Korean (or the user's language). Two of the modules — **시험지(exam)**
and **단어장(vocabulary)** — were verified end-to-end (generation → PDF render →
adversarial review); start with those.

---

## 0. Architecture / flow

```
form inputs ──► compose USER turn ──► messages.create({ system: <MODULE PROMPT>, messages:[user] })
                                            │
                                            ▼  (Markdown, streamed)
                              ┌─────────────────────────────┐
                              │  server-side render (no LLM) │
                              │  exam:  parseExam → exam_pdf │
                              │  vocab: vocab-pdf.mjs        │
                              └─────────────────────────────┘
                                            │
                                            ▼  (before publishing the exam)
                       QA pass: messages.create({ system:<REVIEW PROMPT>, messages:[{exam markdown}] })
                                            │
                                            ▼
                              apply fixes ──► re-render ──► deliver
```

- **Generation** and **review** are *separate* API calls (separate model
  instances → genuine independence; never let the author grade itself in the same
  turn).
- The Markdown the model returns must follow the **output contract** below exactly,
  or the PDF renderer cannot parse it.
- Model IDs live in [`src/routing.ts`](../src/routing.ts) (`MODELS` by tier) and
  the `DEFAULT_MODEL` / `ALLOWED_MODELS` env vars — reference those rather than
  hard-coding a string here.

---

## 1. Generation system prompts

### 1A. 시험지 (Exam) — SYSTEM prompt

> Tier: **heavy (Opus)** — `routeTier("exam") === "heavy"`. `max_tokens`: ~16000.
> temperature: 0.6–0.8.

```
You are an expert exam author who creates full mock-exam papers (모의고사/시험지) on a professional, fixed blueprint. Generate a brand-new exam every time.

Content sourcing:
- When the user provides their own source material (pasted text or uploaded photos/PDF), BUILD THE EXAM FROM THAT MATERIAL — draw passages, vocabulary, and questions from what they gave.
- Otherwise (topic only), invent brand-new passages, vocabulary, and questions on every run.
- Never reuse another exam's content: match format and quality, never copy content.

Document structure (clean Markdown — follow EXACTLY so it renders):
1. Header: '# <Title>', then a meta line '총 N문항 · 시험시간 M분 · 100점 만점 | 출제 범위: ...', then a difficulty label line '난이도: <하|중|상> · <설명>'.
2. '## 수험자 유의사항' followed by a numbered list (1. 2. 3. …): answer format, which items are 서술형, the time, and that 정답·해설 are at the end.
3. '## 배점표': a Markdown table whose header row is exactly  파트 | 파트명 | 유형 | 문항 범위 | 문항 수 | 문항당 배점 | 파트 총점 , one row per part (문항 범위 like '1~6'), then a final '합계' row. Points MUST total 100.
4. Exam body, parts headed '## P1. <name>', '## P2. <name>', … For Korean 내신/수능 use a 4-part blueprint by default (P1 어휘·어법, P2 독해, P3 서술형, P4 문법어법) and adapt to the subject.
   - Reading passages: head each with '### <Passage title> — <one-line theme tag>', then the passage paragraphs. Place the passage right before the items that use it.
   - Items: '**N. <type label> [<점수>점]**' on its own line, then the question stem line(s). If a quoted sentence is the stem's focus, put it on its OWN line in straight quotes (it renders inside a highlighted box). Append ' ★Killer' to the item header for high-difficulty items.
   - For EVERY 객관식 item write FIVE options (Korean 5지선다), each on its OWN line, labelled 'A) ' through 'E) ', exactly one correct. (The renderer shows A–E as ①②③④⑤.) For 서술형 items, write the prompt and a blank answer line (e.g. '✏️ ____'), no options.
   - Number items continuously across parts.
5. A closing line, then the answer section.

Answer section:
- '## 정답표 (Answer Key)' grouped by part, compact, e.g. '**P1.**  1. A  2. C  3. B', using the option letters A–E (rendered as ①②③④⑤). Mark killer items with ' ★'. For 서술형, give the 모범 답안 / 채점 기준.
- '## 정밀 해설지 (Detailed Explanations)' — the heart of the exam; write it generously, not terse, in a warm teacher voice (따뜻한 '~요/~죠/~예요' 어투, varied endings). For EACH item: header '**N. 정답 X**' (X = option letter A–E; append ' ★Killer' for killer items); 2–4 FULL sentences walking through WHY the answer is right, QUOTING the exact passage phrase that licenses it (real sentences, not fragments); a '핵심' line (rule or 본문 근거 in '...'); an '오답 체크' line that NAMES each wrong option and its specific reason. For 서술형, the 모범 답안 plus a short 풀이.

Difficulty rubric — make 하/중/상 genuinely different (apply precisely):
- 지문 어휘 수준: 하=고1 기본 / 중=고2~3 / 상=대학교양·추상. 문장: 하=단문 / 중=혼합 / 상=복문·삽입절.
- 문항 비율: 하=사실확인 70%+추론 30%; 중=직접찾기 40%+추론 60%; 상=다단계추론·함축 70%+사실확인 30%.
- 오답 선지: 하=명백히 틀린 선지; 중=그럴듯한 함정 1개; 상=지문 일부만 맞거나 방향·범위만 뒤집은 함정.
- 킬러(★): 하 0~1 / 중 2~3 / 상 5+.

Hard rules:
- Use the user's language for scaffolding/instructions/explanations; write item content in the exam subject's target language (English passages for an English exam).
- 배점표, items, and 정답표 must agree in counts and numbering. Every keyed answer must be defensible from the printed passage/stem ALONE (self-contained), and exactly one option may be defensible per item.
- Follow any '[요청 조건]' block (난이도, 시험 시간, 문제 유형별 개수) and size the parts so the total stays 100점.
- Do NOT add any school/brand name, motto, or institution unless the request explicitly provides one.
```

**Output contract (what the renderer parses):** title `# `, meta line with `총 N문항`
`M분` `100점`, `## 배점표` table (header contains `파트`, ranges like `1~6`),
parts `## P1.` …, items `**N. label [N점]**` + stem + quoted example line +
`A)`…`E)` option lines, `★Killer`, passages `### Title — tag`, `## 정답표`
grouped (`**P1.** 1. A …`), `## 정밀 해설지` cards (`**N. 정답 A**` + 핵심 + 오답
체크). Server pipeline: `buildExamModel()` (`src/exam/parseExam.ts`) → JSON →
`scripts/exam_pdf.py` (WeasyPrint).

### 1B. 단어장 (Vocabulary) — SYSTEM prompt

> Tier: **standard (Sonnet)**. `max_tokens`: ~8000. temperature: 0.5–0.7.

```
You are a vocabulary-book author who turns a learner's word list into a clean study word list (단어장). Write fresh example sentences every time — never copy them from any source.

Input handling:
- The user's input is the list of target words (one per line or comma-separated). Create exactly one entry per word, preserving the user's order.
- If the user gives a topic/theme instead of an explicit list, generate [단어 수] useful words for that topic.
- If a '단원/주제' is provided, choose each word's sense to fit that context.

Entry format — keep it simple, EXACTLY this, with NO extra fields, labels, colors, or boxes:
- Line 1: '**N · word** [phonetic] · 품사 — 핵심 뜻' — end the line with two trailing spaces (Markdown hard line break).
- Line 2: one natural English example sentence — also end with two trailing spaces.
- Line 3: its Korean translation.
- Put a blank line between entries.
- Default to a single flat numbered list. Add a '## 주제' section heading only if the words clearly span distinct themes.

American English only:
- American spelling (vapor, color, analyze — never vapour/colour/analyse).
- American (rhotic) IPA in square brackets: ɚ, ɝ, oʊ, eɪ, ɑː, æ, etc. Never British/non-rhotic.
- 품사 in Korean (명사, 동사, 형용사, 부사, 전치사 …); 뜻 and 해석 in Korean and concise.

Example-sentence quality (like a real published vocabulary book):
- Natural, complete sentences where context makes the word's meaning clear; grammatically correct; helper words no harder than the headword; exactly one example per word.

Follow any '[요청 조건]' block (단원/주제, 단어 수, 누가 볼까요 등).
Do NOT add any school/brand label unless the request explicitly provides one.
```

**Output contract:** optional `# Title`, optional `## 주제` sections, entries
`**N · word** [ipa] · 품사 — 뜻` / example / translation. Server pipeline:
`scripts/vocab-pdf.mjs` (Chromium HTML→PDF).

### 1C. Other modules

학습지·퀴즈·학습노트·수업지도안·이력서·자기소개서·소설·엑셀 each have a system
prompt in [`src/modules.ts`](../src/modules.ts) (`MODULES[].systemPrompt`). They
follow the same call shape; lift the string verbatim. For document modules the
output is clean Markdown rendered by `scripts/export.mjs`.

---

## 2. Composing the USER turn

Build the user message from the form, then append a `[요청 조건]` block the system
prompt knows how to read:

```
<the user's free-text topic or, for vocab, the word list>

[요청 조건]
- 과목: 고2 영어
- 난이도: 중
- 시험 시간: 60분
- 문제 유형별 개수: 객관식 12, 서술형 4
- 출제 범위: 비교급·연결어, 교재 Unit 3–4
```

- Validate + clamp the option values server-side before composing (see
  `src/validation.ts`).
- The chosen 난이도 and input length also pick the model tier
  (`routeModel(moduleId, difficulty, inputLen)` in `src/routing.ts`).
- When the user uploads source material, prepend it and add a 자료 기반 directive
  ("Build the exam strictly from the material below.").

---

## 3. Model & parameters

| Module | Tier (src/routing.ts) | max_tokens | temp |
|---|---|---|---|
| exam (시험지) | heavy (Opus) — `상` always Opus | ~16000 | 0.6–0.8 |
| cover-letter, creative-writing | heavy (Opus) | 8000–12000 | 0.7–0.9 |
| vocabulary, worksheet, quiz, study-notes, ppt, resume, lesson-plan, excel | standard (Sonnet) | 4000–10000 | 0.4–0.7 |
| **review / QA passes** | **heavy (Opus)** | 6000–10000 | 0.2–0.4 |

- Routing rule: 난이도 `상` → Opus; very large input (>12k chars) → at least Opus.
- Use **streaming** (`client.messages.stream`) for exams/long artifacts so the UI
  shows progress; the PDF is built after the stream completes.
- Keep the API key server-side only (never ship it to the browser).

---

## 4. Final-review (QA) protocol — run BEFORE publishing an exam

The nine adversarial review prompts live verbatim in
[`scripts/exam-review-protocol.md`](../scripts/exam-review-protocol.md). Run them
as **separate** `messages.create()` calls (system = one review prompt, user = the
exam Markdown, plus the textbook pages when available).

- Recommended order: **1 → 3 → 2 → 6 → 5 → 4 → 7 → 8 → 9**. Short on time? Run **9
  alone** (4-stage meta-verification) as a substitute for 1–3.
- Always run **1, 2, 3, 9** as independent calls (correctness/uniqueness/grammar)
  — that is where defects hide.
- After collecting defects, send a **fixer** call: give the model the exam + the
  defect list and ask it to apply only the 치명/중대 fixes and return the corrected
  Markdown; then re-render. (This pass is verified to catch real defects — in
  testing it found a double-answer grammar item and an ambiguous distractor.)

Capstone (prompt 9), used as the single QA pass when time-boxed:

```
Run a four-stage adversarial verification of this entire exam. Move through every stage explicitly; do not skip self-doubt.

Stage 1 — 검토: Solve every item from scratch as a top student would, recording your answer and your reasoning from the passage/rule.
Stage 2 — 자기 의심: For every item where you matched the key, actively try to prove yourself wrong — find a reading under which a different option is correct. For every mismatch, assume YOU are wrong first and re-derive.
Stage 3 — 반박: Play a 1등급 student who paid for this exam and is furious about any defect. Write that student's strongest objections to every weak item.
Stage 4 — 재검토: Resolve each objection — defend the item with evidence, or concede it's defective and give a surgical fix.

Deliver: (1) every item where your independent answer differs from the printed key, with resolution; (2) a defect list ranked by severity (치명/중대/경미); (3) the minimal fix for each. Cite the passage or textbook rule for every judgment. Respond in Korean. Do not flatter the exam — your job is to find what's broken.
```

(The other eight prompts — self-containment, answer-uniqueness, textbook-rule
conformance, native-English copy edit, answer-key bias, cross-item leakage,
difficulty calibration, Korean-text quality — are in the protocol file. When you
receive the academy's textbook + prompts, attach the textbook so prompts 1 and 3
grade against the textbook's own stated rules.)

---

## 5. Minimal SDK wiring (TypeScript)

```ts
import Anthropic from "@anthropic-ai/sdk";
import { buildExamModel } from "./src/exam/parseExam.js";
import { MODELS } from "./src/routing.js"; // { heavy, standard, light }

const client = new Anthropic(); // ANTHROPIC_API_KEY from env, SERVER-SIDE ONLY

// 1) Generate (streamed)
const stream = client.messages.stream({
  model: MODELS.heavy,
  max_tokens: 16000,
  temperature: 0.7,
  system: EXAM_SYSTEM_PROMPT,          // §1A
  messages: [{ role: "user", content: composeUserTurn(form) }], // §2
});
const markdown = (await stream.finalMessage()).content
  .filter((b) => b.type === "text").map((b) => b.text).join("");

// 2) Render (no LLM): markdown -> model -> PDF
const model = buildExamModel(markdown, {
  title: form.title, difficulty: form.difficulty, scope: form.scope,
  timeMinutes: form.time,           // brand/motto/titleLatin: only if user set them
});
// spawn python3 scripts/exam_pdf.py --in <model.json> --out exam.pdf

// 3) QA — independent review (capstone)
const review = await client.messages.create({
  model: MODELS.heavy, max_tokens: 8000, temperature: 0.3,
  system: REVIEW_CAPSTONE_PROMPT,    // §4 / protocol #9
  messages: [{ role: "user", content: `검토 대상 시험지:\n\n${markdown}` }],
});

// 4) Apply 치명/중대 fixes (fixer call), then re-render before publishing.
```

For vocabulary, swap the system prompt (§1B), drop the exam parse step, and pipe
the Markdown to `scripts/vocab-pdf.mjs`.

---

## 6. Operational notes

- **Self-containment first.** Every keyed answer must be provable from the printed
  page; never rely on textbook text that was cut. The review protocol enforces this.
- **Neutral by default.** No school/brand/motto on covers unless the user supplies
  one. (시험지 `--brand/--motto/--title-latin`, 단어장 `--brand/--subtitle`.)
- **Print quality.** PDFs are A4, fonts embedded from `fonts/`, and verified to
  read well in **both color and grayscale** (B&W laser printing).
- **Cost guardrails.** Per-IP rate limits, daily caps, input-length caps already
  live in `src/rateLimit.ts` / `src/validation.ts`; keep them on the API route.
- **Abuse / safety.** System prompts are fixed server-side; user input is only the
  user turn, so module behavior stays contained.
```
