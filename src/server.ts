import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { config } from "./config.js";
import { router } from "./routes/generate.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", router);

// Centralized error handler (must have 4 args to be treated as an error handler).
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  const message = err instanceof Error ? err.message : "Internal server error.";
  res.status(500).json({ error: message });
});

app.listen(config.port, () => {
  console.log(`Server listening on http://localhost:${config.port}`);
});
