# All-Nighter Prompts — long, self-contained work briefs (English)

Each prompt below is a **complete brief** you can paste into Claude Code (in this
repo) or hand to a developer, and it will drive a full work session without
needing more context. They encode this project's working discipline: **build →
render → rasterize/screenshot → inspect visually → adversarially review → fix →
verify → commit.** Keep `npm run typecheck`, `npm test`, `npm run build` green and
commit per task.

Repo orientation (assume in every prompt):
- Modules & system prompts: `src/modules.ts`. Skills are auto-generated from it via
  `npm run skills:build` into `.claude/skills/` — never hand-edit skill files.
- Renderers: `scripts/exam-pdf.mjs` (→ `src/exam/parseExam.ts` → `scripts/exam_pdf.py`,
  WeasyPrint), `scripts/vocab-pdf.mjs` (Chromium), `scripts/export.mjs` (generic
  docx/pdf/hwpx/pptx/html).
- Exam review protocol: `scripts/exam-review-protocol.md`; project rule in `CLAUDE.md`.
- Production prompt packs: `docs/anthropic-sdk-prompts.md`, `docs/prompt-backlog.md`.
- PDFs are A4, fonts embedded from `fonts/`, must print well in **color AND grayscale**.
- Covers are **neutral by default** — no school/brand/motto unless the user supplies one.
- Output files go to `outputs/` (git-ignored). To "inspect visually", render to PDF,
  open it in headless Chromium (`/opt/pw-browsers/chromium-*/chrome-linux/chrome`,
  `--no-sandbox`) at `#page=N&zoom=page-fit`, screenshot, and Read the PNG.

---

## 1. Harden & validate the PPT (발표자료) pipeline end-to-end

Context: PPT generation has a solid slide contract in `src/modules.ts` (ppt) and
renders via `scripts/export.mjs` (`buildPptx` / `deckHtml`), but it has never been
visually verified or stress-tested. Decks can silently overflow, repeat slides, or
ship empty speaker notes.

Do this:
1. Generate **five** decks spanning real use: a middle-school science lesson (10
   slides), a 신입사원 onboarding (12), an investor pitch (15), a 학부모 설명회 (8),
   and a deliberately content-heavy topic to force overflow ("머신러닝의 모든 것",
   20). Use the ppt system prompt exactly.
2. Render each to **PPTX** and to **slide-style PDF**. Rasterize *every* slide to PNG
   and inspect visually for: title overflow (> ~22 KR chars), > 5 bullets, bullets
   that wrap past one line or pack two ideas, empty slides, missing title/summary
   slide, and missing/duplicate speaker notes.
3. Run the **PPT review prompt** (`docs/prompt-backlog.md` A3) on each deck via an
   independent `Agent`; collect violations.
4. Fix root causes: tighten `ppt.systemPrompt` where the model overflows, and fix
   `buildPptx`/`deckHtml` where the *renderer* clips text (auto-shrink, line
   wrapping, max bullet count guard). Re-generate and re-inspect until all five are
   clean.
5. Wire the **`design-systems/`** themes (74 of them): let a deck request a theme
   name; map its palette + heading/body font pairing into both the PPTX builder and
   the slide-PDF CSS. Render one deck in 3 themes side by side.

Constraints: 16:9, Korean fonts embedded so Hangul never tofus; keep the neutral
default theme. Done when: all five decks render with zero overflow in both PPTX and
PDF (verified by screenshots, before/after), the review agent returns no 중대 issues,
and a themed deck renders correctly. Commit with the before/after screenshots
referenced in the message.

---

## 2. Build a real Excel/Sheets formula verifier (correctness, not vibes)

Context: The 엑셀 module emits formulas the model *believes* are correct. There is
no execution check, so "plausible but wrong" formulas can ship. This is the single
biggest correctness risk in the platform.

