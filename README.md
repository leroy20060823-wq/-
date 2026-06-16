# Claude Generation Platform (backend)

A backend that generates artifacts — exam papers (시험지), slide-deck outlines (PPT),
study notes, and more — by calling the Claude API. Each artifact type is a **module**
with its own system prompt; the user supplies free-form input, and the server sends
`[module system prompt + user input]` to `messages.create()` and returns the result.

The Anthropic SDK runs **only on the server**. The API key lives in `.env` and is
never exposed to the browser.

## Stack

- Node.js (>= 18.18), TypeScript, Express
- `@anthropic-ai/sdk`

## Setup

```bash
npm install
cp .env.example .env   # then put your key in ANTHROPIC_API_KEY
npm run dev            # http://localhost:3000
```

Open <http://localhost:3000> in a browser for the **demo UI** — a "밤의 서재"
(navy / gold / cream) themed page with a landing/intro screen and module gallery,
plus a generator view (module picker + input + live streaming output, **rendered
as Markdown** so headings, bold, lists, and tables display properly, with tidy
loading / error / empty states). The JSON/SSE API lives under `/api`.

The page imports `marked` (Markdown → HTML) and `DOMPurify` (sanitization) from
`public/vendor/` — local copies, no CDN. After bumping their versions in
`package.json`, refresh the copies with `npm run vendor`.

Other scripts: `npm test` (unit tests, no API key needed), `npm run typecheck`,
`npm run build` (emits to `dist/`), `npm start` (runs the build).

## Environment variables

| Variable             | Required | Default            | Notes                                            |
| -------------------- | -------- | ------------------ | ------------------------------------------------ |
| `ANTHROPIC_API_KEY`  | yes      | —                  | Server-side only. Validated at startup.          |
| `PORT`               | no       | `3000`             |                                                  |
| `DEFAULT_MODEL`      | no       | `claude-haiku-4-5` | Used when a module doesn't pin its own model.    |
| `DEFAULT_MAX_TOKENS` | no       | `8000`             | Used when a module doesn't pin its own budget.   |
| `ALLOWED_MODELS`     | no       | `claude-haiku-4-5,claude-sonnet-4-6` | Comma-separated allow-list for per-request `model` overrides. |

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
scripts/
  vendor.mjs           # copies frontend libs from node_modules into public/vendor
src/
  config.ts            # env loading + validation
  anthropic.ts         # shared Anthropic client
  modules.ts           # module registry (system prompts live here)
  validation.ts        # pure request validation (unit-tested)
  services/generator.ts# generate() + generateStream()
  routes/generate.ts   # /api/modules, /api/generate, /api/generate/stream
  server.ts            # Express app entry + static hosting
```

## Security notes

- The frontend must call these backend endpoints — it must never receive the API key.
- `.env` is git-ignored; never commit real keys.
- `input` comes from end users and becomes the user-turn content. System prompts are
  fixed server-side and are not user-overridable, which keeps each module's behavior
  contained.
