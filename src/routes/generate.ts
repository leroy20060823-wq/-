import { Router, type Request, type Response, type NextFunction } from "express";
import { appendFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";
import { listModules } from "../modules.js";
import { generate, generateStream } from "../services/generator.js";
import { parseGenerateRequest, type GenerateBody } from "../validation.js";
import { createRateLimiter } from "../rateLimit.js";
import { getSample } from "../samples.js";
import { recommendThemes, recommendFromDesigns, listThemes } from "../design.js";
import { guidanceFromAnswers, parseSurvey } from "../onboarding.js";

export const router = Router();

// Per-IP abuse protection for the generation endpoints.
const perMinute = createRateLimiter({
  windowMs: 60_000,
  max: config.rateLimitPerMin,
  message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
});
const perDay = createRateLimiter({
  windowMs: 24 * 60 * 60_000,
  max: config.rateLimitPerDay,
  message: "오늘 사용량 한도를 초과했습니다. 내일 다시 이용해 주세요.",
});
const surveyLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 30,
  message: "잠시 후 다시 시도해 주세요.",
});

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
      ({ id, name, description, purpose, group, options, guide, inputPlaceholder, wizard }) => ({
        id,
        name,
        description,
        purpose,
        group: group ?? "work",
        options: options ?? [],
        guide: guide ?? [],
        inputPlaceholder: inputPlaceholder ?? null,
        wizard: wizard ?? false,
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
  perMinute,
  perDay,
  asyncHandler(async (req, res) => {
    if (!ensureApiKey(res)) return;
    const parsed = parseGenerateRequest(
      (req.body ?? {}) as GenerateBody,
      config.allowedModels,
      config.maxInputChars,
    );
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const result = await generate(parsed.options);
    res.json({ module: parsed.options.module.id, ...result });
  }),
);

router.post(
  "/generate/stream",
  perMinute,
  perDay,
  asyncHandler(async (req, res) => {
    if (!ensureApiKey(res)) return;
    const parsed = parseGenerateRequest(
      (req.body ?? {}) as GenerateBody,
      config.allowedModels,
      config.maxInputChars,
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
      const message = err instanceof Error ? err.message : "Generation failed.";
      res.write(`data: ${JSON.stringify({ type: "error", error: message })}\n\n`);
    } finally {
      res.end();
    }
  }),
);
