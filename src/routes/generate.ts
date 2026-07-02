import { Router, type Request, type Response, type NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { appendFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";
import { listModules } from "../modules.js";
import { moduleTier } from "../routing.js";
import { generate, generateStream } from "../services/generator.js";
import { reviewAndFix } from "../services/examReview.js";
import { reviewArtifact, REVIEWABLE } from "../services/review.js";
import { parseGenerateRequest, type GenerateBody } from "../validation.js";
import { createGlobalDailyLimiter } from "../rateLimit.js";
import { getSample } from "../samples.js";
import { recommendThemes, recommendFromDesigns, listThemes } from "../design.js";
import { guidanceFromAnswers, parseSurvey } from "../onboarding.js";

export const router = Router();

// Friendly Korean messages (design tone, not raw "429 Too Many Requests").
const MSG_TOO_FAST = "잠시 후 다시 시도해 주세요.";
const MSG_DAILY = "오늘 사용량을 다 쓰셨어요. 내일 다시 와 주세요.";

// Per-IP abuse protection for the generation endpoints. Uses express-rate-limit
// with the default key generator (req.ip) — server.ts sets `trust proxy` so this
// is the real client IP behind Render's proxy, not the shared proxy address.
const ipLimiterDefaults = {
  standardHeaders: "draft-7" as const,
  legacyHeaders: false,
};
const perMinute = rateLimit({
  ...ipLimiterDefaults,
  windowMs: 60_000,
  limit: config.rateLimitPerMin,
  message: { error: MSG_TOO_FAST },
});
const perHour = rateLimit({
  ...ipLimiterDefaults,
  windowMs: 60 * 60_000,
  limit: config.rateLimitPerHour,
  message: { error: MSG_TOO_FAST },
});
const perDayPerIp = rateLimit({
  ...ipLimiterDefaults,
  windowMs: 24 * 60 * 60_000,
  limit: config.rateLimitPerDayPerIp,
  message: { error: MSG_DAILY },
});
// Global daily kill switch — pauses generation for everyone once the whole
// service crosses the daily budget. Runs after the per-IP limits.
const globalDaily = createGlobalDailyLimiter({
  max: config.rateLimitPerDayGlobal,
  message: MSG_DAILY,
});
// Light limit on the anonymous survey POST (not a paid endpoint, but still a POST).
const surveyLimiter = rateLimit({
  ...ipLimiterDefaults,
  windowMs: 60_000,
  limit: 30,
  message: { error: MSG_TOO_FAST },
});

// Middleware chain applied to both generation endpoints.
const generationGuards = [perMinute, perHour, perDayPerIp, globalDaily];

// Anonymous onboarding survey storage: only the 5 answers + level + timestamp.
// No IP / name / email / login is recorded. (Render's disk is ephemeral — swap
// for a DB/Sheet for durable storage.)
const dataDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "data");
async function appendSurvey(record: unknown): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  await appendFile(join(dataDir, "onboarding-survey.jsonl"), JSON.stringify(record) + "\n");
}

router.post(
  "/onboarding-survey",
  surveyLimiter,
  asyncHandler(async (req, res) => {
    const answers = parseSurvey(req.body ?? {});
    if (!answers) {
      res.status(400).json({ error: "invalid survey" });
      return;
    }
    const guidanceLevel = guidanceFromAnswers(answers);
    try {
      await appendSurvey({ ts: new Date().toISOString(), ...answers, guidanceLevel });
    } catch {
      /* storage is best-effort; never fail the request on a write error */
    }
    res.json({ ok: true, guidanceLevel });
  }),
);

// Shared gate: generation needs a server-side API key. Without it the UI and
// /api/modules still work, but generation returns 401.
function ensureApiKey(res: Response): boolean {
  if (config.hasApiKey) return true;
  res
    .status(401)
    .json({ error: "생성이 비활성화되어 있습니다. 서버에 ANTHROPIC_API_KEY가 설정되지 않았습니다." });
  return false;
}

// Forward rejected promises to the Express error handler (works on v4 and v5).
function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

router.get("/modules", (_req, res) => {
  res.json({
    modules: listModules().map(
      ({ id, name, description, purpose, group, options, guide, inputPlaceholder, wizard, source }) => ({
        id,
        name,
        description,
        purpose,
        group: group ?? "work",
        options: options ?? [],
        guide: guide ?? [],
        inputPlaceholder: inputPlaceholder ?? null,
        wizard: wizard ?? false,
        // Base routing tier (so the client can show the right loading note).
        tier: moduleTier(id),
        // Only the UI-relevant bits (never the system directives).
        source: source?.enabled
          ? { enabled: true, label: source.label ?? null, hint: source.hint ?? null }
          : null,
      }),
    ),
  });
});

