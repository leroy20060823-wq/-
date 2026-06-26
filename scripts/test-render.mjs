#!/usr/bin/env node
/**
 * Golden-file render regression test for the exam PDF.
 *
 * Renders scripts/exam_fixture.json (teacher + key variants) with WeasyPrint and
 * extracts a STABLE structural summary — page count, embedded-font set, A–E choice
 * glyphs, and section presence — then asserts it against committed goldens in
 * scripts/golden/render.json. A silent renderer/parser regression (e.g. 5지선다 →
 * 4지선다, or a font that stops embedding) makes this fail loudly.
 *
 *   npm run test:render               # assert against goldens
 *   UPDATE_GOLDENS=1 npm run test:render   # (re)generate goldens intentionally
 *
 * CI-friendly: if WeasyPrint / poppler (pdffonts·pdftotext·pdfinfo) are unavailable
 * it SKIPS with a clear message instead of failing.
 */
import { spawnSync, execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const goldenPath = join(here, "golden", "render.json");
const UPDATE = process.env.UPDATE_GOLDENS === "1";
const PY = process.env.PYTHON_BIN || "python3";

const CASES = [
  { fixture: "exam_fixture.json", variant: "teacher" },
  { fixture: "exam_fixture.json", variant: "key" },
];

function skip(msg) {
  console.log(`SKIP test:render — ${msg}`);
  process.exit(0);
}

function isMissing(cmd) {
  const r = spawnSync(cmd, [], { stdio: "ignore" });
  return r.error && r.error.code === "ENOENT";
}

// --- availability gate ---
for (const t of ["pdffonts", "pdftotext", "pdfinfo"]) {
  if (isMissing(t)) skip(`'${t}' not installed (poppler-utils)`);
}
if (spawnSync(PY, ["-c", "import weasyprint"], { stdio: "ignore" }).status !== 0) {
  skip(`WeasyPrint not available via '${PY}'`);
}

const tmp = mkdtempSync(join(tmpdir(), "render-golden-"));

function render(fixture, variant) {
  const out = join(tmp, `${fixture}.${variant}.pdf`);
  const r = spawnSync(
    PY,
    [join(here, "exam_pdf.py"), "--in", join(here, fixture), "--variant", variant, "--out", out],
    { encoding: "utf8" },
  );
  const blob = `${r.stdout || ""}${r.stderr || ""}`;
  if (r.status !== 0) {
    if (/weasyprint|ModuleNotFound/i.test(blob)) skip("WeasyPrint unavailable at render time");
    console.error(`render failed (${fixture}/${variant}):\n${blob}`);
    process.exit(1);
  }
  return out;
}

function summarize(pdf) {
  const fontsRaw = execFileSync("pdffonts", [pdf], { encoding: "utf8" }).trim().split("\n").slice(2);
  const fonts = [];
  let allEmbedded = true;
  for (const ln of fontsRaw) {
    // 'type' can be two words (e.g. "CID TrueType"), so anchor on the emb/sub/uni
    // yes|no triple that precedes the object id columns.
    const flags = ln.match(/(yes|no)\s+(yes|no)\s+(yes|no)\s+\d+\s+\d+\s*$/);
    const name = (ln.trim().split(/\s+/)[0] || "").replace(/^[A-Z]{6}\+/, ""); // drop subset prefix
    if (!name) continue;
    fonts.push(name);
    if (!flags || flags[1] !== "yes") allEmbedded = false;
  }
  const text = execFileSync("pdftotext", [pdf, "-"], { encoding: "utf8" });
  const info = execFileSync("pdfinfo", [pdf], { encoding: "utf8" });
  const pages = Number((info.match(/Pages:\s*(\d+)/) || [])[1] || 0);
  const glyphs = [..."①②③④⑤"].filter((g) => text.includes(g)).join("");
  return {
    pages,
    fontsAllEmbedded: allEmbedded,
    fonts: [...new Set(fonts)].sort(),
    glyphs,
    glyphCount: (text.match(/[①②③④⑤]/g) || []).length,
    sections: {
      answerKey: /정답표/.test(text),
      explanations: /정밀 해설|해설/.test(text),
      omr: /OMR/.test(text),
    },
  };
}

const results = {};
for (const { fixture, variant } of CASES) {
  results[`${fixture.replace(/\.json$/, "")}.${variant}`] = summarize(render(fixture, variant));
}

if (UPDATE || !existsSync(goldenPath)) {
  mkdirSync(dirname(goldenPath), { recursive: true });
  writeFileSync(goldenPath, JSON.stringify(results, null, 2) + "\n");
  console.log(`${UPDATE ? "UPDATED" : "CREATED"} golden → ${goldenPath}`);
  for (const k of Object.keys(results)) console.log(`  ${k}: ${JSON.stringify(results[k])}`);
  process.exit(0);
}

const golden = JSON.parse(readFileSync(goldenPath, "utf8"));
let failed = false;
for (const k of Object.keys(results)) {
  const a = JSON.stringify(golden[k] ?? null);
  const b = JSON.stringify(results[k]);
  if (a !== b) {
    failed = true;
    console.error(`MISMATCH ${k}\n  golden: ${a}\n  actual: ${b}`);
  }
}
if (failed) {
  console.error("\ntest:render FAILED — if this change is intentional, run: UPDATE_GOLDENS=1 npm run test:render");
  process.exit(1);
}
console.log(`test:render PASS ✅ (${Object.keys(results).join(", ")})`);
