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
  // Default output ceiling per request. Modules may ask for more, but never above
  // maxOutputTokens — a hard cost cap so a runaway module can't burn the budget.
  defaultMaxTokens: intFromEnv("DEFAULT_MAX_TOKENS", 4000),
  maxOutputTokens: intFromEnv("MAX_OUTPUT_TOKENS", 16000),
  allowedModels: listFromEnv("ALLOWED_MODELS", ["claude-haiku-4-5", "claude-sonnet-4-6"]),
  // Abuse protection (per client IP — needs trust proxy so req.ip is the real
  // client). Frequency limits stop bursts; daily caps bound total spend.
  rateLimitPerMin: intFromEnv("RATE_LIMIT_PER_MIN", 5),
  rateLimitPerHour: intFromEnv("RATE_LIMIT_PER_HOUR", 20),
  rateLimitPerDayPerIp: intFromEnv("RATE_LIMIT_PER_DAY_PER_IP", 30),
  // Global kill switch: once the whole service hits this many generations in a
  // day, generation pauses for everyone until the next UTC day.
  rateLimitPerDayGlobal: intFromEnv("RATE_LIMIT_PER_DAY_GLOBAL", 500),
  // Input limits: per-field cap + overall request cap (in characters).
  maxFieldChars: intFromEnv("MAX_FIELD_CHARS", 3000),
  maxInputChars: intFromEnv("MAX_INPUT_CHARS", 8000),
  // Pasted source material can be longer than the form text (a whole passage).
  maxSourceChars: intFromEnv("MAX_SOURCE_CHARS", 20000),
  // Attachment (photo / PDF) limits — images add token cost, so cap count + size.
  maxAttachments: intFromEnv("MAX_ATTACHMENTS", 10),
  maxImageBytes: intFromEnv("MAX_IMAGE_BYTES", 5 * 1024 * 1024),
  maxPdfBytes: intFromEnv("MAX_PDF_BYTES", 10 * 1024 * 1024),
  maxTotalUploadBytes: intFromEnv("MAX_TOTAL_UPLOAD_BYTES", 18 * 1024 * 1024),
  // Express JSON body limit (must comfortably hold base64 attachments).
  maxUploadMb: intFromEnv("MAX_UPLOAD_MB", 24),
};
