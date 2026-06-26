// verify-excel.mjs — sanity-check the formulas in a generated 엑셀 answer by
// actually EVALUATING them (HyperFormula), instead of trusting that a
// plausible-looking formula is correct. Catches syntax errors, #NAME?/#REF!/#DIV0,
// unknown functions, and reports each formula's computed value on a seeded grid.
//
//   node scripts/verify-excel.mjs --in outputs/excel-answer.md
//
// It can't know the user's INTENDED result (that's the adversarial review A4 /
// prompts/review/excel.txt), but it proves a formula at least evaluates cleanly.
import { readFile } from "node:fs/promises";
import { HyperFormula } from "hyperformula";

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--in") a.in = argv[++i];
  }
  return a;
}

// Pull formulas out of a Markdown answer: inline code spans (`=...`) and fenced
// lines beginning with '='.
export function extractFormulas(md) {
  const set = new Set();
  for (const m of md.matchAll(/`\s*(=[^`\n]+?)\s*`/g)) set.add(m[1].trim());
  for (const raw of md.split(/\r?\n/)) {
    const t = raw.trim().replace(/^[-*]\s+/, "");
    if (/^=\s*[A-Za-z(+\-]/.test(t)) set.add(t);
  }
  return [...set];
}

// A generic 20x10 numeric grid so cell references resolve to *something*.
function seedGrid() {
  const data = [];
  for (let r = 0; r < 30; r += 1) {
    const row = [];
    for (let c = 0; c < 12; c += 1) row.push((r + 1) * (c + 1));
    data.push(row);
  }
  return data;
}

function classify(value) {
  // HyperFormula returns a DetailedCellError object for error results.
  if (value && typeof value === "object" && "value" in value && typeof value.value === "string" && value.value.startsWith("#")) {
    return { ok: false, shown: value.value, note: value.type || "error" };
  }
  if (value === null || value === undefined) return { ok: false, shown: "(empty)", note: "no value" };
  return { ok: true, shown: String(value), note: "" };
}

export function evaluateFormulas(formulas) {
  const results = [];
  const hf = HyperFormula.buildFromArray(seedGrid(), { licenseKey: "gpl-v3" });
  const sheetId = hf.getSheetId(hf.getSheetNames()[0]);
  const cell = { sheet: sheetId, col: 20, row: 0 }; // a far, empty cell
  for (const f of formulas) {
    let res;
    try {
      hf.setCellContents(cell, [[f]]);
      res = classify(hf.getCellValue(cell));
    } catch (e) {
      res = { ok: false, shown: "(parse error)", note: String(e?.message || e).split("\n")[0] };
    }
    results.push({ formula: f, ...res });
  }
  hf.destroy();
  return results;
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const md = a.in ? await readFile(a.in, "utf8") : await (async () => {
    const c = []; for await (const x of process.stdin) c.push(x); return Buffer.concat(c).toString("utf8");
  })();
  const formulas = extractFormulas(md);
  if (!formulas.length) {
    console.log("수식을 찾지 못했어요. (코드스팬 `=...` 또는 '='로 시작하는 줄)");
    return;
  }
  const results = evaluateFormulas(formulas);
  let bad = 0;
  console.log(`수식 ${results.length}개 평가 (시드 그리드 A1:L30):\n`);
  for (const r of results) {
    const mark = r.ok ? "O" : "X";
    if (!r.ok) bad += 1;
    console.log(`[${mark}] ${r.formula}`);
    console.log(`     → ${r.shown}${r.note ? "  (" + r.note + ")" : ""}`);
  }
  console.log(`\n평가 가능: ${results.length - bad} / 오류: ${bad}`);
  console.log("주의: 이 검사는 '깨끗이 계산되는가'만 봅니다. '의도한 값과 맞는가'는 prompts/review/excel.txt(적대적 리뷰)로 확인하세요.");
  if (bad) process.exitCode = 1;
}

// Only run as CLI (allow importing the pure functions for tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error("검증 실패:", e?.message || e); process.exit(1); });
}
