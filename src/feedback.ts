import { sanitizeText } from "./validation.js";

/**
 * Anonymous post-use feedback. Every field is optional; we never store IP, name,
 * or any personal data — only the answers + a timestamp (added by the route).
 */
export interface Feedback {
  rating: number | null; // 1–5 stars (만족도)
  usable: string | null; // 결과물을 바로 쓸 만했나: yes | some | no
  easyForm: string | null; // 입력 폼이 쉬웠나: yes | ok | no
  reuse: string | null; // 또 쓸 건가: yes | maybe | no
  comment: string; // 한 줄 자유 의견
  module: string; // which tool it was about (context only)
}

const USABLE = new Set(["yes", "some", "no"]);
const EASY = new Set(["yes", "ok", "no"]);
const REUSE = new Set(["yes", "maybe", "no"]);

function enumOrNull(v: unknown, set: Set<string>): string | null {
  return typeof v === "string" && set.has(v) ? v : null;
}

/**
 * Validate/normalize a feedback submission. Returns null when the body isn't an
 * object or carries no usable signal at all (so we don't store empty rows).
 * Pure (no I/O) — unit-tested directly.
 */
export function parseFeedback(body: unknown): Feedback | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;

  const ratingRaw = Number(b.rating);
  const rating = Number.isInteger(ratingRaw) && ratingRaw >= 1 && ratingRaw <= 5 ? ratingRaw : null;
  const comment = typeof b.comment === "string" ? sanitizeText(b.comment).trim().slice(0, 500) : "";
  const moduleId = typeof b.module === "string" ? sanitizeText(b.module).trim().slice(0, 50) : "";

  const fb: Feedback = {
    rating,
    usable: enumOrNull(b.usable, USABLE),
    easyForm: enumOrNull(b.easyForm, EASY),
    reuse: enumOrNull(b.reuse, REUSE),
    comment,
    module: moduleId,
  };

  const hasSignal = fb.rating !== null || fb.usable || fb.easyForm || fb.reuse || fb.comment;
  return hasSignal ? fb : null;
}