Do this:
1. Add `scripts/verify-excel.mjs`: extract every formula from a generated answer
   (code spans starting with `=`), evaluate each against a small synthetic dataset
   using a JS spreadsheet engine (`hyperformula` or equivalent), and print a table:
   formula | placed-in cell | computed value | matches stated goal? (O/X) | note.
   Support both Excel and Google Sheets dialects where the engine allows; flag
   functions the engine can't evaluate instead of passing them silently.
2. Generate **8 representative tasks** (월별 합계 + 차트, 조건부 집계 SUMIFS,
   VLOOKUP→XLOOKUP 전환, 중복 제거, 텍스트 분리, 날짜 차이, 피벗 안내, IFERROR 처리)
   and run the verifier on each. Record which formulas fail.
3. For anything the engine can't run (pivot/chart click-steps), run the **A4
   adversarial Excel review** prompt via an `Agent` (it must hand-compute on a tiny
   sample, not eyeball).
4. Strengthen `excel.systemPrompt` per `docs/prompt-backlog.md` A2 (already partly
   applied: argument separators, assumptions, edge cases, mental trace) wherever the
   verifier exposes a recurring failure mode; regenerate skills.
5. Add unit tests (`src/excel/*.test.ts` or a script test) with **known-answer**
   formulas so regressions are caught (e.g. a SUMIFS over a fixed 5-row table must
   return the known total).

Constraints: don't add heavy deps beyond the formula engine; keep typecheck/test
green. Done when: the verifier runs all 8 tasks, every shipped formula is either
proven O by the engine or explicitly flagged for human review, and the known-answer
tests pass. Report the failure modes you found and fixed.

---

## 3. Generalize the exam review protocol into a reusable QA engine

Context: Only 시험지 has a mandatory adversarial review. 단어장·학습지·퀴즈·PPT·엑셀
have no enforced QA, so quality is uneven. The exam protocol
(`scripts/exam-review-protocol.md`) proved it catches real defects.

Do this:
1. Design a small, uniform QA spec: `scripts/review/<module>.md` files (or one
   `scripts/review-protocols.md` with per-module sections) each holding (a) a
   correctness/self-containment pass, (b) a uniqueness/accuracy pass, and (c) a
   language/format pass — reusing the A3–A6 prompts from `docs/prompt-backlog.md`.
2. Add a runner `scripts/review.mjs --module <id> --in <artifact.md>` that spawns the
   relevant passes as **independent** reviewers (document the Agent invocation
   contract; in production these map to separate `messages.create` calls), collects a
   defect list ranked 치명/중대/경미, and writes a JSON report.
3. Insert a mandatory "최종 검토" step into the worksheet/quiz/vocabulary/ppt/excel
   skills (`build-skills.mjs`), mirroring the exam skill: review → fix 치명/중대 →
   render → report fixes. Regenerate skills.
4. Update `CLAUDE.md` so the "제작 후 항상 검토" rule explicitly covers these modules.

Constraints: keep each module's review focused (don't run an exam-grade 9-pass on a
5-word vocab list — scale the depth). Done when: each module has a runnable review,
the skills enforce it before delivery, and you've demonstrated it catching ≥1 real
defect per module on a sample. Commit with the sample reports.

---

## 4. Dedicated premium renderers for 학습지 / 퀴즈 / 수업지도안

Context: These three render through the generic `scripts/export.mjs` (plain docx/pdf)
and look ordinary next to the exam/vocab renderers. Teachers print these daily.

Do this:
1. Build `scripts/worksheet-pdf.mjs` (covers 학습지 + 퀴즈): a clean A4 layout —
   neutral header band, numbered items with generous working space, a clearly
   separated `정답 및 해설` section, optional difficulty/points tags. Reuse the font
   embedding + grayscale-safe palette approach from `vocab-pdf.mjs`.
2. Build `scripts/lesson-pdf.mjs` (수업지도안): a summary block (과목·대상·차시·시간·
   학습목표), a 준비물 line, the 도입/전개/정리 table (단계 | 교사 활동 | 학생 활동 |
   시간 | 자료·유의점), then 평가 + 지도상 유의점. Stage times must visibly sum to the
   total.
