# All-Nighter Prompts — copy-paste blocks

> **Repo note:** these blocks were authored against an aspirational layout
> (`scripts/export.mjs`, `scripts/vocab-pdf.mjs`, `.claude/skills/`, `build-skills.mjs`,
> `design-systems/`). In *this* repo today: prompts live in `src/modules.ts`; the exam
> renderer is `src/exam/parseExam.ts` → `scripts/exam_pdf.py` (WeasyPrint, in the Docker
> image); documents render via Markdown → on-screen / `public/docx.js` / `public/hwpx.js` /
> `public/pptx.js`. Adapt each block to the current structure as you pick it up.

Each task below is **one self-contained block**. Copy a block → paste into Claude Code
(in this repo) → run. Order suggestion at the bottom. (Production system / review prompts
for the homepage SDK are in [`prompt-backlog.md`](./prompt-backlog.md) and
[`anthropic-sdk-prompts.md`](./anthropic-sdk-prompts.md).)

**Paste this once at the start of a session (shared context):**

```text
You are working in this repo: a study-material generator (시험지·단어장·학습지·퀴즈·PPT·엑셀 등).
- Modules & system prompts live in src/modules.ts. Skills are auto-generated from it via `npm run skills:build` into .claude/skills/ — never hand-edit skill files.
- Renderers: scripts/exam-pdf.mjs (→ src/exam/parseExam.ts → scripts/exam_pdf.py, WeasyPrint); scripts/vocab-pdf.mjs (Chromium); scripts/export.mjs (generic docx/pdf/hwpx/pptx/html).
- Exam review protocol: scripts/exam-review-protocol.md; project rule in CLAUDE.md.
- PDFs are A4, fonts embedded from fonts/, and MUST print well in color AND grayscale. Covers are neutral by default (no school/brand/motto unless the user supplies one). Output files go to outputs/ (git-ignored).
- Working discipline for every task: build → render → rasterize to PNG with headless Chromium (/opt/pw-browsers/chromium-*/chrome-linux/chrome, --no-sandbox, #page=N&zoom=page-fit) → INSPECT the image → adversarially review (spawn an independent Agent) → fix → re-verify → commit. Keep `npm run typecheck`, `npm test`, `npm run build` green. Commit per task.
```

---

## 1. PPT pipeline — validate & harden

```text
Validate the PPT (발표자료) module end-to-end and fix what's weak; it has never been visually verified.
1. Generate FIVE decks via the ppt system prompt: a middle-school science lesson (10 slides), 신입사원 onboarding (12), an investor pitch (15), a 학부모 설명회 (8), and a deliberately content-heavy topic to force overflow ("머신러닝의 모든 것", 20).
2. Render each to PPTX and slide-style PDF (scripts/export.mjs). Rasterize EVERY slide to PNG and inspect for: title overflow (> ~22 KR chars), > 5 bullets, bullets that wrap past one line or pack two ideas, empty/crowded slides, missing title/summary slide, missing or duplicate speaker notes.
3. Run the PPT review prompt (docs/prompt-backlog.md A3) on each deck via an independent Agent.
4. Fix root causes: tighten ppt.systemPrompt where the model overflows; fix scripts/export.mjs (buildPptx, deckHtml) where the RENDERER clips text (auto-shrink, wrapping, max-bullet guard). Re-generate and re-inspect until all five are clean.
5. Wire the design-systems/ themes: let a deck request a theme name; map its palette + heading/body font pairing into both the PPTX builder and the slide-PDF CSS. Render one deck in 3 themes.
Done when: all five decks render with zero overflow in PPTX and PDF (before/after screenshots), the review agent returns no 중대 issues, and a themed deck renders correctly. Commit with screenshots referenced.
```

## 2. Excel/Sheets — real formula verifier

