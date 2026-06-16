import { getModule, type GenerationModule } from "./modules.js";
import type { GenerateOptions } from "./services/generator.js";

export interface GenerateBody {
  module?: unknown;
  input?: unknown;
  model?: unknown;
  options?: unknown;
}

export type ParseResult =
  | { ok: true; options: GenerateOptions }
  | { ok: false; error: string };

/**
 * Normalize user-supplied option values against the module's declared schema.
 * Never throws — unknown keys are dropped, numbers are coerced and clamped,
 * select values must be one of the declared choices, text is trimmed and capped.
 */
export function normalizeOptionValues(
  module: GenerationModule,
  rawOptions: unknown,
): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  if (!module.options || typeof rawOptions !== "object" || rawOptions === null) {
    return out;
  }
  const raw = rawOptions as Record<string, unknown>;

  for (const opt of module.options) {
    const value = raw[opt.key];
    if (value === undefined || value === null || value === "") continue;

    if (opt.type === "number") {
      const n = Number(value);
      if (!Number.isFinite(n)) continue;
      let clamped = n;
      if (opt.min !== undefined) clamped = Math.max(opt.min, clamped);
      if (opt.max !== undefined) clamped = Math.min(opt.max, clamped);
      out[opt.key] = clamped;
    } else if (opt.type === "select") {
      const s = String(value);
      if (opt.choices?.some((c) => c.value === s)) out[opt.key] = s;
    } else {
      const s = String(value).trim();
      if (s) out[opt.key] = s.slice(0, 200);
    }
  }
  return out;
}

/**
 * Validate an incoming generation request body. Pure (no I/O, no API key) so it
 * can be unit-tested directly. `allowedModels` is injected by the caller.
 */
export function parseGenerateRequest(
  body: GenerateBody,
  allowedModels: readonly string[],
  maxInputChars = 8000,
): ParseResult {
  const moduleId = typeof body.module === "string" ? body.module.trim() : "";
  const input = typeof body.input === "string" ? body.input.trim() : "";
  const model =
    typeof body.model === "string" && body.model.trim() !== ""
      ? body.model.trim()
      : undefined;

  if (!moduleId) return { ok: false, error: "`module` is required." };
  if (!input) return { ok: false, error: "`input` is required." };
  if (input.length > maxInputChars) {
    return { ok: false, error: `입력이 너무 깁니다 (최대 ${maxInputChars}자).` };
  }

  const module = getModule(moduleId);
  if (!module) return { ok: false, error: `Unknown module: ${moduleId}` };

  if (model && !allowedModels.includes(model)) {
    return {
      ok: false,
      error: `Model not allowed: ${model}. Allowed models: ${allowedModels.join(", ")}`,
    };
  }

  const optionValues = normalizeOptionValues(module, body.options);

  return { ok: true, options: { module, input, model, optionValues } };
}