3. Parse the modules' existing Markdown output into these layouts (tolerant parsers
   like `parseExam.ts`); wire each skill (`build-skills.mjs`) to call its renderer and
   deliver the PDF; keep neutral-by-default branding.
4. Render a sample for each (a 중2 영어 학습지, a 5-question 과학 퀴즈, a 중학 영어
   비교급 수업지도안), rasterize, inspect in **color and grayscale**, iterate until
   clean.

Done when: three new renderers exist, the skills use them, and the samples print
cleanly in both color and B&W (verified by screenshots). Commit with samples noted.

---

## 5. Exam: 학생용/교사용/OMR split + richer 해설 headers

Context: One exam should yield several artifacts without re-calling the LLM, and the
해설 header should match the reference ('정답 B ★Killer · 고난도 (4점)').

Do this:
1. Add a `--variant student|teacher|key` flag to `scripts/exam-pdf.mjs` (and the
   exam model): **student** = questions only (drop 정답표 + 해설), **teacher** = full
   (current), **key** = a standalone answer sheet / OMR grid (number cells + ①②③④⑤
   circles + 서술형 채점란). Generate all three from one model with no extra LLM call.
2. Extend `ExplanationCard` (`parseExam.ts`) to carry **points** and a **difficulty
   label**; parse them from the 해설 header or join from the matching item. Render
   them in `exam_pdf.py`'s ex-head next to '정답 X ★Killer' (e.g. '정답 ② ★Killer ·
   고난도 (6점)'). Keep backward compatibility (absent → omit).
3. Re-render the fixture + the 고2 sample; verify the three variants and the richer
   header by rasterizing the cover, a body page, and the 해설 page.

Done when: the three variants render correctly from one generation, the 해설 header
shows answer + killer + difficulty + points, and tests/typecheck pass. Commit with
screenshots of each variant.

---

## 6. Textbook-attached grounded mode + textbook-rule review

Context: The academy will provide a textbook + their own prompts. Exams must be built
strictly from that material, and the review must grade grammar/answers against the
**textbook's own stated rules**, not generic prescriptivism.

Do this:
1. Add a "교재 기반(grounded)" path to the 시험지 skill + exam generation: when
   textbook pages/text are attached, every passage, vocabulary item, and keyed answer
   must trace to a printed textbook sentence; the generation prompt gets a strict
   "build ONLY from the material below" directive (mirror the existing `source`
   grounded directive).
2. Implement an attach contract (how textbook text/images reach the prompt) and a
   post-gen check that **flags any item whose answer cannot be traced** to the
   provided material.
3. Wire review prompts **#1 (self-containment)** and **#3 (textbook-rule
   conformance)** from `scripts/exam-review-protocol.md` to receive the textbook and
   judge against its rules. Add a worked example with a small fake "textbook" so the
   flow is reproducible without real copyrighted material.

Done when: a grounded exam is demonstrably built from supplied material (no invented
facts), out-of-material items are flagged, and review #1/#3 cite textbook sentences.
Commit with the worked example.

---

## 7. Math & science exam support (formulas, figures, units)

Context: Today's exams assume prose subjects. 수학/과학 need formulas, simple figures,
and unit-aware items — a large unlock for a 학원.

Do this:
1. Add a math-aware item type: let item content carry inline/block math. Render it in
   WeasyPrint via KaTeX-to-MathML or pre-rendered SVG (pick the most reliable path in
   WeasyPrint and document the choice). Verify Hangul + math render together without
   tofu.
2. Add minimal figure support (a simple coordinate plane / bar chart / labeled
   diagram) generatable from a compact spec, rendered as SVG into the item.
3. Teach the exam prompt the math/science conventions (수식 표기, 단위, 그림 참조) and
   add a 수학·과학 reference example.
4. Generate a 고1 수학 (함수·그래프) and a 중3 과학 (전기·단위) sample; rasterize and
   verify every formula/figure renders correctly in color and grayscale.

