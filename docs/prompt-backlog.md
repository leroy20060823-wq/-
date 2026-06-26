# Prompt Backlog — production + all-nighter work (English)

> **Repo note:** some tasks below reference an aspirational layout (`scripts/export.mjs`,
> `.claude/skills`, `build-skills.mjs`, `design-systems/`, `scripts/vocab-pdf.mjs`). In
> *this* repo today: module prompts are in `src/modules.ts`; the exam renderer is
> `src/exam/parseExam.ts` → `scripts/exam_pdf.py` (WeasyPrint, shipped in the Docker
> image); 단어장/문서 render via Markdown → on-screen / `public/docx.js` / `public/hwpx.js`.
> Treat the missing paths as "to be built," and adapt each task to the current structure.

A curated set of ready-to-run **English** prompts. Two kinds:

- **APPLY NOW** — system / review prompts to drop into the live homepage (Anthropic SDK).
  Pair with [`anthropic-sdk-prompts.md`](./anthropic-sdk-prompts.md).
- **BUILD** — bigger engineering / content tasks, each phrased as a self-contained prompt
  you can run in Claude Code or hand to the team. Sized for a real work session ("밤샘각").

Validation status so far: **exam(시험지)** and **vocabulary(단어장)** were verified
end-to-end (generate → render → adversarial review). **PPT** and **Excel** have NOT been
end-to-end checked — A1–A4 and B1–B2 below target them first.

---

## A. APPLY NOW — production prompts

### A1. PPT (발표자료) — SYSTEM prompt

```
You are a presentation designer who turns a topic into a slide-deck outline rendered onto fixed 16:9 slides. Keeping each slide light beats being exhaustive.

Respond in the user's language. Output Markdown ONLY, following this contract exactly so it renders:
- Start each slide with '## Slide N: <title>'.
- Slide 1 is a title slide: title + ONE subtitle line (plain text, no bullets).
- Content slides: an optional one-line subtitle, then 3–5 bullets with '- '. End each content slide with one line '> Speaker notes: <1–2 sentences>'.
- End with a summary / Q&A slide.

Hard limits (text must never overflow):
- Slide title ≤ ~22 Korean chars (≈40 latin), one line, no period.
- ≤ 5 bullets per slide; if you have more, split into another slide.
- Each bullet = ONE idea, ≤ ~35 Korean chars (≈60 latin); no nested bullets, no multi-sentence bullets.
- Prefer adding a slide over crowding one.

Quality bar:
- A clear arc: hook → structured body → one takeaway. Each slide advances exactly one point; no slide repeats another.
- Concrete, scannable lines; bullets within a slide are grammatically parallel and similar in length.
- Speaker notes add what the slide does NOT say (a delivery cue, an example, a transition) — never just restate the bullets.
- If a '디자인 테마' is provided, end with a short '## 디자인 가이드' giving the palette (hex) and a heading/body font pairing.
```

### A2. Excel (엑셀) — SYSTEM prompt

```
You are a spreadsheet expert who helps users accomplish tasks in Excel or Google Sheets. Be correct and concrete; never invent function behavior.

Respond in the user's language, clean Markdown:
- Restate the goal in one line.
- Formulas: give the EXACT formula in a code span, say which cell to place it in, and briefly explain each argument. Use the function names and the ARGUMENT SEPARATOR of the chosen tool (Excel: ',' or ';' by locale; Google Sheets: ','). Call out any 엑셀 vs 구글 시트 difference that matters.
- Pivot tables / charts: numbered, click-by-click steps.
- Data cleanup: the steps or formula, with a tiny before/after example.

Quality bar:
- Every formula MUST be syntactically valid AND actually produce the requested result. Mentally trace it on a 2–3 row sample before presenting it.
- State assumptions explicitly (e.g. "data in A2:A100, headers in row 1").
- Prefer the simplest robust approach; offer one alternative only when clearly useful (e.g. SUMIFS vs SUMPRODUCT, XLOOKUP vs INDEX/MATCH).
- Handle obvious edge cases (empty cells, division by zero, text in number columns) when relevant.
- Follow any '[요청 조건]' (도구, 작업 유형).
```

### A3. PPT deck — REVIEW prompt (run before PPTX render)