// Static demo sample for a module — works without an API key.
router.get("/modules/:id/sample", (req, res) => {
  const content = getSample(req.params.id);
  if (content === undefined) {
    res.status(404).json({ error: `No sample for module: ${req.params.id}` });
    return;
  }
  res.json({ module: req.params.id, content });
});

// PPT design system: all presets, and keyword-based theme recommendation.
// No API key needed (keyword matcher; an LLM analyzer can replace it later).
router.get("/ppt/themes", (_req, res) => {
  // designs.json when available, else the built-in PRESETS.
  res.json({ presets: listThemes() });
});

router.post("/ppt/recommend", (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const input = {
    topic: str(body.topic),
    purpose: str(body.purpose),
    audience: str(body.audience),
    mood: str(body.mood),
  };
  // Prefer designs.json (74 systems); fall back to PRESETS when it's empty.
  const recommendations = recommendFromDesigns(input) ?? recommendThemes(input);
  res.json({ recommendations });
});

router.post(
  "/generate",
  ...generationGuards,
  asyncHandler(async (req, res) => {
    if (!ensureApiKey(res)) return;
    const parsed = parseGenerateRequest(
      (req.body ?? {}) as GenerateBody,
      config.allowedModels,
      config.maxInputChars,
      config.maxFieldChars,
      {
        maxSourceChars: config.maxSourceChars,
        maxAttachments: config.maxAttachments,
        maxImageBytes: config.maxImageBytes,
        maxPdfBytes: config.maxPdfBytes,
        maxTotalUploadBytes: config.maxTotalUploadBytes,
      },
    );
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const result = await generate(parsed.options);
    res.json({ module: parsed.options.module.id, ...result });
  }),
);

// Independent QA pass for a generated exam: 4-stage adversarial review, then a
// fixer call when 치명/중대 defects are found. Paid LLM endpoint → same guards as
// generation. Returns the review text, severity counts, and (if any) the
// corrected Markdown for the client to apply.
router.post(
  "/exam/review",
  ...generationGuards,
  asyncHandler(async (req, res) => {
    if (!ensureApiKey(res)) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const markdown = typeof body.markdown === "string" ? body.markdown : "";
    if (!markdown.trim()) {
      res.status(400).json({ error: "검토할 시험지 내용이 비어 있어요." });
      return;
    }
    if (markdown.length > config.maxInputChars * 6) {
      res.status(400).json({ error: "내용이 너무 길어요." });
      return;
    }
    const result = await reviewAndFix(markdown);
    res.json(result);
  }),
);

// Module-aware QA review (단어장·학습지·퀴즈·발표자료·엑셀·시험지). Same contract as
// /exam/review but picks the review prompt by module. Paid LLM → generation guards.
router.post(
  "/review",
  ...generationGuards,
  asyncHandler(async (req, res) => {
    if (!ensureApiKey(res)) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const moduleId = typeof body.module === "string" ? body.module : "";
    const markdown = typeof body.markdown === "string" ? body.markdown : "";
    if (!REVIEWABLE.has(moduleId)) {
      res.status(400).json({ error: "이 종류는 검토를 지원하지 않아요." });
      return;
    }
    if (!markdown.trim()) {
      res.status(400).json({ error: "검토할 내용이 비어 있어요." });
      return;
    }
    if (markdown.length > config.maxInputChars * 6) {
      res.status(400).json({ error: "내용이 너무 길어요." });
      return;
    }
    const result = await reviewArtifact(moduleId, markdown);
    res.json(result);
  }),
);

router.post(
  "/generate/stream",
  ...generationGuards,
  asyncHandler(async (req, res) => {
    if (!ensureApiKey(res)) return;
    const parsed = parseGenerateRequest(
      (req.body ?? {}) as GenerateBody,
      config.allowedModels,
      config.maxInputChars,
      config.maxFieldChars,
      {
        maxSourceChars: config.maxSourceChars,
        maxAttachments: config.maxAttachments,
        maxImageBytes: config.maxImageBytes,
        maxPdfBytes: config.maxPdfBytes,
        maxTotalUploadBytes: config.maxTotalUploadBytes,
      },
    );
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    try {
      for await (const event of generateStream(parsed.options)) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (err) {
      // Log full detail server-side; never leak stack traces / internals to the client.
      console.error("[generate/stream] generation error:", err);
      const event = {
        type: "error",
        error: "결과를 만드는 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.",
      };
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } finally {
      res.end();
    }
  }),
);
