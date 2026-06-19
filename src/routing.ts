/**
 * Automatic, rule-based model routing — NO extra "difficulty classifier" call.
 * The model is chosen from signals we already have: the module, the user's chosen
 * 난이도 (where present), and input size.
 *
 * THIS IS THE ONE CONFIG PLACE. To re-tune which model a task uses after testing,
 * edit MODELS / MODULE_TIER below — nothing else needs to change.
 *
 * Default = Sonnet (standard). Escalate to Opus (heavy) only for hard cases.
 * Haiku (light) is available for very light tasks but isn't used by default.
 */

export type Tier = "light" | "standard" | "heavy";

export const MODELS: Record<Tier, string> = {
  light: "claude-haiku-4-5",
  standard: "claude-sonnet-4-6",
  heavy: "claude-opus-4-8",
};

// Per-module base tier. Anything not listed defaults to "standard" (Sonnet).
// Complex/long-form work that benefits from the strongest model → "heavy" (Opus).
export const MODULE_TIER: Record<string, Tier> = {
  exam: "heavy", // 시험지 + 정밀 해설지
  "cover-letter": "heavy", // 자기소개서 (서사형)
  "creative-writing": "heavy", // 소설·글쓰기 (장문 창작)
  // standard (Sonnet) — listed for clarity; the default is also "standard":
  worksheet: "standard",
  quiz: "standard",
  vocabulary: "standard",
  "study-notes": "standard",
  ppt: "standard",
  resume: "standard",
  "lesson-plan": "standard",
  excel: "standard",
};

// A very large request (e.g. lots of pasted source material) is worth the
// stronger model even on an otherwise-standard task.
const LARGE_INPUT_CHARS = 12000;

/** Base tier for a module (before difficulty/size adjustments). */
export function moduleTier(moduleId: string): Tier {
  return MODULE_TIER[moduleId] ?? "standard";
}

/**
 * Final tier for one generation. Pure + side-effect free so it can be mirrored
 * on the client (for the loading note) and unit-tested.
 *  - 난이도 상 → Opus (heavy)
 *  - 난이도 하 → at most Sonnet (never drops to Haiku)
 *  - very large input → at least Opus
 */
export function routeTier(moduleId: string, difficulty?: string, inputLen = 0): Tier {
  let tier = moduleTier(moduleId);
  if (difficulty === "상") tier = "heavy";
  else if (difficulty === "하") tier = tier === "heavy" ? "standard" : tier;
  if (inputLen > LARGE_INPUT_CHARS && tier !== "heavy") tier = "heavy";
  return tier;
}

export function routeModel(moduleId: string, difficulty?: string, inputLen = 0): { tier: Tier; model: string } {
  const tier = routeTier(moduleId, difficulty, inputLen);
  return { tier, model: MODELS[tier] };
}

/** UI weight for the loading note: heavy tasks get the "더 꼼꼼하게" message. */
export function taskWeight(moduleId: string, difficulty?: string, inputLen = 0): "heavy" | "light" {
  return routeTier(moduleId, difficulty, inputLen) === "heavy" ? "heavy" : "light";
}