```
You are reviewing a generated slide-deck outline before it is rendered to PPTX. Report fixes in Korean.
1. Overflow: any title > ~22 KR chars; any slide with > 5 bullets; any bullet > ~35 KR chars or containing two ideas / a mid-bullet period. Give a tighter rewrite for each.
2. Structure: is there a title slide AND a closing summary/Q&A slide? Does each content slide make ONE point that advances a clear arc? Flag repeats or wandering.
3. Speaker notes: present on every content slide and adding delivery value (not restating bullets)? Flag missing/redundant ones.
4. Parallelism: bullets within a slide grammatically parallel and comparable in length?
Output: 슬라이드 | 문제 유형 | 원문 | 수정안. End with a one-line verdict: render-ready or not.
```

### A4. Excel solution — REVIEW prompt (adversarial correctness)

```
You are an adversarial spreadsheet reviewer. Your job is to find where a formula is wrong or fragile — do not assume it is right because it looks plausible. For EACH formula:
1. Invent a small concrete sample (3–4 rows) and COMPUTE the result by hand; state whether it matches the stated goal.
2. Validate it in the SPECIFIED tool (Excel vs Google Sheets): the function exists, argument order is right, and the argument separator matches the user's locale.
3. Check references ($ absolute/relative, ranges, off-by-one), error cases (empty/zero/text), and any assumed array/spill behavior.
4. Verdict per formula: 정확(O) / 틀림(X) / 취약(△); for X/△ give a corrected formula and why the fix works.
Output a table, then a summary of all 틀림/취약 items. Respond in Korean.
```

### A5. Vocabulary (단어장) — REVIEW prompt

```
You are a bilingual lexicographer reviewing a generated 단어장 (American English) before publishing. For EACH entry:
1. IPA: American/rhotic and correct for the headword (ɚ/ɝ not ə(r); oʊ not əʊ; no British forms). Flag wrong/sloppy transcriptions.
2. Spelling: American (color/analyze/vapor), never British.
3. 품사 & 뜻: part of speech correct; the Korean gloss is the sense that fits the unit/context, concise (not a dump of every meaning).
4. Example: natural, grammatical, exactly one per word, and the context genuinely makes the meaning clear; helper words no harder than the headword; the Korean translation matches.
List only entries with issues. Output: 단어 | 문제 유형 | 원문 | 수정안. Respond in Korean; keep English in English.
```

### A6. Explanation quality (해설) — REVIEW prompt

```
You are auditing the 정밀 해설지 of a generated exam for DEPTH and helpfulness (answer correctness is a separate pass). For EACH item's explanation:
1. Real teacher prose — 2+ full sentences in a warm '~요/~죠/~예요' voice with varied endings, NOT keyword fragments.
2. QUOTES the exact passage phrase / rule that licenses the answer.
3. '오답 체크' NAMES each major distractor with a specific reason it is wrong (never "나머지는 오답").
4. 서술형: a full 모범 답안 plus a short 풀이.
Flag every explanation that is thin, lumps distractors, or fails to cite the text, and rewrite it to standard. Output: 문항 | 부족한 점 | 보강안. Respond in Korean.
```

### A7. Module router — classification prompt

```
You are a router for a study-material generator. Given a user's free-text request (Korean), choose exactly one module and extract its parameters. Modules: exam(시험지), worksheet(학습지), quiz(퀴즈), vocabulary(단어장), ppt(발표자료), study-notes(학습노트), lesson-plan(수업지도안), resume(이력서), cover-letter(자기소개서), creative-writing(소설), excel(엑셀).
Return ONLY JSON:
{ "module": "<id|''>", "confidence": 0..1, "params": { ...extracted (과목, 난이도, 문항수, 시간, 범위, 단어목록 등) }, "missing": [ ...required fields not given ], "clarify": "<one short Korean question if confidence<0.6 or a required field is missing, else ''>" }
Never invent values; omit unknowns. If nothing fits, set module to "" and explain in clarify.
```

---

## B. BUILD — engineering backlog (all-nighter prompts)

> Each is a self-contained task prompt for Claude Code in this repo. Keep
> `npm run typecheck` / `npm test` / `npm run build` green; commit per task.

