// vocab-pdf.mjs — render generated 단어장 Markdown into a polished, branded A4
// vocabulary PDF in the reference "READING & WRITING" style (maroon eyebrow +
// navy title, navy section bars, red entry numbers, POS pills, IPA, example +
// translation). Headless Chromium prints the HTML; Korean fonts are embedded
// from fonts/ so nothing breaks on any machine.
//
//   node scripts/vocab-pdf.mjs --in outputs/단어장.md --out outputs/단어장.pdf \
//        --title "Unit 3 & 4 VOCABULARY" --subtitle "기말고사 대비 핵심 단어장" --brand "READING & WRITING"
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i += 1) {
    const k = argv[i];
    if (k === "--in") a.in = argv[++i];
    else if (k === "--out") a.out = argv[++i];
    else if (k === "--title") a.title = argv[++i];
    else if (k === "--subtitle") a.subtitle = argv[++i];
    else if (k === "--brand") a.brand = argv[++i];
  }
  return a;
}

const escapeHtml = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const clean = (s) => String(s ?? "").replace(/\s+$/g, "").replace(/\*\*/g, "").trim();

// Parse the 단어장 markdown the skill produces:
//   **N · word** [ipa] · 품사 — 뜻      (entry head)
//   English example sentence            (line 2)
//   Korean translation                  (line 3)
//   ## 주제                             (optional section heading → navy bar)
function parseVocab(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const sections = [];
  let cur = { name: "", entries: [] };
  let title = "";
  const head = /^\s*\*\*\s*(\d+)\s*[·.]\s*(.+?)\s*\*\*\s*(?:\[([^\]]+)\])?\s*[·]?\s*([^—–-]+?)\s*[—–-]\s*(.+)$/;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    if (/^#\s+/.test(line) && !title) { title = clean(line.replace(/^#\s+/, "")); continue; }
    const sec = line.match(/^#{2,3}\s+(.*)$/);
    if (sec) {
      if (cur.entries.length) sections.push(cur);
      cur = { name: clean(sec[1]), entries: [] };
      continue;
    }
    const m = line.match(head);
    if (m) {
      const entry = { n: m[1], word: clean(m[2]), ipa: clean(m[3] || ""), pos: clean(m[4]), meaning: clean(m[5]), example: "", translation: "" };
      // next two non-empty lines: English example, Korean translation
      const grab = [];
      let j = i + 1;
      while (j < lines.length && grab.length < 2) {
        const l = lines[j].trim();
        if (!l) { j += 1; continue; }
        if (head.test(l) || /^#{1,3}\s+/.test(l)) break;
        grab.push(clean(l));
        j += 1;
      }
      i = j - 1;
      if (grab[0]) entry.example = grab[0];
      if (grab[1]) entry.translation = grab[1];
      cur.entries.push(entry);
    }
  }
  if (cur.entries.length) sections.push(cur);
  return { title, sections };
}

async function fontCSS() {
  const b64 = async (f) => (await readFile(path.join(ROOT, "fonts", f))).toString("base64");
  const [r, b, dv] = await Promise.all([
    b64("NotoSansKR-Regular.ttf"),
    b64("NotoSansKR-Bold.ttf"),
    b64("DejaVuSans.ttf"),
  ]);
  const face = (fam, w, d) => `@font-face{font-family:'${fam}';font-weight:${w};font-style:normal;src:url(data:font/ttf;base64,${d}) format('truetype');}`;
  return [face("KR", 400, r), face("KR", 700, b), face("IPA", 400, dv)].join("\n");
}

function render(model, css, opts) {
  const { title, sections } = model;
  const NAVY = "#192744", MAROON = "#9B2742", GRAY = "#6B7280", INK = "#23262e";
  const brand = opts.brand ? `${escapeHtml(opts.brand)}` : "READING &amp; WRITING";
  const subtitle = opts.subtitle ? escapeHtml(opts.subtitle) : "기말고사 대비 핵심 단어장";
  const legend = "n 명사 · v 동사 · adj 형용사 · adv 부사 · phr 구동사 · prep 전치사";

  const entryHtml = (e) => `
    <div class="entry">
      <div class="num">${escapeHtml(e.n)}</div>
      <div class="body">
        <div class="line1">
          <span class="word">${escapeHtml(e.word)}</span>
          ${e.ipa ? `<span class="ipa">[${escapeHtml(e.ipa)}]</span>` : ""}
          ${e.pos ? `<span class="pos">${escapeHtml(e.pos)}</span>` : ""}
        </div>
        <div class="meaning">${escapeHtml(e.meaning)}</div>
        ${e.example ? `<div class="ex">${escapeHtml(e.example)}</div>` : ""}
        ${e.translation ? `<div class="tr">${escapeHtml(e.translation)}</div>` : ""}
      </div>
    </div>`;

  const sectionsHtml = sections
    .map((s, i) => {
      const bar = s.name ? `<div class="secbar"><span class="sq"></span>${escapeHtml(s.name)}</div>` : (i === 0 ? "" : "");
      return `${bar}<div class="entries">${s.entries.map(entryHtml).join("")}</div>`;
    })
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}
@page{size:A4;margin:16mm 15mm 16mm 15mm;}
*{box-sizing:border-box}
body{font-family:'IPA','KR',sans-serif;color:${INK};margin:0;font-size:11pt;line-height:1.5;}
.eyebrow{color:${MAROON};font-weight:700;font-size:9.5pt;letter-spacing:.18em;text-transform:uppercase;}
.title{color:${NAVY};font-weight:700;font-size:23pt;letter-spacing:-.01em;margin:4pt 0 2pt;}
.sub{color:${GRAY};font-size:11pt;margin-bottom:8pt;}
.rule{border:0;border-top:2px solid ${MAROON};margin:6pt 0 7pt;}
.legend{color:${GRAY};font-size:8.6pt;letter-spacing:.01em;margin-bottom:4pt;}
.secbar{background:${NAVY};color:#fff;font-weight:700;font-size:11.5pt;padding:7pt 12pt;margin:14pt 0 10pt;border-radius:3px;display:flex;align-items:center;break-after:avoid;}
.secbar .sq{display:inline-block;width:9px;height:9px;background:#A8894E;margin-right:9px;border-radius:1px;}
.entry{display:grid;grid-template-columns:26px 1fr;gap:4px 10px;padding:7pt 0;border-bottom:1px solid #EFEAE0;break-inside:avoid;}
.num{color:${MAROON};font-weight:700;font-size:12pt;text-align:right;padding-top:1pt;}
.line1{display:flex;align-items:baseline;flex-wrap:wrap;gap:7px;}
.word{color:${NAVY};font-weight:700;font-size:15pt;}
.ipa{color:${GRAY};font-size:10pt;}
.pos{background:#F3E1E5;color:${MAROON};font-weight:700;font-size:8.4pt;padding:1.5pt 7pt;border-radius:10px;}
.meaning{color:${NAVY};font-weight:700;font-size:11.5pt;margin-top:2pt;}
.ex{font-style:italic;color:#3a4256;font-size:10.5pt;margin-top:3pt;}
.tr{color:${GRAY};font-size:10pt;margin-top:1pt;}
</style></head><body>
<div class="eyebrow">${brand}</div>
<div class="title">${escapeHtml(title || "VOCABULARY")}</div>
<div class="sub">${subtitle}</div>
<hr class="rule">
<div class="legend">${legend}</div>
${sectionsHtml}
</body></html>`;
}

function findChromium() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  if (!existsSync(base)) return null;
  for (const d of readdirSync(base).filter((e) => /^chromium-/.test(e)).sort().reverse()) {
    const p = path.join(base, d, "chrome-linux", "chrome");
    if (existsSync(p)) return p;
  }
  return null;
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  if (!a.out) { console.error("필요: --out <경로.pdf>"); process.exit(2); }
  const md = a.in ? await readFile(a.in, "utf8") : await (async () => {
    const c = []; for await (const x of process.stdin) c.push(x); return Buffer.concat(c).toString("utf8");
  })();
  if (!md.trim()) { console.error("단어장 내용이 비어 있어요."); process.exit(2); }

  const model = parseVocab(md);
  if (a.title) model.title = a.title;
  if (!model.sections.length) { console.error("단어 항목을 찾지 못했어요. 형식: **1 · word** [ipa] · 품사 — 뜻"); process.exit(1); }
  const css = await fontCSS();
  const html = render(model, css, a);

  const { chromium } = await import("playwright");
  const args = ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"];
  let browser;
  try { browser = await chromium.launch({ args }); }
  catch { browser = await chromium.launch({ args, executablePath: findChromium() }); }
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(async () => { if (document.fonts?.ready) await document.fonts.ready; });
    await mkdir(path.dirname(path.resolve(a.out)) || ".", { recursive: true });
    await page.pdf({ path: a.out, format: "A4", printBackground: true, margin: { top: "16mm", bottom: "16mm", left: "15mm", right: "15mm" } });
  } finally { await browser.close(); }
  const count = model.sections.reduce((n, s) => n + s.entries.length, 0);
  console.log(`✓ ${a.out}  (${count}단어)`);
}

main().catch((e) => { console.error("단어장 PDF 생성 실패:", e?.message || e); process.exit(1); });