Done when: math + figures render correctly inside the exam layout, the two samples
look like real 내신, and nothing overflows. Commit with screenshots.

---

## 8. Batch difficulty variants (상/중/하) from one spec

Context: The reference set shipped 난이도 상/중/하 of the *same* exam. Reproduce that
as a one-command batch.

Do this:
1. Add a batch mode (`--levels 하,중,상` on `exam-pdf.mjs` or a wrapper) that, from one
   spec, generates three variants sharing the blueprint/문항 범위 but applying the 하/중/상
   rubric (vocabulary level, inference ratio, distractor subtlety, killer count).
2. Ensure each variant keeps the 배점표 at 100, has an internally consistent 정답표,
   and that the answer keys legitimately differ where the items differ.
3. Render all three, rasterize the cover + a body page of each, and confirm the
   difficulty actually escalates (not just a label change) by running review prompt #7
   (calibration) on each.

Done when: one command yields three coherent, genuinely-different-difficulty PDFs.
Commit with the three samples noted and the calibration summary.

---

## 9. Golden-file render regression suite + CI gate

Context: Renderer/parse changes (e.g. the 4지선다→5지선다 switch) can silently break
output. There are no render-level tests.

Do this:
1. Add `npm run test:render`: for `scripts/exam_fixture.json` and a new vocab fixture,
   render to PDF and extract a **stable structural summary** — page count, embedded
   font list (`pdffonts`), presence of section headers, choice glyphs (①②③④⑤), and the
   text layer (`pdftotext`) normalized. Commit golden files; assert against them.
