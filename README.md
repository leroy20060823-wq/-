# Claude Generation Platform (backend)

A backend + demo UI that generates artifacts — exam papers (시험지), worksheets,
quizzes, vocabulary lists (단어장), slide outlines (PPT), study notes, lesson plans,
resumes (이력서), cover letters (자기소개서), creative writing, and Excel help — by
calling the Claude API. Each artifact type is a **module** with its own system
prompt; the server sends `[module system prompt + user input]` to
`messages.create()` and streams the result back.

Highlights:
- **Guided forms** — each module asks a few friendly questions instead of a blank
  box, and composes the answers into the prompt.
- **Demo mode** — per-module sample outputs render without an API key.
- **Streaming Markdown** output with a warm cream/watercolor theme.
- **Abuse protection** — per-IP rate limits, a daily cap, and input-length checks.

The Anthropic SDK runs **only on the server**. The API key lives in `.env` (or the
host's env) and is never exposed to the browser. The key is **optional**: without it
the UI and demo samples still work; live generation returns 401.

## 클로드 코드 스킬로 쓰기 (API 결제 없이)

배포 사이트는 호출마다 Anthropic API 비용이 들지만, 같은 모듈을 **클로드 코드
슬래시 명령**으로도 쓸 수 있습니다. 이 경우 외부 API 대신 **현재 클로드 세션이
직접** 자료를 만들어 주므로 추가 결제가 없습니다.

각 생성 모듈(`src/modules.ts`)은 `.claude/skills/<한글이름>/SKILL.md` 스킬로
**자동 생성**됩니다. 슬래시 명령 이름은 폴더 이름에서 나옵니다(예: `/시험지`,
`/학습지`, `/단어장`, `/PPT`, `/수업지도안`, `/이력서` …). 모듈의 시스템
프롬프트가 그대로 들어가 있어 품질 기준이 동일합니다.

```bash
npm run skills:build        # src/modules.ts → .claude/skills/*/SKILL.md 재생성
```

```
/시험지 중2 영어 비교급 단원평가 상 25문항
/단어장 vapor, summit, harbor, occur, coastal
/자료 신입사원 온보딩 발표 자료 만들어줘   # 자연어 라우터: 알맞은 생성기로 안내
```

**파일 내보내기** — 생성 결과를 워드(`.docx`)·한글(`.hwpx`)·파워포인트(`.pptx`)·
마크다운(`.md`) 파일로 저장할 수 있습니다("한글로 저장해줘"처럼 말하면 됨).
오프라인 Node 변환기 `scripts/export.mjs`가 `outputs/`에 파일을 만듭니다(브라우저
내보내기 `public/{docx,hwpx,pptx}.js`와 동일한 매핑, DOM 대신 `marked` 렉서 사용).

```bash
node scripts/export.mjs --in "outputs/시험지.md" --format docx,hwpx --out "outputs/시험지" --title "시험지"
```

자세한 목록과 사용법은 [`.claude/skills/README.md`](.claude/skills/README.md)
참고. 모듈을 추가/수정하면 `npm run skills:build`로 스킬을 다시 만드세요(스킬
파일은 손으로 고치지 말 것 — 다음 빌드에서 덮어써집니다).

## Stack

- Node.js (>= 18.18), TypeScript, Express
- `@anthropic-ai/sdk`

## Setup

```bash
npm install
cp .env.example .env   # then put your key in ANTHROPIC_API_KEY
npm run dev            # http://localhost:3000
```

Open <http://localhost:3000> in a browser for the **demo UI** — a warm
cream + watercolor (sage / sky) themed page with an autumn-clay accent, a
landing/hero with a prompt bar, and a module gallery of pastel cards, plus a
generator view (module picker + input + live streaming output, **rendered as
Markdown** so headings, bold, lists, and tables display properly, with tidy
loading / error / empty states). The whole palette lives in CSS variables in
`public/styles.css` (`:root`). The JSON/SSE API lives under `/api`.

The page imports `marked` (Markdown → HTML) and `DOMPurify` (sanitization) from
`public/vendor/` — local copies, no CDN. After bumping their versions in
`package.json`, refresh the copies with `npm run vendor`.

Other scripts: `npm test` (unit tests, no API key needed), `npm run typecheck`,
`npm run build` (emits to `dist/`), `npm start` (runs the build),
`npm run skills:build` (regenerates the Claude Code skills from `src/modules.ts`).

## Environment variables

| Variable             | Required | Default            | Notes                                            |
| -------------------- | -------- | ------------------ | ------------------------------------------------ |
| `ANTHROPIC_API_KEY`  | no       | —                  | Server-side only. Optional: without it the UI/demo work, generation 401s. |
| `PORT`               | no       | `3000`             | Injected by the host on deploy.                  |
| `DEFAULT_MODEL`      | no       | `claude-haiku-4-5` | Used when a module doesn't pin its own model.    |
| `DEFAULT_MAX_TOKENS` | no       | `8000`             | Used when a module doesn't pin its own budget.   |
| `ALLOWED_MODELS`     | no       | `claude-haiku-4-5,claude-sonnet-4-6` | Comma-separated allow-list for per-request `model` overrides. |
| `RATE_LIMIT_PER_MIN` | no       | `10`               | Max generation requests per IP per minute (429 over).        |
| `RATE_LIMIT_PER_DAY` | no       | `100`              | Max generation requests per IP per day.          |
| `MAX_INPUT_CHARS`    | no       | `8000`             | Max length of the composed request input (400 over).         |

### Models & cost

To keep cost down, the default model is **Haiku** (`claude-haiku-4-5`). Modules that
need higher quality pin **Sonnet** (`claude-sonnet-4-6`) — currently `exam` and `ppt`.
A request may also override the model per call (see below). Model IDs use aliases so
they always point at the current version.

## API

### `GET /health`
Liveness check → `{ "status": "ok" }`.

### `GET /api/modules`
Lists the available generation modules. Each module includes a one-line `purpose`
(its use-case, shown in the UI) and an `options` array describing its selectable
inputs (difficulty, count, length, …) which the demo UI renders as dropdowns /
number / text fields.

```json
{
  "modules": [
    { "id": "exam", "name": "시험지 생성", "description": "..." },
    { "id": "ppt", "name": "발표자료(PPT) 개요 생성", "description": "..." },
    { "id": "study-notes", "name": "학습 정리 노트", "description": "..." },
    { "id": "worksheet", "name": "학습지 생성", "description": "..." },
    { "id": "quiz", "name": "퀴즈 생성", "description": "..." },
    { "id": "vocabulary", "name": "단어장 생성", "description": "..." },
    { "id": "lesson-plan", "name": "수업지도안 생성", "description": "..." },
    { "id": "resume", "name": "이력서 작성", "description": "..." },
    { "id": "cover-letter", "name": "자기소개서 작성", "description": "..." }
  ]
}
```

### `POST /api/generate`
One-shot generation. Body:

```json
{
  "module": "exam",
  "input": "고등학교 2학년 미적분 단원평가",
  "options": { "difficulty": "상", "count": 10 },
  "model": "claude-sonnet-4-6"
}
```

`module` and `input` are required. `options` is an optional object of the module's
declared option values (see `GET /api/modules`); the server validates and clamps
them, then appends them to the prompt as a `[요청 조건]` block. `model` is an
optional per-request override (must be one of `ALLOWED_MODELS`, otherwise 400).
Response:

```json
{
  "module": "exam",
  "content": "# ...markdown...",
  "model": "claude-sonnet-4-6",
  "usage": { "inputTokens": 123, "outputTokens": 4567 }
}
```

```bash
curl -s http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"module":"ppt","input":"신입사원 온보딩 발표, 10분 분량"}'
```

### `POST /api/generate/stream`
Same body as `/api/generate`, but streams the output as Server-Sent Events — preferred
for long artifacts. Each event is a JSON line:

```
data: {"type":"delta","text":"..."}
data: {"type":"delta","text":"..."}
data: {"type":"done","model":"claude-sonnet-4-6","usage":{"inputTokens":123,"outputTokens":4567}}
```

Errors mid-stream arrive as `data: {"type":"error","error":"..."}`.

## Adding a module

Add an entry to `MODULES` in [`src/modules.ts`](src/modules.ts):

```ts
{
  id: "worksheet",
  name: "학습지 생성",
  description: "주제를 받아 연습 문제 학습지를 생성합니다.",
  model: "claude-haiku-4-5",   // optional model override
  maxTokens: 6000,             // optional token override
  options: [                   // optional — user-selectable inputs
    { key: "difficulty", label: "난이도", type: "select",
      choices: [{ value: "하" }, { value: "중" }, { value: "상" }], default: "중" },
    { key: "count", label: "문항 수", type: "number", default: 10, min: 1, max: 50 },
  ],
  referenceExample: "...",     // optional — few-shot style/quality sample (see below)
  systemPrompt: "You are ...",
}
```

No other changes are needed — it shows up in `GET /api/modules` (with its options)
and is usable from both generation endpoints immediately.

### Few-shot style/quality examples

Each module can carry a `referenceExample` — a sample of the expected output. When
set, it's injected into the system prompt under a "참고 예시 (스타일·품질 기준)"
section so the model matches that style and quality (it's told to match the level,
not copy the content). The `exam` and `vocabulary` modules ship with **synthetic
format skeletons** (generic placeholder content) derived from sample document
structure — the prompts also explicitly require brand-new passages/items every
run. Leave `referenceExample` unset to omit the section entirely.

## Project layout

```
public/                # demo frontend (static, served at /)
  index.html
  styles.css
  app.js               # streams + renders Markdown via vendored marked + DOMPurify
  vendor/              # marked + DOMPurify browser builds (copied via npm run vendor)
.claude/skills/        # generated slash-command skills (one per module) + README
scripts/
  vendor.mjs           # copies frontend libs from node_modules into public/vendor
  build-skills.mjs     # src/modules.ts → .claude/skills/*/SKILL.md (npm run skills:build)
  export.mjs           # Markdown → .docx/.hwpx/.pptx/.md (skills call this to save files)
src/
  config.ts            # env loading (key optional) + limits
  anthropic.ts         # shared Anthropic client
  modules.ts           # module registry: system prompts, options, guides
  samples.ts           # static per-module demo samples (no key needed)
  validation.ts        # pure request validation (unit-tested)
  rateLimit.ts         # in-memory per-IP rate limiter (unit-tested)
  services/generator.ts# generate() + generateStream()
  routes/generate.ts   # /api/modules(+/:id/sample), /api/generate(+/stream)
  server.ts            # Express app entry + static hosting + trust proxy
```

## Deploy (Render free tier)

The repo ships a `render.yaml` blueprint, a `Procfile`, and a pinned
`.node-version`. The app reads `process.env.PORT` (the host injects it — nothing
is hardcoded), and the API key is optional: **without `ANTHROPIC_API_KEY` the site
still serves the UI; generation returns 401.**

Render dashboard steps:

1. Push this branch to GitHub (already done).
2. Render → **New +** → **Blueprint** → connect the GitHub repo and pick the
   branch. Render detects `render.yaml`.
3. Review the service (build `npm ci --include=dev && npm run build`, start
   `npm start`, health check `/health`) → **Apply**.
4. Open the service → **Environment** → set `ANTHROPIC_API_KEY` to your real key →
   **Save** (triggers a redeploy). Skip this to ship a UI-only preview.
5. Wait for the build, then open the `…onrender.com` URL.

Notes: free web services **spin down when idle** (first request after a pause
cold-starts in ~30s). To deploy without the blueprint, create a Node **Web
Service**, set Build = `npm ci --include=dev && npm run build`, Start = `npm start`,
and add the env vars manually.

**Railway** works the same way via Nixpacks (no blueprint needed): New Project →
Deploy from GitHub repo → it runs `npm run build` then `npm start` and injects
`PORT`. Add `ANTHROPIC_API_KEY` under the service **Variables**.

## Security notes

- The frontend must call these backend endpoints — it must never receive the API key.
- `.env` is git-ignored; never commit real keys.
- `input` comes from end users and becomes the user-turn content. System prompts are
  fixed server-side and are not user-overridable, which keeps each module's behavior
  contained.
