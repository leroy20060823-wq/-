import { getModule } from "./modules.js";
import type { GenerateOptions } from "./services/generator.js";

export interface GenerateBody {
  module?: unknown;
  input?: unknown;
  model?: unknown;
}

export type ParseResult =
  | { ok: true; options: GenerateOptions }
  | { ok: false; error: string };

/**
 * Validate an incoming generation request body. Pure (no I/O, no API key) so it
 * can be unit-tested directly. `allowedModels` is injected by the caller (the
 * route passes config.allowedModels) rather than imported, keeping this module
 * free of the config side effects.
 */
export function parseGenerateRequest(
  body: GenerateBody,
  allowedModels: readonly string[],
): ParseResult {
  const moduleId = typeof body.module === "string" ? body.module.trim() : "";
  const input = typeof body.input === "string" ? body.input.trim() : "";
  const model =
    typeof body.model === "string" && body.model.trim() !== ""
      ? body.model.trim()
      : undefined;

  if (!moduleId) return { ok: false, error: "`module` is required." };
  if (!input) return { ok: false, error: "`input` is required." };

  const module = getModule(moduleId);
  if (!module) return { ok: false, error: `Unknown module: ${moduleId}` };

  if (model && !allowedModels.includes(model)) {
    return {
      ok: false,
      error: `Model not allowed: ${model}. Allowed models: ${allowedModels.join(", ")}`,
    };
  }

  return { ok: true, options: { module, input, model } };
}
