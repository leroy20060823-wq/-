import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Environment variable ${name} must be a number, got: ${raw}`);
  }
  return parsed;
}

function listFromEnv(name: string, fallback: string[]): string[] {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "");
}

export const config = {
  port: intFromEnv("PORT", 3000),
  // The Anthropic SDK reads ANTHROPIC_API_KEY from the environment on its own;
  // we validate it here so the server fails fast at startup with a clear message
  // instead of erroring on the first request.
  anthropicApiKey: required("ANTHROPIC_API_KEY"),
  // Default to the cheapest capable model; individual modules can override
  // per task (see src/modules.ts).
  defaultModel: process.env.DEFAULT_MODEL ?? "claude-haiku-4-5",
  defaultMaxTokens: intFromEnv("DEFAULT_MAX_TOKENS", 8000),
  // Models a per-request override may select. Keeps callers on the cost-conscious
  // tier — a request can't force an expensive model. Server-defined module models
  // are trusted and not constrained by this list.
  allowedModels: listFromEnv("ALLOWED_MODELS", ["claude-haiku-4-5", "claude-sonnet-4-6"]),
};