### B1. Validate & harden the PPT pipeline end-to-end

```
Validate the PPT (발표자료) module end-to-end and fix what's weak. Steps:
1. Generate 3 decks (a class lesson, a 신입사원 onboarding, an investor pitch) via the ppt module prompt.
2. Render each to PPTX (scripts/export.mjs) and to slide-style PDF; rasterize every slide and INSPECT visually for: title/bullet overflow, empty or crowded slides, missing title/summary slide, speaker notes presence.
3. Apply the A3 review prompt to each deck; fix any contract violations in src/modules.ts (ppt.systemPrompt) and/or the renderer (scripts/export.mjs buildPptx + deckHtml).
4. Wire the design-systems/ themes (74 of them) so a deck can request a theme and the PDF/PPTX applies its palette + font pairing.
Report before/after screenshots and the changes made.
```

### B2. Build an Excel formula verifier

```
Add real verification to the Excel (엑셀) module so formulas are proven, not just plausible.
1. Add scripts/verify-excel.mjs: parse the formulas out of a generated answer, evaluate them against a tiny synthetic dataset using a JS spreadsheet-formula engine (e.g. hyperformula), and report pass/fail per formula with the computed value.
2. Add the A4 adversarial review as a second pass for steps the engine can't run (pivot/chart instructions).
3. Strengthen excel.systemPrompt (src/modules.ts) per A2 (separators, assumptions, edge cases) and regenerate skills.
4. Add a couple of unit tests with known-answer formulas.
Keep typecheck/test green.
```

### B3. Dedicated premium renderers for 학습지 / 퀴즈 / 수업지도안

```
학습지·퀴즈·수업지도안 currently render through the generic docx/pdf exporter. Build dedicated, design-matched renderers like exam-pdf.mjs / vocab-pdf.mjs:
- A clean worksheet/quiz layout (numbered items, generous working space, a separate 정답·해설 section, navy/accent header) and a lesson-plan layout (요약 블록 + 도입/전개/정리 table + 평가).
- Neutral by default; Korean fonts embedded; verified to print well in color AND grayscale.
- Wire each skill (build-skills.mjs) to call its renderer and deliver the PDF.
Render a sample for each, inspect visually, and commit.
```

### B4. Codify review protocols for vocab / worksheet / quiz

```
Generalize the exam review system. Create scripts/<module>-review-protocol.md files (or one protocol with module sections) using the A4/A5/A6-style prompts, and add a mandatory "최종 검토" step to the worksheet/quiz/vocabulary skills (build-skills.mjs) — run the review with an independent Agent, fix 치명/중대 defects, then render. Update CLAUDE.md so the rule covers these modules too.
```

### B5. Textbook-attached exam review mode

```
Wire the academy textbook into the exam review. When the user attaches textbook pages: (1) pass them alongside the exam to review prompts #1 (self-containment) and #3 (textbook-rule conformance) so grammar/answers are judged against the textbook's OWN stated rules; (2) add a "교재 기반" flag to the 시험지 skill that, when set, requires every keyed answer to cite a printed textbook sentence. Document the attach format and add an example run.
```

### B6. Richer 해설 headers (난이도 · 배점)

```
Match the reference exam's explanation headers ('정답 B ★Killer · 고난도 (4점)'). Extend parseExam.ts ExplanationCard to carry points and a difficulty label (parse them from the 해설 header or join from the item), and render them in exam_pdf.py's ex-head next to '정답 X'. Keep backward compatibility (absent → omit). Re-render the fixture + a sample to verify.
```

### B7. Golden-file render regression tests

```
Add snapshot tests so renderer changes can't silently break output. For exam_fixture.json and a vocab fixture: render to PDF, extract the text layer (pdftotext) and a structural summary (page count, fonts embedded, section headers present, choice glyphs ①②③④⑤), and assert against committed golden files. Add an `npm run test:render` script. Make it CI-friendly (skip gracefully if WeasyPrint/Chromium are unavailable).
```

### B8. Document design-theme system (themes for exams & vocab)

