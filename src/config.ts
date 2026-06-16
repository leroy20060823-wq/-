import "dotenv/config";

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

// The API key is OPTIONAL so the server still boots and serves the UI without it
// (handy for deploy previews). Generation endpoints return 401 when it's absent.
const apiKey = process.env.ANTHROPIC_API_KEY?.trim() || undefined;

export const config = {
  // Hosts (Render, Railway, …) inject PORT; default to 3000 for local dev.
  port: intFromEnv("PORT", 3000),
  anthropicApiKey: apiKey,
  hasApiKey: Boolean(apiKey),
  defaultModel: process.env.DEFAULT_MODEL ?? "claude-haiku-4-5",
  defaultMaxTokens: intFromEnv("DEFAULT_MAX_TOKENS", 8000),
  allowedModels: listFromEnv("ALLOWED_MODELS", ["claude-haiku-4-5", "claude-sonnet-4-6"]),
};
