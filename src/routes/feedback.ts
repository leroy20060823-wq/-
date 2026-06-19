import { Router, type Request, type Response, type NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { appendFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFeedback } from "../feedback.js";

export const feedbackRouter = Router();

const dataDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "data");

const limiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "잠시 후 다시 시도해 주세요." },
});

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

// Anonymous post-use feedback. Stores only the answers + a timestamp (no IP /
// name / login). Render's disk is ephemeral — swap for a DB/Sheet for durability.
feedbackRouter.post(
  "/feedback",
  limiter,
  asyncHandler(async (req, res) => {
    const fb = parseFeedback(req.body ?? {});
    if (!fb) {
      res.status(400).json({ error: "남겨주실 의견을 하나라도 선택해 주세요." });
      return;
    }
    try {
      await mkdir(dataDir, { recursive: true });
      await appendFile(join(dataDir, "feedback.jsonl"), JSON.stringify({ ts: new Date().toISOString(), ...fb }) + "\n");
    } catch {
      /* storage is best-effort; never fail the request on a write error */
    }
    res.json({ ok: true });
  }),
);
