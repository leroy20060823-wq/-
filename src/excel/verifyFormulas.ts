/**
 * Real formula verification for the 엑셀 module — evaluates the formulas a
 * generated answer SHIPS (not just eyeballs them) against a dataset, using the
 * HyperFormula engine. Catches invented/misspelled functions and syntax errors,
 * and (with a known dataset) proves a formula returns the expected value.
 *
 * HyperFormula is a dev/QA-only dependency (GPLv3) — used here, never shipped in
 * the served app.
 */
import { HyperFormula } from "hyperformula";

const LICENSE = { licenseKey: "gpl-v3" } as const;

export type CellValue = string | number | boolean | null;

export interface FormulaCheck {
  formula: string;
  status: "ok" | "flag";
  value: CellValue;
  note: string;
}

// Inline code spans that start with '=' (how the prompt formats formulas).
const FORMULA_SPAN = /`(=[^`]+)`/g;

/** Pull the distinct formulas out of a generated Excel answer (Markdown). */
export function extractFormulas(markdown: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of (markdown ?? "").matchAll(FORMULA_SPAN)) {
    const f = (m[1] ?? "").trim();
    if (f.length > 1 && !seen.has(f)) {
      seen.add(f);
      out.push(f);
    }
  }
  return out;
}

function isCellError(v: unknown): v is { type: string; value: string } {
  return !!v && typeof v === "object" && "type" in (v as Record<string, unknown>);
}

/**
 * HyperFormula treats bare TRUE/FALSE as names (#NAME?), but they're valid Excel
 * boolean literals (e.g. VLOOKUP(..., FALSE)). Convert them to TRUE()/FALSE()
 * outside quoted strings so we don't false-flag legitimate formulas.
 */
function normalizeBooleans(formula: string): string {
  const parts = formula.split('"');
  for (let i = 0; i < parts.length; i += 2) {
    parts[i] = (parts[i] ?? "")
      .replace(/\bTRUE\b(?!\s*\()/gi, "TRUE()")
      .replace(/\bFALSE\b(?!\s*\()/gi, "FALSE()");
  }
  return parts.join('"');
}

/**
 * Evaluate one formula against a synthetic grid (2D array). The formula is placed
 * in a free cell to one side of the data (so whole-column refs like A:A don't
 * become circular), then read back.
 *  - concrete value  → ok
 *  - #NAME?          → flag (unknown/misspelled function)
 *  - #ERROR! (parse) → flag (syntax error)
 *  - #DIV/0! / #N/A / #REF! → ok-with-note (often just a synthetic-data mismatch)
 */
export function verifyFormula(formula: string, grid: CellValue[][] = []): FormulaCheck {
  const data = grid.map((row) => row.slice());
  if (data.length === 0) data.push([]);
  const maxCols = data.reduce((m, r) => Math.max(m, r.length), 0);
  const fcol = maxCols + 1;
  const row0 = data[0]!;
  while (row0.length < fcol) row0.push(null);
  row0[fcol] = normalizeBooleans(formula);

  let v: unknown;
  try {
    const hf = HyperFormula.buildFromArray(data, LICENSE);
    v = hf.getCellValue({ sheet: 0, row: 0, col: fcol });
    hf.destroy();
  } catch (e) {
    return { formula, status: "flag", value: null, note: `엔진 오류: ${String(e).slice(0, 80)}` };
  }

  if (isCellError(v)) {
    if (v.type === "NAME") return { formula, status: "flag", value: v.value, note: "알 수 없는 함수/이름" };
    if (v.type === "ERROR") return { formula, status: "flag", value: v.value, note: "수식 구문 오류" };
    return { formula, status: "ok", value: v.value, note: `평가됨(${v.value}) — 합성 데이터 기준` };
  }
  return { formula, status: "ok", value: v as CellValue, note: "" };
}

export interface VerifyReport {
  total: number;
  ok: number;
  flagged: number;
  rows: FormulaCheck[];
}

/** Extract + verify every formula in a generated answer. */
export function verifyAnswer(markdown: string, grid?: CellValue[][]): VerifyReport {
  const rows = extractFormulas(markdown).map((f) => verifyFormula(f, grid));
  return {
    total: rows.length,
    ok: rows.filter((r) => r.status === "ok").length,
    flagged: rows.filter((r) => r.status === "flag").length,
    rows,
  };
}
