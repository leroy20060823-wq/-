// export.mjs — turn generated Markdown into a real, editable file you can print
// or hand out: .docx (Word), .hwpx (한글/Hancom), .pptx (PowerPoint), or .md.
//
// The Claude Code skills (.claude/skills/*) call this after generating an
// artifact, so the same Markdown that appears in chat becomes a downloadable
// document — all offline (Node), no external API.
//
// Usage:
//   node scripts/export.mjs --in <file.md> --format docx --out outputs/시험지.docx --title "시험지"
//   node scripts/export.mjs --in deck.md   --format pptx --out outputs/발표.pptx
//   node scripts/export.mjs --in x.md      --format docx,hwpx,md --out outputs/x   (one base, many files)
//   cat x.md | node scripts/export.mjs --stdin --format hwpx --out outputs/x.hwpx
//
// Mirrors the document mapping used by the browser exporters in public/docx.js,
// public/hwpx.js and public/pptx.js, but driven by marked's Markdown lexer
// (no DOM) so it runs server-side.
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { marked } from "marked";

// ---------------------------------------------------------------- args ----
function parseArgs(argv) {
  const a = { format: "docx", paper: "a4" };
  for (let i = 0; i < argv.length; i += 1) {
    const k = argv[i];
    if (k === "--stdin") a.stdin = true;
    else if (k === "--in") a.in = argv[++i];
    else if (k === "--out") a.out = argv[++i];
    else if (k === "--format") a.format = argv[++i];
    else if (k === "--title") a.title = argv[++i];
    else if (k === "--paper") a.paper = argv[++i];
  }
  return a;
}

function decodeEntities(s) {
  return String(s)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#x27;/gi, "'")
    .replace(/&nbsp;/g, " ");
}

function sanitizeName(s) {
  return String(s || "").replace(/[^\w가-힣 .-]/g, "").trim().slice(0, 60) || "문서";
}

// Flatten marked inline tokens → [{ text, bold, italic, code, br }].
function inlineSegments(tokens, fmt = {}) {
  const segs = [];
  const walk = (toks, f) => {
    for (const tk of toks || []) {
      switch (tk.type) {
        case "strong": walk(tk.tokens, { ...f, bold: true }); break;
        case "em": walk(tk.tokens, { ...f, italic: true }); break;
        case "del": walk(tk.tokens, f); break;
        case "link": walk(tk.tokens, f); break;
        case "codespan": segs.push({ text: decodeEntities(tk.text), ...f, code: true }); break;
        case "br": segs.push({ text: "", ...f, br: true }); break;
        case "escape": segs.push({ text: tk.text, ...f }); break;
        case "html": break;
        case "text":
          if (tk.tokens && tk.tokens.length) walk(tk.tokens, f);
          else segs.push({ text: decodeEntities(tk.text), ...f });
          break;
        default:
          if (tk.tokens && tk.tokens.length) walk(tk.tokens, f);
          else if (tk.text != null) segs.push({ text: decodeEntities(tk.text), ...f });
      }
    }
  };
  walk(tokens, fmt);
  return segs.length ? segs : [{ text: "" }];
}

const cellText = (cell) =>
  inlineSegments(cell.tokens || []).map((s) => s.text).join("").trim();

