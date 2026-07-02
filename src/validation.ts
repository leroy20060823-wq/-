import { getModule, type GenerationModule } from "./modules.js";
import type { Attachment, GenerateOptions } from "./services/generator.js";

export interface GenerateBody {
  module?: unknown;
  input?: unknown;
  model?: unknown;
  options?: unknown;
  /** Pasted source material (textbook passages, etc.). */
  sourceText?: unknown;
  /** Uploaded source material: [{ kind, mediaType, data(base64) }]. */
  attachments?: unknown;
}

/** Attachment / source caps (injected from config; sane fallbacks for tests). */
export interface ParseLimits {
  maxSourceChars?: number;
  maxAttachments?: number;
  maxImageBytes?: number;
  maxPdfBytes?: number;
  maxTotalUploadBytes?: number;
}

export type ParseResult =
  | { ok: true; options: GenerateOptions }
  | { ok: false; error: string };

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

/** Approximate decoded byte length of a base64 string. */
function approxBase64Bytes(b64: string): number {
  const s = b64.replace(/\s/g, "");
  if (!s) return 0;
  const pad = s.endsWith("==") ? 2 : s.endsWith("=") ? 1 : 0;
  return Math.floor((s.length * 3) / 4) - pad;
}

type AttachResult = { ok: true; list: Attachment[] } | { ok: false; error: string };

function parseAttachments(raw: unknown, limits: Required<ParseLimits>): AttachResult {
  if (raw === undefined || raw === null) return { ok: true, list: [] };
  if (!Array.isArray(raw)) return { ok: false, error: "첨부 형식이 올바르지 않아요." };
  if (raw.length > limits.maxAttachments) {
    return { ok: false, error: `첨부는 최대 ${limits.maxAttachments}개까지 올릴 수 있어요.` };
  }
  const list: Attachment[] = [];
  let total = 0;
  for (const item of raw) {
    if (!item || typeof item !== "object") return { ok: false, error: "첨부 형식이 올바르지 않아요." };
    const o = item as Record<string, unknown>;
    const mediaType = typeof o.mediaType === "string" ? o.mediaType : "";
    const data = typeof o.data === "string" ? o.data.replace(/\s/g, "") : "";
    if (!data || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
      return { ok: false, error: "첨부 파일을 읽지 못했어요. 다시 올려주세요." };
    }
    const bytes = approxBase64Bytes(data);
    let kind: Attachment["kind"];
    if (mediaType === "application/pdf") {
      kind = "pdf";
      if (bytes > limits.maxPdfBytes) return { ok: false, error: "PDF 파일이 너무 커요. (최대 10MB)" };
    } else if (ALLOWED_IMAGE_TYPES.has(mediaType)) {
      kind = "image";
      if (bytes > limits.maxImageBytes) return { ok: false, error: "사진 파일이 너무 커요. 더 작게 찍거나 줄여주세요." };
    } else {
      return { ok: false, error: "이미지(JPG·PNG·WEBP·GIF) 또는 PDF만 올릴 수 있어요." };
    }
    total += bytes;
    list.push({ kind, mediaType: mediaType as Attachment["mediaType"], data });
  }
  if (total > limits.maxTotalUploadBytes) {
    return { ok: false, error: "첨부 용량이 너무 커요. 사진 수를 줄여주세요." };
  }
  return { ok: true, list };
}

/** Per-text-option character cap (short structured fields like "추가 요청사항"). */
const OPTION_TEXT_CAP = 1000;

// Control characters that are legitimate whitespace and must be kept:
// tab (0x09), line feed (0x0A), carriage return (0x0D).
const ALLOWED_CONTROL = new Set([0x09, 0x0a, 0x0d]);

/**
 * Strip dangerous / invisible control characters (C0 controls + DEL) while
 * keeping ordinary whitespace. Defends against control-char injection and stray
 * null bytes without mangling legitimate input. Implemented as a codepoint scan
 * to avoid embedding raw control bytes in source.
 */
