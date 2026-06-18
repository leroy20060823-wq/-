/**
 * First-visit onboarding survey: 5 yes/no answers → an internal "guidanceLevel".
 * No personal data is involved here — only the five booleans.
 *
 * Beginner signals (+1 each): q1 false, q2 false, q3 false, q4 true. (q5 is
 * motivation only and excluded from scoring.) 0–1 → "lite", 2–4 → "guided".
 * NOTE: never surface "초보/고급"-style labels in the UI — internal value only.
 */
export type GuidanceLevel = "lite" | "guided";

export interface SurveyAnswers {
  q1: boolean;
  q2: boolean;
  q3: boolean;
  q4: boolean;
  q5: boolean;
}

export function guidanceFromAnswers(a: SurveyAnswers): GuidanceLevel {
  const score = (a.q1 ? 0 : 1) + (a.q2 ? 0 : 1) + (a.q3 ? 0 : 1) + (a.q4 ? 1 : 0);
  return score >= 2 ? "guided" : "lite";
}

export function parseSurvey(body: unknown): SurveyAnswers | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  const out: Partial<SurveyAnswers> = {};
  for (const k of ["q1", "q2", "q3", "q4", "q5"] as const) {
    if (typeof b[k] !== "boolean") return null;
    out[k] = b[k] as boolean;
  }
  return out as SurveyAnswers;
}
