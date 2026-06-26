# CLAUDE.md — project guide for Claude Code

A study-material generator (시험지·단어장·학습지·퀴즈·발표자료·학습노트·수업지도안·이력서·
자기소개서·소설·엑셀). TypeScript + Express server, vanilla-JS frontend, Claude API for
generation. Deployed on Render via Docker.

## Architecture

- **Modules & system prompts:** `src/modules.ts` — each module has `systemPrompt`,
  options/guide fields, `model`, `maxTokens`, and (some) a `referenceExample`. This is the
  single source of truth for what each module produces.
- **Model routing:** `src/routing.ts` — rule-based tier selection (no extra LLM call).
  `MODELS` = { light: Haiku, standard: Sonnet, heavy: Opus }. `MODULE_TIER` maps modules
  to a base tier; 난이도 상 → Opus, very large input → at least Opus. The exam module is
  heavy (Opus). Tune routing HERE only.
- **Generation:** `src/services/generator.ts` (`generate`, `generateStream`) calls the
  Anthropic SDK with the module's system prompt + the composed user turn.
- **Routes:** `src/routes/generate.ts` (generation + `/api/modules`), `src/routes/exam.ts`
  (`/api/exam/pdf`), `src/routes/feedback.ts`. Validation/clamping in `src/validation.ts`;
  rate limits in `src/rateLimit.ts`; config/env in `src/config.ts`.
- **Exam renderer (polished A4 PDF):** `src/exam/parseExam.ts` (`buildExamModel`,
  tolerant Markdown → model) → `scripts/exam_pdf.py` (WeasyPrint). Fonts embedded from
  `fonts/`. Options render as ①②③④⑤; 서술형 gets a ruled 답안란. Python + WeasyPrint ship
  in the Docker image (see `Dockerfile`).
- **Frontend:** `public/` — `app.js` (UI, generation, loading notes), `index.html`,
  client-side exporters `docx.js` / `hwpx.js` / `pptx.js`, `slides.js`, `attachments.js`,
  `docqa.js`. Markdown rendered with vendored `marked` + DOMPurify.
- **Output formats:** on-screen Markdown preview, `.docx` and `.hwpx` (Node-native,
  client-side from the rendered DOM), browser print-to-PDF, and the exam's WeasyPrint PDF.

## Dev workflow

```bash
npm run dev         # tsx watch src/server.ts (local)
npm run typecheck   # tsc --noEmit
npm test            # node --test on src/**/*.test.ts
npm run build       # tsc -p tsconfig.build.json → dist/
npm start           # node dist/server.js (prod)
```

Keep `typecheck`, `test`, and `build` green. Commit per logical task with a clear message.

## Deploy

- **Render, Docker runtime** (`render.yaml` → `Dockerfile`). The image carries Node +
  Python + WeasyPrint so `/api/exam/pdf` works in production. `ANTHROPIC_API_KEY` is set
  in the Render dashboard (the site serves the UI without it; generation returns 401).
- `main` is the deploy branch (autoDeploy on). Feature work happens on the assigned
  branch, then fast-forwards to `main`.

## Project rules

- **제작 후 항상 검토 (review after producing).** For exams, run the adversarial review in
  [`scripts/exam-review-protocol.md`](scripts/exam-review-protocol.md) as independent
  passes (generation and review are separate calls), fix 치명/중대 defects, then re-render.
  Other modules (단어장·학습지·퀴즈·발표자료·엑셀) should get a proportionate review (don't
  run a 9-pass on a 5-word vocab list) — see the per-module review prompts in
  [`docs/prompt-backlog.md`](docs/prompt-backlog.md) (A3–A6).
- **Self-containment.** Every keyed exam answer must be provable from the printed page.
- **Neutral by default.** No school/brand name, motto, or institution on any output unless
  the user explicitly provides one.
- **Print quality.** PDFs are A4 with embedded fonts and must read well in BOTH color and
  grayscale (cheap B&W laser printers).
- **Output contract.** The Markdown each module returns must match the renderer's expected
  shape (see the per-module output contracts in `docs/anthropic-sdk-prompts.md`); the exam
  parser is tolerant but the structure must hold.

## Reference docs

- [`docs/anthropic-sdk-prompts.md`](docs/anthropic-sdk-prompts.md) — production system /
  review prompts + SDK wiring for the live homepage.
- [`docs/prompt-backlog.md`](docs/prompt-backlog.md) — APPLY-NOW prompts (A1–A7) + the
  engineering/content backlog (B/C) + suggested order.
- [`docs/all-nighter-prompts.md`](docs/all-nighter-prompts.md) — self-contained
  copy-paste task blocks (1–15).
- [`scripts/exam-review-protocol.md`](scripts/exam-review-protocol.md) — the 9-pass exam
  QA protocol + fixer call.

> Note: some backlog tasks reference an aspirational layout (`scripts/export.mjs`,
> `.claude/skills`, `build-skills.mjs`, `design-systems/`, `vocab-pdf.mjs`) that this repo
> doesn't have yet. Adapt them to the structure above when picking one up.