export function sanitizeText(value: string): string {
  let out = "";
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    const isControl = code < 0x20 || code === 0x7f;
    if (isControl && !ALLOWED_CONTROL.has(code)) continue;
    out += ch;
  }
  return out;
}

/**
 * Normalize user-supplied option values against the module's declared schema.
 * Never throws — unknown keys are dropped, numbers are coerced and clamped,
 * select values must be one of the declared choices, text is sanitized,
 * trimmed and capped.
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
      const s = sanitizeText(String(value)).trim();
      if (s) out[opt.key] = s.slice(0, OPTION_TEXT_CAP);
    }
  }
  return out;
}

/**
 * Validate an incoming generation request body. Pure (no I/O, no API key) so it
 * can be unit-tested directly. `allowedModels`, `maxInputChars` and
 * `maxFieldChars` are injected by the caller (from config).
 */
export function parseGenerateRequest(
  body: GenerateBody,
  allowedModels: readonly string[],
  maxInputChars = 8000,
  maxFieldChars = 3000,
  limits: ParseLimits = {},
): ParseResult {
  const caps: Required<ParseLimits> = {
    maxSourceChars: limits.maxSourceChars ?? 20000,
    maxAttachments: limits.maxAttachments ?? 10,
    maxImageBytes: limits.maxImageBytes ?? 5 * 1024 * 1024,
    maxPdfBytes: limits.maxPdfBytes ?? 10 * 1024 * 1024,
    maxTotalUploadBytes: limits.maxTotalUploadBytes ?? 18 * 1024 * 1024,
  };

  const moduleId = typeof body.module === "string" ? body.module.trim() : "";
  const input = typeof body.input === "string" ? sanitizeText(body.input).trim() : "";
  const sourceText = typeof body.sourceText === "string" ? sanitizeText(body.sourceText).trim() : "";
  const model =
    typeof body.model === "string" && body.model.trim() !== ""
      ? body.model.trim()
      : undefined;

  if (!moduleId) return { ok: false, error: "`module` is required." };

  const module = getModule(moduleId);
  if (!module) return { ok: false, error: `Unknown module: ${moduleId}` };

  // Attachments (photos / PDF).
  const attach = parseAttachments(body.attachments, caps);
  if (!attach.ok) return { ok: false, error: attach.error };
  const attachments = attach.list;

  // Need *something* to work from: form text, pasted source, or an upload.
  if (!input && !sourceText && attachments.length === 0) {
    return { ok: false, error: "내용을 입력하거나 자료(사진·본문)를 올려주세요." };
  }
  if (input.length > maxInputChars) {
    return { ok: false, error: `입력이 너무 길어요. (최대 ${maxInputChars}자)` };
  }
  if (sourceText.length > caps.maxSourceChars) {
    return { ok: false, error: `붙여넣은 본문이 너무 길어요. (최대 ${caps.maxSourceChars}자)` };
  }

  if (model && !allowedModels.includes(model)) {
    return {
      ok: false,
      error: `Model not allowed: ${model}. Allowed models: ${allowedModels.join(", ")}`,
    };
  }

  // Per-field guard: reject any single guide/option text field that is too long
  // (the frontend also caps these, but never trust the client).
  if (typeof body.options === "object" && body.options !== null) {
    for (const value of Object.values(body.options as Record<string, unknown>)) {
      if (typeof value === "string" && value.length > maxFieldChars) {
        return { ok: false, error: `한 항목이 너무 길어요. (최대 ${maxFieldChars}자)` };
      }
    }
  }

  const optionValues = normalizeOptionValues(module, body.options);

  return {
    ok: true,
    options: {
      module,
      input,
      model,
      optionValues,
      ...(sourceText ? { sourceText } : {}),
      ...(attachments.length ? { attachments } : {}),
    },
  };
}