// ----------------------------------------------------------- .docx -------
async function buildDocx(tokens, { title, paper }) {
  const D = await import("docx");
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle } = D;
  const KO = "맑은 고딕";
  const MONO = "Consolas";
  const INK = "192744";
  const PAPER = {
    a4: { width: 11906, height: 16838 },
    letter: { width: 12240, height: 15840 },
    b5: { width: 9978, height: 14173 },
  };

  const runs = (segs, base = {}) =>
    segs.map((s) =>
      new TextRun({
        text: s.br ? "" : s.text,
        break: s.br ? 1 : undefined,
        bold: base.bold || s.bold || undefined,
        italics: base.italics || s.italic || undefined,
        font: s.code ? MONO : KO,
        size: base.size || 22,
        color: base.color,
      }),
    );

  const border = { style: BorderStyle.SINGLE, size: 4, color: "D8D2C4" };
  const tableBorders = { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border };

  const tableFrom = (tk) => {
    const rows = [];
    const headerCells = (tk.header || []).map(
      (c) =>
        new TableCell({
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          shading: { type: "clear", fill: INK },
          children: [new Paragraph({ children: runs(inlineSegments(c.tokens || []), { size: 20, bold: true, color: "FFFFFF" }) })],
        }),
    );
    if (headerCells.length) rows.push(new TableRow({ children: headerCells, tableHeader: true }));
    for (const r of tk.rows || []) {
      const cells = r.map(
        (c) =>
          new TableCell({
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [new Paragraph({ children: runs(inlineSegments(c.tokens || []), { size: 20 }) })],
          }),
      );
      if (cells.length) rows.push(new TableRow({ children: cells }));
    }
    return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows, borders: tableBorders });
  };

  const out = [];
  for (const tk of tokens) {
    if (tk.type === "heading") {
      const size = tk.depth <= 1 ? 34 : tk.depth === 2 ? 28 : 24;
      out.push(new Paragraph({ spacing: { before: 240, after: 110 }, children: runs(inlineSegments(tk.tokens || []), { bold: true, size, color: INK }) }));
    } else if (tk.type === "paragraph") {
      out.push(new Paragraph({ spacing: { after: 140, line: 312 }, children: runs(inlineSegments(tk.tokens || []), { size: 22 }) }));
    } else if (tk.type === "list") {
      let i = 0;
      for (const item of tk.items) {
        i += 1;
        const segs = inlineSegments(item.tokens || []);
        if (tk.ordered) {
          out.push(new Paragraph({ spacing: { after: 70, line: 300 }, indent: { left: 360 }, children: [new TextRun({ text: `${(tk.start || 1) + i - 1}. `, font: KO, size: 22 }), ...runs(segs, { size: 22 })] }));
        } else {
          out.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 70, line: 300 }, children: runs(segs, { size: 22 }) }));
        }
      }
    } else if (tk.type === "table") {
      out.push(tableFrom(tk));
      out.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
    } else if (tk.type === "blockquote") {
      out.push(new Paragraph({ indent: { left: 480 }, spacing: { after: 140 }, children: runs(inlineSegments(tk.tokens?.flatMap((t) => t.tokens || []) || []), { italics: true, size: 22 }) }));
    } else if (tk.type === "code") {
      out.push(new Paragraph({ spacing: { after: 140 }, children: [new TextRun({ text: tk.text || "", font: MONO, size: 20 })] }));
    } else if (tk.type === "hr") {
      out.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "CCCCCC" } }, spacing: { after: 120 } }));
    }
  }
  if (!out.length) out.push(new Paragraph({ children: [new TextRun({ text: "", font: KO, size: 22 })] }));

  const size = PAPER[paper] || PAPER.a4;
  const doc = new Document({
    creator: "올인원 AI",
    title: title || "문서",
    styles: { default: { document: { run: { font: KO, size: 22 } } } },
    sections: [{ properties: { page: { size: { width: size.width, height: size.height }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } }, children: out }],
  });
  return Packer.toBuffer(doc);
}