```text
The 엑셀 module emits formulas the model only BELIEVES are correct — the biggest correctness risk. Add real verification.
1. Add scripts/verify-excel.mjs: extract every formula (code spans starting with `=`) from a generated answer, evaluate each against a small synthetic dataset using a JS spreadsheet engine (hyperformula or equivalent), and print: formula | cell | computed value | matches goal? (O/X) | note. Flag functions the engine can't evaluate instead of passing silently.
2. Generate 8 representative tasks (월별 합계+차트, SUMIFS 조건집계, VLOOKUP→XLOOKUP, 중복 제거, 텍스트 분리, 날짜 차이, 피벗 안내, IFERROR) and run the verifier; record failures.
3. For steps the engine can't run (pivot/chart click-steps), run the adversarial Excel review (docs/prompt-backlog.md A4) via an Agent — it must hand-compute on a tiny sample, not eyeball.
4. Strengthen excel.systemPrompt wherever the verifier exposes a recurring failure; regenerate skills.
5. Add unit tests with KNOWN-ANSWER formulas (e.g. a SUMIFS over a fixed 5-row table returns the known total).
Done when: the verifier runs all 8 tasks, every shipped formula is proven O or explicitly flagged for human review, and the known-answer tests pass. Report the failure modes found and fixed.
```

## 3. Review protocol — generalize into a reusable QA engine

```text
Only 시험지 has mandatory adversarial review; 단어장·학습지·퀴즈·PPT·엑셀 have none.
1. Create scripts/review/<module>.md (or one scripts/review-protocols.md with sections) reusing the A3–A6 prompts from docs/prompt-backlog.md: a correctness/self-containment pass, a uniqueness/accuracy pass, and a language/format pass per module.
2. Add a runner scripts/review.mjs --module <id> --in <artifact.md> that spawns the passes as INDEPENDENT reviewers (Agent; in production these map to separate messages.create calls), collects a defect list ranked 치명/중대/경미, and writes a JSON report.
3. Insert a mandatory "최종 검토" step into the worksheet/quiz/vocabulary/ppt/excel skills (build-skills.mjs), mirroring the exam skill: review → fix 치명/중대 → render → report. Regenerate skills.
4. Update CLAUDE.md so the "제작 후 항상 검토" rule covers these modules. Scale depth to the artifact (don't run a 9-pass on a 5-word vocab list).
Done when: each module has a runnable review, the skills enforce it before delivery, and you've shown it catching ≥1 real defect per module. Commit with the sample reports.
```

## 4. Dedicated premium renderers for 학습지 / 퀴즈 / 수업지도안

```text
These three render through the generic export.mjs and look ordinary next to exam/vocab. Build dedicated renderers.
1. scripts/worksheet-pdf.mjs (학습지 + 퀴즈): clean A4 — neutral header band, numbered items with generous working space, a clearly separated 정답 및 해설 section, optional difficulty/points tags. Reuse the font-embed + grayscale-safe approach from vocab-pdf.mjs.
2. scripts/lesson-pdf.mjs (수업지도안): summary block (과목·대상·차시·시간·학습목표), 준비물 line, the 도입/전개/정리 table (단계|교사 활동|학생 활동|시간|자료·유의점), then 평가 + 지도상 유의점. Stage times must visibly sum to the total.
3. Parse the modules' Markdown into these layouts with tolerant parsers (like parseExam.ts); wire each skill (build-skills.mjs) to call its renderer and deliver the PDF; neutral branding by default.
4. Render a sample for each (중2 영어 학습지, 5-question 과학 퀴즈, 중학 영어 비교급 수업지도안), rasterize, inspect in color AND grayscale, iterate until clean.
Done when: three new renderers exist, skills use them, and samples print cleanly in color and B&W (screenshots). Commit with samples noted.
```

## 5. Exam — 학생용/교사용/OMR split + richer 해설 headers

```text
One exam should yield several artifacts without re-calling the LLM, and the 해설 header should match the reference ('정답 B ★Killer · 고난도 (4점)').
1. Add --variant student|teacher|key to scripts/exam-pdf.mjs (and the exam model): student = questions only (drop 정답표 + 해설); teacher = full (current); key = standalone answer sheet / OMR grid (number cells + ①②③④⑤ circles + 서술형 채점란). Generate all three from one model, no extra LLM call.
2. Extend ExplanationCard (parseExam.ts) to carry points and a difficulty label; parse from the 해설 header or join from the matching item. Render next to '정답 X ★Killer' in exam_pdf.py ex-head (e.g. '정답 ② ★Killer · 고난도 (6점)'). Backward compatible (absent → omit).
3. Re-render the fixture + the 고2 sample; verify the three variants and the richer header by rasterizing cover, a body page, and the 해설 page.
Done when: three variants render from one generation, the 해설 header shows answer+killer+difficulty+points, tests/typecheck pass. Commit with screenshots of each variant.
```

## 6. Textbook-attached grounded mode + textbook-rule review

