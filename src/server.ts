import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { router } from "./routes/generate.js";
import { examRouter } from "./routes/exam.js";
import { docRouter } from "./routes/doc.js";
import { feedbackRouter } from "./routes/feedback.js";

const app = express();

// Behind a hosting proxy (Render/Railway), trust the first proxy hop so req.ip
// reflects the real client (via X-Forwarded-For) for rate limiting. Without this,
// every request would look like it came from the proxy's single IP.
app.set("trust proxy", 1);

// Don't advertise the framework.
app.disable("x-powered-by");

// Resolves to <project root>/public whether running from dist/ (build) or src/ (tsx).
const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");

app.use(cors());
// Generation endpoints can carry base64 photos/PDF, so they get a larger JSON
// limit; everything else stays tight. This path-scoped parser runs first and
// sets req.body, so the global 1mb parser below skips these routes.
app.use("/api/generate", express.json({ limit: `${config.maxUploadMb}mb` }));
app.use(express.json({ limit: "1mb" }));

// Serve the demo frontend (public/index.html) at the site root.
app.use(express.static(publicDir));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", generation: config.hasApiKey ? "enabled" : "disabled" });
});

app.use("/api", router);
app.use("/api", examRouter);
app.use("/api", docRouter);
app.use("/api", feedbackRouter);

// Centralized error handler (must have 4 args to be treated as an error handler).
// Log the full error server-side, but return a generic message — never leak
// stack traces, internal details, or whether an API key exists.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[error]", err);
  if (res.headersSent) return;
  res.status(500).json({ error: "잠시 문제가 생겼어요. 잠시 후 다시 시도해 주세요." });
});

app.listen(config.port, () => {
  console.log(`Server listening on http://localhost:${config.port}`);
});