// ----------------------------------------------------------- .hwpx ------
async function buildHwpx(tokens, { paper }) {
  const hwpx = await import("hwpx-js");
  const KO = "함초롬바탕";
  const HEAD = "함초롬돋움";
  const PAPER = { a4: { width: 210, height: 297 }, letter: { width: 216, height: 279 }, b5: { width: 176, height: 250 } };
  const b = new hwpx.HWPXBuilder();
  const sz = PAPER[paper] || PAPER.a4;
  b.setPageSettings({ width: sz.width, height: sz.height, marginLeft: 20, marginRight: 20, marginTop: 20, marginBottom: 20 });

  const styled = (segs, base = {}) =>
    segs.map((s) => ({
      text: s.br ? "\n" : s.text,
      style: { bold: base.bold || s.bold, italic: base.italic || s.italic, color: base.color, fontName: s.code ? KO : (base.fontName || KO), fontSize: base.fontSize || 11 },
    }));

  for (const tk of tokens) {
    if (tk.type === "heading") {
      const fs = tk.depth <= 1 ? 18 : tk.depth === 2 ? 14 : 12;
      b.addParagraph(inlineSegments(tk.tokens || []).map((s) => s.text).join(""), { fontSize: fs, bold: true, color: "#192744", fontName: HEAD });
    } else if (tk.type === "paragraph") {
      b.addStyledText(styled(inlineSegments(tk.tokens || [])));
    } else if (tk.type === "list") {
      let i = 0;
      for (const item of tk.items) {
        i += 1;
        const prefix = tk.ordered ? `${(tk.start || 1) + i - 1}. ` : "• ";
        b.addStyledText([{ text: prefix, style: { fontName: KO, fontSize: 11 } }, ...styled(inlineSegments(item.tokens || []))]);
      }
    } else if (tk.type === "table") {
      const data = [];
      if (tk.header?.length) data.push(tk.header.map(cellText));
      for (const r of tk.rows || []) data.push(r.map(cellText));
      if (data.length) {
        b.addTable(data, { headerRow: !!tk.header?.length, borderStyle: "SOLID" });
        b.addEmptyParagraph();
      }
    } else if (tk.type === "blockquote") {
      b.addParagraph(inlineSegments(tk.tokens?.flatMap((t) => t.tokens || []) || []).map((s) => s.text).join(""), { fontSize: 11, italic: true, fontName: KO });
    } else if (tk.type === "code") {
      b.addParagraph(tk.text || "", { fontSize: 10, fontName: KO });
    } else if (tk.type === "hr") {
      b.addEmptyParagraph();
    }
  }
  return Buffer.from(hwpx.write(b.build(), { compress: true }));
}