```text
The academy will provide a textbook + their own prompts. Exams must be built strictly from that material, graded against the textbook's OWN rules.
1. Add a "교재 기반(grounded)" path to the 시험지 skill + generation: when textbook pages/text are attached, every passage/vocab/answer must trace to a printed textbook sentence; the prompt gets a strict "build ONLY from the material below" directive (mirror the existing source grounded directive).
2. Implement an attach contract (how textbook text/images reach the prompt) and a post-gen check that FLAGS any item whose answer can't be traced to the provided material.
3. Wire review prompts #1 (self-containment) and #3 (textbook-rule conformance) from scripts/exam-review-protocol.md to receive the textbook and judge against its rules. Add a worked example with a small FAKE textbook so the flow is reproducible without copyrighted material.
Done when: a grounded exam is demonstrably built from supplied material (no invented facts), out-of-material items are flagged, and review #1/#3 cite textbook sentences. Commit with the worked example.
```

## 7. Math & science exam support (formulas, figures, units)

```text
Today's exams assume prose subjects. Add 수학/과학 support.
1. Add a math-aware item type: item content can carry inline/block math, rendered in WeasyPrint via KaTeX-to-MathML or pre-rendered SVG (pick the most reliable path in WeasyPrint and document it). Verify Hangul + math render together without tofu.
2. Add minimal figure support (coordinate plane / bar chart / labeled diagram) from a compact spec, rendered as SVG into the item.
3. Teach the exam prompt the math/science conventions (수식 표기, 단위, 그림 참조) and add a 수학·과학 reference example.
4. Generate a 고1 수학 (함수·그래프) and a 중3 과학 (전기·단위) sample; rasterize and verify every formula/figure renders correctly in color and grayscale.
Done when: math + figures render correctly inside the exam layout, the two samples look like real 내신, and nothing overflows. Commit with screenshots.
```

## 8. Batch difficulty variants (상/중/하) from one spec

```text
The reference set shipped 난이도 상/중/하 of the SAME exam. Reproduce as a one-command batch.
1. Add a batch mode (--levels 하,중,상 on exam-pdf.mjs or a wrapper) that, from one spec, generates three variants sharing the blueprint/문항 범위 but applying the 하/중/상 rubric (vocabulary level, inference ratio, distractor subtlety, killer count).
2. Ensure each variant keeps the 배점표 at 100, has an internally consistent 정답표, and answer keys legitimately differ where items differ.
3. Render all three, rasterize the cover + a body page of each, and confirm difficulty actually escalates (not just a label) by running review prompt #7 (calibration) on each.
Done when: one command yields three coherent, genuinely-different-difficulty PDFs. Commit with the three samples and the calibration summary.
```

## 9. Golden-file render regression suite + CI gate

```text
Renderer/parse changes (e.g. 4지선다→5지선다) can silently break output; there are no render-level tests.
1. Add `npm run test:render`: for scripts/exam_fixture.json and a new vocab fixture, render to PDF and extract a STABLE structural summary — page count, embedded fonts (pdffonts), section headers present, choice glyphs (①②③④⑤), and normalized text layer (pdftotext). Commit golden files; assert against them.
2. Make it resilient: if WeasyPrint/Chromium/poppler are unavailable, skip with a clear message rather than fail.
3. Add a tiny visual-diff option (rasterize page 1, compare to a golden PNG within tolerance) for the cover.
4. Document intentional regeneration (UPDATE_GOLDENS=1).
Done when: a deliberate breaking change to letter_for or the parser makes test:render fail loudly, and an intentional update regenerates goldens cleanly. Commit the suite + goldens.
```

## 10. Document design-theme system (neutral themes for exam & vocab)

```text
Exams/vocab have one fixed look; the PPT side already has design-systems/. Offer tasteful neutral theme choice for documents.
1. Define a minimal theme schema { navy, accent, panel, pageBg, ink, gray, headingFont, bodyFont }. Author 8 neutral premium themes (classic navy/brass = current default; charcoal/teal; forest/cream; burgundy/stone; slate/amber; ink/sage; …), each verified to grayscale well.
2. Thread --theme <name> into exam_pdf.py (CSS variables already exist at :root) and vocab-pdf.mjs; keep the current look as the default theme.
3. Render the same exam + the same 단어장 in 3 themes each; rasterize and confirm all read cleanly in color and B&W.
Done when: documents can switch theme via one flag, defaults unchanged, every theme passes the grayscale check. Commit with comparison screenshots.
```