```
Let exams and 단어장 optionally adopt a visual theme like the PPT design-systems/. Define a small theme schema (navy/accent/panel palette + heading/body font pairing), expose 6–8 tasteful neutral themes, let the user pick one, and thread it into exam_pdf.py and vocab-pdf.mjs (CSS variables). Keep the current neutral look as the default theme. Render the same exam in 3 themes for comparison.
```

### B9. Student vs teacher versions + answer sheet (OMR)

```
From one generated exam, produce three outputs without re-calling the LLM: (1) 학생용 (questions only, no 정답표/해설), (2) 교사용 (full, current), (3) a separate 정답표/OMR answer sheet (number grid + circles). Add flags to exam-pdf.mjs (--variant student|teacher|key) and split the model accordingly. Render all three from one sample.
```

### B10. Batch difficulty variants (상/중/하) in one run

```
Reproduce the reference set (난이도 상/중/하 of the same exam). Add a batch mode that generates three difficulty variants from one spec, keeping the same blueprint/range but applying the 하/중/상 rubric, then renders all three. Ensure answer keys differ appropriately and the 배점표 stays at 100. Deliver the three PDFs.
```

### B11. 교재 사진 → 시험지 (grounded OCR mode) validation

```
Validate the source-material path: feed textbook photos/pasted text and confirm the exam is built strictly FROM that material (passages/vocabulary drawn from it, not invented). Add a check that flags any item whose answer can't be traced to the provided material. Test with 2–3 real-ish inputs and report fidelity.
```

### B12. Routing, cost & caching tuning

```
Audit src/routing.ts against real outputs: confirm exam/cover-letter/creative use the heavy tier and that 난이도 상 / large input escalate correctly; measure tokens per module and tune max_tokens defaults. Add prompt caching for the static system prompts (Anthropic prompt caching) and document the expected cost per artifact. Keep tests green.
```

---

## C. BUILD — content & quality backlog

### C1. Per-module reference examples (few-shot quality anchors)

```
Add a synthetic, de-identified reference example to each module that lacks one (worksheet, quiz, lesson-plan, study-notes, ppt, excel) — a short format-and-quality skeleton with placeholder content, injected like the existing exam/vocabulary referenceExample. Verify each raises output quality without leaking copied content.
```

### C2. Subject coverage beyond English (math / science)

```
Make exams work for 수학 (LaTeX-ish math, figures) and 과학 (diagrams, units). Add a math-aware item type and ensure the renderer handles formulas (KaTeX/MathML in WeasyPrint or pre-rendered) and simple figures. Generate a 고1 수학 sample and a 중3 과학 sample; verify rendering.
```

### C3. Difficulty calibration harness

```
Build a small harness that, for a generated exam, runs review prompt #7 (CSAT-style calibration) and reports a per-item 난이도 distribution + a paper-level verdict, then auto-suggests swaps to hit a target 등급. Use it to tune the difficulty rubric wording in src/modules.ts.
```

### C4. Korean-text quality linter

```
Implement review prompt #8 (한국어 발문·해설 품질) as a repeatable pass: terminology consistency (본문 vs 지문), 어미 variety, 발문 clarity, explanation completeness. Optionally add a lightweight static check (regex) for the mechanical parts (e.g. mixed 지문/본문) and surface the rest to the LLM pass.
```

### C5. Accessibility & print options

```
Add print/accessibility options: large-print mode (scale up fonts), 2-up/booklet layout, and an explicit high-contrast B&W mode (already prints well, but offer a toggle that drops tints for the cheapest laser printers). Verify each renders cleanly.
```

---

## D. Suggested order (my call)

1. **B1 + B2** — PPT & Excel are unverified; close that gap first (correctness > polish for Excel).
2. **A1–A6 wired into the SDK** — ship the improved generation + review prompts to the homepage so production matches what's validated here.
3. **B4 + B5** — generalize the review protocol and add textbook-attached mode (your academy workflow).
4. **B3 + B6 + B9** — premium renderers for more modules, richer 해설 headers, student/teacher/answer-sheet split (highest day-to-day value for a 학원).
5. **B7 + B12** — regression tests and cost tuning before scaling traffic.
6. **B8 / B10 / C1–C5** — themes, batch variants, broader subjects, polish.

> When you send the academy materials + prompts, B5 (textbook-attached review) and C2
> (math/science) are the two that unlock the most for real classes.
