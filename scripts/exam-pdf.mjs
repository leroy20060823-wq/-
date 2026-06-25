// exam-pdf.mjs — render generated 시험지 Markdown into the polished, branded A4
// exam PDF (밤의 서재 스타일) using the project's own pipeline:
//   markdown → buildExamModel() (src/exam/parseExam.ts) → JSON → scripts/exam_pdf.py (WeasyPrint)
//
// This is the SAME renderer the web app uses (src/routes/exam.ts), so the skill
// output matches the reference design exactly. Run with tsx so the TS import works:
//   node --import tsx scripts/exam-pdf.mjs --in outputs/시험지.md --out outputs/시험지.pdf \
//        --title "중2 영어 단원평가" --difficulty "중" --scope "비교급" --time 50 \
//        --subtitle "기말 대비 모의고사" --brand ""
import { spawn, spawnSync } from "node:child_process";
import { writeFile, readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildExamModel } from "../src/exam/parseExam.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PY_SCRIPT = path.join(ROOT, "scripts", "exam_pdf.py");

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i += 1) {
    const k = argv[i];
    if (k === "--in") a.in = argv[++i];
    else if (k === "--out") a.out = argv[++i];
    else if (k === "--title") a.title = argv[++i];
    else if (k === "--difficulty") a.difficulty = argv[++i];
    else if (k === "--scope") a.scope = argv[++i];
    else if (k === "--time") a.time = Number(argv[++i]);
    else if (k === "--subtitle") a.subtitle = argv[++i];
    else if (k === "--brand") a.brand = argv[++i];
    else if (k === "--motto") a.motto = argv[++i];
    else if (k === "--notice") a.notice = argv[++i];
  }
  return a;
}

function pythonBin() {
  for (const bin of [process.env.PYTHON_BIN, "python3", "python"].filter(Boolean)) {
    const r = spawnSync(bin, ["--version"], { stdio: "ignore" });
    if (!r.error && r.status === 0) return bin;
  }
  return null;
}

function hasWeasyprint(bin) {
  return spawnSync(bin, ["-c", "import weasyprint"], { stdio: "ignore" }).status === 0;
}

function installWeasyprint(bin) {
  console.error("WeasyPrint가 없어 설치합니다 (최초 1회)…");
  const r = spawnSync(bin, ["-m", "pip", "install", "--quiet", "weasyprint"], { stdio: "inherit" });
  return r.status === 0 && hasWeasyprint(bin);
}

function runPython(bin, modelJson, outPath) {
  return new Promise((resolve) => {
    const proc = spawn(bin, [PY_SCRIPT, "--out", outPath], { stdio: ["pipe", "pipe", "pipe"] });
    const out = [];
    const err = [];
    proc.stdout.on("data", (d) => out.push(d));
    proc.stderr.on("data", (d) => err.push(d));
    proc.on("error", (e) => resolve({ code: 1, stdout: "", stderr: String(e) }));
    proc.on("close", (code) =>
      resolve({ code, stdout: Buffer.concat(out).toString("utf8"), stderr: Buffer.concat(err).toString("utf8") }),
    );
    proc.stdin.write(modelJson);
    proc.stdin.end();
  });
}

async function readInput(a) {
  if (a.in) return readFile(a.in, "utf8");
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  if (!a.out) {
    console.error("필요: --out <경로.pdf>");
    process.exit(2);
  }
  if (!existsSync(PY_SCRIPT)) {
    console.error(`렌더러를 찾을 수 없어요: ${PY_SCRIPT}`);
    process.exit(2);
  }
  const md = await readInput(a);
  if (!md.trim()) {
    console.error("시험지 내용이 비어 있어요. --in <파일> 또는 stdin 으로 마크다운을 주세요.");
    process.exit(2);
  }

  let bin = pythonBin();
  if (!bin) {
    console.error("python3 가 없어요. 시험지 PDF 렌더링에는 Python 3가 필요합니다.");
    process.exit(2);
  }
  if (!hasWeasyprint(bin) && !installWeasyprint(bin)) {
    console.error("WeasyPrint 설치에 실패했어요. `pip install weasyprint` 후 다시 시도해 주세요.");
    process.exit(2);
  }

  const model = buildExamModel(md, {
    title: a.title,
    scope: a.scope,
    timeMinutes: a.time,
    difficulty: a.difficulty,
    subtitle: a.subtitle,
    brand: a.brand,
    motto: a.motto,
    notice: a.notice,
  });

  await mkdir(path.dirname(path.resolve(a.out)) || ".", { recursive: true });
  const r = await runPython(bin, JSON.stringify(model), a.out);
  const log = r.stdout.split("\n").filter(Boolean).slice(-1)[0] ?? "";
  if (r.code === 0 && existsSync(a.out)) {
    console.log(`✓ ${a.out}`);
    if (log) console.log(`  QA: ${log}`);
  } else {
    console.error("시험지 PDF 생성 실패:", (r.stderr || r.stdout || "unknown").slice(-600));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("오류:", e?.message || e);
  process.exit(1);
});