## 11. Production service: generate → render → review → fix

```text
The homepage uses @anthropic-ai/sdk. Build the validated flow as a clean server service using the prompts in docs/anthropic-sdk-prompts.md.
1. Implement a server module that per module id runs: compose user turn → stream generation (correct model tier from src/routing.ts) → parse/render → (for exams) run the capstone review as a SEPARATE call → if 치명/중대 found, run a fixer call that returns corrected Markdown → re-render → return the PDF + a short QA summary.
2. Add prompt caching for the static system prompts (Anthropic prompt caching) and record token usage per stage; expose a per-artifact cost estimate.
3. Robust error handling + timeouts (WeasyPrint/Chromium failure degrades gracefully: deliver Markdown + a clear message); keep the API key server-side.
4. Add an integration test that mocks the SDK and asserts the full pipeline shape.
Done when: one server entry point turns a form payload into a reviewed PDF + QA summary, with caching and graceful failure, and the integration test passes. Commit with the measured cost numbers.
```

## 12. Korean-text quality linter (발문·해설)

```text
Review prompt #8 (한국어 품질) isn't enforced; mechanical issues recur (mixed 지문/본문, repeated 어미, thin explanations).
1. Add scripts/ko-lint.mjs: regex/heuristics for terminology consistency (flag mixing 지문 vs 본문 within one paper), repeated sentence endings in 해설 (e.g. every line ending '적절.'), and 발문 missing a clear instruction verb.
2. Hand non-mechanical judgments (explanation completeness, naturalness) to the #8 review prompt via an Agent; merge both into one report.
3. Run on the 고2 sample and the 영읽쓰B samples; fix recurring issues at the prompt level in src/modules.ts and re-test.
Done when: the linter flags real issues on existing samples, the prompt fixes reduce them on regeneration, and the pass is wired into the exam review step. Commit with before/after counts.
```

## 13. Reference examples (few-shot anchors) for every module

```text
Only exam/vocabulary/resume/cover-letter carry a referenceExample; others drift in quality.
1. Author a SYNTHETIC, de-identified format-and-quality skeleton for each missing module (worksheet, quiz, study-notes, lesson-plan, ppt, excel) — generic placeholder content only, never copied — injected like the existing ones (under "참고 예시 (스타일·품질 기준)").
2. Regenerate skills. For each module, generate one artifact WITH and WITHOUT the example and compare quality (structure, tone, completeness) — keep the example only where it measurably helps.
3. Verify no example leaks real content and that prompts still demand brand-new content each run.
Done when: each module has a vetted reference example (or a documented reason it's omitted) and the before/after shows improvement. Commit with comparisons summarized.
```

## 14. Accessibility & print options

```text
학원 printers vary; add print/accessibility options across the renderers.
1. Add: large-print (scale fonts up a notch with the QA text-fit loop still active), 2-up / booklet imposition for exams, and an explicit high-contrast B&W mode (drop tints/panels to pure black-on-white for the cheapest laser printers).
2. Verify by rendering the 고2 exam in every mode, rasterizing, and inspecting that nothing overflows and contrast is strong.
Done when: the three options work on exams (and large-print on vocab), each verified by screenshots. Commit with samples.
```

## 15. Eval harness + regression dataset

```text
To improve prompts safely you need to MEASURE quality over time, not eyeball one sample.
1. Assemble a small eval set: 10–15 specs across modules/subjects/difficulties (store the specs, not copyrighted outputs).
2. Build scripts/eval.mjs that generates each, runs the relevant review prompts, and scores: defect count by severity, self-containment rate, answer-uniqueness rate, explanation-depth pass rate, render success. Emit one JSON scorecard.
3. Snapshot a baseline; any prompt change can then be measured against it. Document how to read the scorecard.
Done when: `npm run eval` produces a scorecard, a baseline is committed, and a deliberate prompt regression visibly lowers a metric. Commit the harness + baseline.
```

---

## Suggested order

`2 → 1` (correctness: Excel then PPT) → `3` (QA engine) → `5 + 4` (exam variants + new
renderers) → `9 + 15` (regression + eval) → `6` (textbook mode) → `11` (production
service) → `7 / 8 / 10 / 12 / 13 / 14` (coverage & polish). Each block is independent;
pick up by re-reading the last commit.
