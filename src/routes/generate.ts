import { Router, type Request, type Response, type NextFunction } from "express";
import { config } from "../config.js";
import { listModules } from "../modules.js";
import { generate, generateStream } from "../services/generator.js";
import { parseGenerateRequest, type GenerateBody } from "../validation.js";

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
    modules: listModules().map(({ id, name, description, options }) => ({
      id,
      name,
      description,
      options: options ?? [],
    })),
  });
});

router.post(
  "/generate",
  asyncHandler(async (req, res) => {
    const parsed = parseGenerateRequest((req.body ?? {}) as GenerateBody, config.allowedModels);
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
    const parsed = parseGenerateRequest((req.body ?? {}) as GenerateBody, config.allowedModels);
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