2. Make it resilient: if WeasyPrint/Chromium/poppler are unavailable, skip with a
   clear message rather than failing (so contributors aren't blocked).
3. Add a tiny visual diff option (rasterize page 1, compare to a golden PNG within a
   tolerance) for the cover, since that's where regressions are most visible.
4. Document how to regenerate goldens intentionally (`UPDATE_GOLDENS=1`).

Done when: a deliberate breaking change to `letter_for` or the parser makes
`test:render` fail loudly, and an intentional update regenerates goldens cleanly.
Commit the suite + goldens.

---

## 10. Document design-theme system (neutral themes for exam & vocab)

Context: Exams/vocab have one fixed look. The PPT side already has a rich theme
system (`design-systems/`). Offer tasteful, neutral theme choice for documents too.

Do this:
1. Define a minimal theme schema: `{ navy, accent, panel, pageBg, ink, gray, headingFont,
   bodyFont }`. Author **8 neutral, premium themes** (e.g. classic navy/brass — current
   default; charcoal/teal; forest/cream; burgundy/stone; slate/amber; ink/sage; …),
   each verified to grayscale well.
2. Thread a `--theme <name>` option into `exam_pdf.py` (CSS variables already exist —
   `:root`) and `vocab-pdf.mjs`; keep the current look as the default theme.
3. Render the same exam + the same 단어장 in 3 themes each; rasterize and confirm all
   read cleanly in color and B&W.

Done when: documents can switch theme via one flag, defaults are unchanged, and every
theme passes the grayscale check. Commit with comparison screenshots.

---

## 11. Production integration: generate → render → review → fix as a service

Context: The homepage uses `@anthropic-ai/sdk`. The validated flow here (generate,
parse, render, adversarial review, fix, re-render) should exist as a clean server
service, with the prompts from `docs/anthropic-sdk-prompts.md`.

Do this:
1. Implement a server module that, per module id, runs: compose user turn → stream
   generation (correct model tier from `src/routing.ts`) → parse/render → (for exams)
   run the capstone review as a **separate** call → if 치명/중대 found, run a fixer call
   that returns corrected Markdown → re-render → return the PDF + a short QA summary.
2. Add **prompt caching** for the static system prompts (Anthropic prompt caching) and
   record token usage per stage; expose a per-artifact cost estimate.
3. Add robust error handling and timeouts (WeasyPrint/Chromium failures degrade
   gracefully: deliver Markdown + a clear message), and keep the API key server-side.
4. Add an integration test that mocks the SDK and asserts the full pipeline shape.

Done when: one server entry point turns a form payload into a reviewed PDF + QA
summary, with caching and graceful failure, and the integration test passes. Commit
with the cost numbers you measured.

---

## 12. Korean-text quality linter (발문·해설)

Context: Review prompt #8 covers Korean quality but isn't enforced. Mechanical issues
(mixed 지문/본문, repeated 어미, thin explanations) recur.

Do this:
1. Add a lightweight static pass (`scripts/ko-lint.mjs`): regex/heuristics for
   terminology consistency (flag mixing 지문 vs 본문 within one paper), repeated
   sentence endings in 해설 (e.g. every line ending '적절.'), and 발문 that omit a clear
   instruction verb.
2. Hand the non-mechanical judgments (explanation completeness, naturalness) to the
   #8 review prompt via an `Agent`, merging both into one report.
3. Run it on the 고2 sample and the 영읽쓰B samples; fix recurring issues at the prompt
   level in `src/modules.ts` and re-test.

Done when: the linter flags real issues on existing samples, the prompt fixes reduce
them on regeneration, and the pass is wired into the exam review step. Commit with the
before/after counts.

---

## 13. Reference examples (few-shot anchors) for every module

Context: Only exam/vocabulary/resume/cover-letter carry a `referenceExample`. Modules
without one (worksheet, quiz, study-notes, lesson-plan, ppt, excel) drift in quality.

Do this:
1. Author a **synthetic, de-identified** format-and-quality skeleton for each missing
   module (generic placeholder content only — never copied material), injected the same
   way as the existing ones (under "참고 예시 (스타일·품질 기준)").
2. Regenerate skills. For each module, generate one artifact **with and without** the
   example and compare quality (structure adherence, tone, completeness) — keep the
   example only where it measurably helps.
3. Verify no example leaks copyrighted/real content and that prompts still demand
   brand-new content each run.

Done when: each module has a vetted reference example (or a documented reason it's
omitted), and the before/after comparison shows improvement. Commit with the
comparisons summarized.

---

## 14. Accessibility & print options

Context: 학원 printers vary; some teachers need large print or booklet layouts.

Do this:
1. Add options across the renderers: **large-print** (scale fonts up a notch with the
   QA text-fit loop still active), **2-up / booklet** imposition for exams, and an
   explicit **high-contrast B&W** mode (drop tints/panels to pure black-on-white for the
   cheapest laser printers, beyond the already-good grayscale).
2. Verify each by rendering the 고2 exam in every mode, rasterizing, and inspecting that
   nothing overflows and contrast is strong.

Done when: the three options work on exams (and large-print on vocab), each verified by
screenshots. Commit with samples.

---

## 15. Eval harness + regression dataset

Context: To improve prompts safely, you need a way to measure quality over time, not
just eyeball one sample.

Do this:
1. Assemble a small **eval set**: 10–15 specs across modules/subjects/difficulties
   (store the specs, not copyrighted outputs).
2. Build `scripts/eval.mjs` that generates each, runs the relevant review prompts, and
   scores: defect count by severity, self-containment rate, answer-uniqueness rate,
   explanation-depth pass rate, render success. Emit a single JSON scorecard.
3. Snapshot a baseline; then any prompt change can be measured against it (regression
   up/down). Document how to read the scorecard.

Done when: `npm run eval` produces a scorecard, a baseline is committed, and a
deliberate prompt regression visibly lowers a metric. Commit the harness + baseline.

---

### Suggested attack order for the all-nighter

`2 → 1` (correctness gaps: Excel then PPT) → `3` (QA engine) → `5 + 4` (exam variants +
new renderers, highest 학원 value) → `9 + 15` (regression + eval so nothing slides
back) → `6` (textbook mode, once their materials arrive) → `11` (production service) →
`7 / 8 / 10 / 12 / 13 / 14` (coverage & polish).

Pick up where you stopped by re-reading the last commit; each task is independent.