// ----------------------------------------------------------- .pptx ------
// Parse the slide contract from the PPT skill:
//   ## Slide N: <title>   → new slide
//   (one plain line)      → subtitle
//   - bullet              → bullets
//   > Speaker notes: ...  → speaker notes
function parseDeck(md) {
  const slides = [];
  let cur = null;
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trimEnd();
    const h = line.match(/^#{1,3}\s*(?:Slide|슬라이드)\s*\d+\s*[:：]?\s*(.*)$/i);
    if (h) {
      cur = { title: h[1].trim(), subtitle: "", bullets: [], notes: "" };
      slides.push(cur);
      continue;
    }
    if (!cur) {
      const top = line.replace(/^#+\s*/, "").trim();
      if (top) { cur = { title: top, subtitle: "", bullets: [], notes: "" }; slides.push(cur); }
      continue;
    }
    const note = line.match(/^>\s*(?:Speaker notes|발표\s*노트|발표노트)\s*[:：]?\s*(.*)$/i);
    if (note) { cur.notes += (cur.notes ? " " : "") + note[1].trim(); continue; }
    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) { cur.bullets.push(bullet[1].replace(/\*\*/g, "").trim()); continue; }
    const plain = line.replace(/^#+\s*/, "").replace(/\*\*/g, "").trim();
    if (plain && !cur.bullets.length && !cur.subtitle) cur.subtitle = plain;
    else if (plain) cur.bullets.push(plain);
  }
  return slides;
}

async function buildPptx(md, { title, out }) {
  const Mod = await import("pptxgenjs");
  const PptxGenJS = Mod.default || Mod;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "올인원 AI";
  pptx.title = title || "발표";
  const W = 13.333, H = 7.5, M = 0.7;
  const T = { bg: "FBF8F2", ink: "192744", sub: "6B7280", accent: "C2602E", onAccent: "FFFFFF" };
  const FONT = "Noto Sans KR";

  const deck = parseDeck(md);
  deck.forEach((s, idx) => {
    const slide = pptx.addSlide();
    slide.background = { color: T.bg };
    if (idx === 0) {
      slide.addShape("rect", { x: M, y: 2.85, w: 1.3, h: 0.14, fill: { color: T.accent } });
      slide.addText(s.title || pptx.title, { x: M, y: 3.1, w: W - 2 * M, h: 2.0, fontFace: FONT, fontSize: 44, bold: true, color: T.ink, align: "left", valign: "top", fit: "shrink" });
      if (s.subtitle) slide.addText(s.subtitle, { x: M, y: 5.0, w: W - 2 * M, h: 1.0, fontFace: FONT, fontSize: 22, color: T.sub, align: "left", valign: "top", fit: "shrink" });
      for (const b of s.bullets) {
        // a title slide rarely has bullets; if present, show as subtitle-ish line
      }
    } else {
      slide.addShape("rect", { x: M, y: 0.82, w: 0.14, h: 0.62, fill: { color: T.accent } });
      slide.addText(s.title || "", { x: M + 0.32, y: 0.7, w: W - 2 * M - 0.32, h: 0.95, fontFace: FONT, fontSize: 28, bold: true, color: T.ink, align: "left", valign: "middle", fit: "shrink" });
      const items = (s.bullets.length ? s.bullets : (s.subtitle ? [s.subtitle] : [""])).map((b) => ({ text: b, options: { bullet: { indent: 18 }, color: T.ink, breakLine: true } }));
      slide.addText(items, { x: M, y: 2.0, w: W - 2 * M, h: 4.7, fontFace: FONT, fontSize: 20, color: T.ink, align: "left", valign: "top", lineSpacingMultiple: 1.3, paraSpaceAfter: 10, fit: "shrink" });
      if (s.subtitle && s.bullets.length) {
        // subtitle already shown if no bullets; otherwise skip to keep slide light
      }
    }
    if (s.notes) slide.addNotes(s.notes);
  });
  if (!deck.length) pptx.addSlide().addText(title || "발표", { x: M, y: 3, w: W - 2 * M, h: 1.5, fontFace: FONT, fontSize: 40, bold: true, color: T.ink });
  await pptx.writeFile({ fileName: out });
}

// ------------------------------------------------------------- main -----
async function readInput(a) {
  if (a.in) return readFile(a.in, "utf8");
  // stdin (default when no --in)
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}

function outPathFor(base, fmt) {
  // If --out already ends with this format's extension, use it as-is; else treat
  // --out as a base name and append the extension.
  const ext = "." + fmt;
  if (base.toLowerCase().endsWith(ext)) return base;
  const stripped = base.replace(/\.(docx|hwpx|pptx|md)$/i, "");
  return stripped + ext;
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  if (!a.out) {
    console.error("필요: --out <경로>. 예) --out outputs/시험지.docx");
    process.exit(1);
  }
  const md = await readInput(a);
  if (!md.trim()) {
    console.error("입력 내용이 비어 있어요. --in <파일> 또는 --stdin 으로 마크다운을 주세요.");
    process.exit(1);
  }
  const title = a.title || sanitizeName((md.match(/^#{1,3}\s+(.+)$/m) || [])[1] || "문서");
  const formats = a.format.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const tokens = marked.lexer(md);

  await mkdir(path.dirname(path.resolve(a.out)) || ".", { recursive: true });
  const written = [];
  for (const fmt of formats) {
    const out = outPathFor(a.out, fmt);
    if (fmt === "md") {
      await writeFile(out, md, "utf8");
    } else if (fmt === "docx") {
      await writeFile(out, await buildDocx(tokens, { title, paper: a.paper }));
    } else if (fmt === "hwpx") {
      await writeFile(out, await buildHwpx(tokens, { paper: a.paper }));
    } else if (fmt === "pptx") {
      await buildPptx(md, { title, out });
    } else {
      console.error(`지원하지 않는 형식: ${fmt} (docx, hwpx, pptx, md 중 선택)`);
      continue;
    }
    written.push(out);
    console.log(`✓ ${out}`);
  }
  if (!written.length) process.exit(1);
}

main().catch((e) => {
  console.error("내보내기 실패:", e?.message || e);
  process.exit(1);
});
