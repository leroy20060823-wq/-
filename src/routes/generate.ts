import { Router, type Request, type Response, type NextFunction } from "express";
import { getModule, listModules } from "../modules.js";
import { generate, generateStream, type GenerateOptions } from "../services/generator.js";

export const router = Router();

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
    modules: listModules().map(({ id, name, description }) => ({ id, name, description })),
  });
});

interface GenerateBody {
  module?: unknown;
  input?: unknown;
  model?: unknown;
}

type ParseResult = { ok: true; options: GenerateOptions } | { ok: false; error: string };

function parseBody(body: GenerateBody): ParseResult {
  const moduleId = typeof body.module === "string" ? body.module.trim() : "";
  const input = typeof body.input === "string" ? body.input.trim() : "";
  const model = typeof body.model === "string" && body.model.trim() !== "" ? body.model.trim() : undefined;

  if (!moduleId) return { ok: false, error: "`module` is required." };
  if (!input) return { ok: false, error: "`input` is required." };

  const module = getModule(moduleId);
  if (!module) return { ok: false, error: `Unknown module: ${moduleId}` };

  return { ok: true, options: { module, input, model } };
}

router.post(
  "/generate",
  asyncHandler(async (req, res) => {
    const parsed = parseBody((req.body ?? {}) as GenerateBody);
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
  asyncHandler(async (req, res) => {
    const parsed = parseBody((req.body ?? {}) as GenerateBody);
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
