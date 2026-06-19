/**
 * hwpx.js — export a native, editable 한글 (.hwpx) from a rendered document,
 * fully client-side via hwpx-js (pure JS, bundled with its only dep fflate — no
 * Python runtime, so it deploys like the rest of the app). Lazy-loaded on export.
 *
 * Maps the SAME document structure as the .docx export (headings, paragraphs,
 * lists, tables, quotes) to HWPXBuilder calls, so .docx and .hwpx come out
 * equivalent. Input is a rendered DOM element (from the same Markdown the preview
 * uses), so sample content works now and AI content flows through unchanged.
 *
 * Hancom 한글 reflows text across pages, so there's no overflow/clipping; the
 * on-screen preview is what runs through the doc QA loop.
 */

const KO_FONT = "함초롬바탕"; // HWP's native default — always present in 한글
const KO_HEAD = "함초롬돋움"; // native gothic for headings

// Paper sizes in millimetres (hwpx-js setPageSettings takes mm).
export const PAPER = {
  a4: { width: 210, height: 297 },
  letter: { width: 216, height: 279 },
  b5: { width: 176, height: 250 },
};

let modPromise = null;
function ensureHwpx() {
  if (!modPromise) modPromise = import("/vendor/hwpx-js.esm.js");
  return modPromise;
}

// Inline formatting → styled segments for addStyledText.
function segments(node, base) {
  const out = [];
  const walk = (n, fmt) => {
    for (const c of n.childNodes) {
      if (c.nodeType === 3) {
        const text = c.textContent;
        if (text)
          out.push({
            text,
            style: { bold: fmt.bold, italic: fmt.italic, color: base.color, fontName: fmt.code ? KO_FONT : base.fontName, fontSize: base.fontSize },
          });
      } else if (c.nodeType === 1) {
        const t = c.tagName;
        if (t === "BR") out.push({ text: "\n", style: { fontName: base.fontName, fontSize: base.fontSize } });
        else
          walk(c, {
            ...fmt,
            bold: fmt.bold || /^(STRONG|B)$/.test(t),
            italic: fmt.italic || /^(EM|I)$/.test(t),
            code: fmt.code || t === "CODE",
          });
      }
    }
  };
  walk(node, { bold: !!base.bold, italic: !!base.italic, code: false });
  if (out.length === 0)
    out.push({ text: node.textContent || "", style: { bold: !!base.bold, color: base.color, fontName: base.fontName, fontSize: base.fontSize } });
  return out;
}

function tableData(node) {
  const rows = [];
  node.querySelectorAll("tr").forEach((tr) => {
    const cells = [];
    tr.querySelectorAll("th,td").forEach((c) => cells.push((c.textContent || "").trim()));
    if (cells.length) rows.push(cells);
  });
  const max = rows.reduce((m, r) => Math.max(m, r.length), 0);
  rows.forEach((r) => {
    while (r.length < max) r.push("");
  });
  return rows;
}

function downloadBytes(bytes, filename) {
  const blob = new Blob([bytes], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function sanitizeName(s) {
  return String(s || "").replace(/[^\w가-힣 .-]/g, "").trim().slice(0, 60) || "문서";
}

/**
 * Build + download a native .hwpx from a rendered document element.
 * opts: { paper: "a4"|"letter"|"b5", title }
 */
export async function exportHwpx(sourceEl, opts = {}) {
  const hwpx = await ensureHwpx();
  const b = new hwpx.HWPXBuilder();
  const sz = PAPER[opts.paper] || PAPER.a4;
  b.setPageSettings({ width: sz.width, height: sz.height, marginLeft: 20, marginRight: 20, marginTop: 20, marginBottom: 20 });

  for (const node of sourceEl.children) {
    const tag = node.tagName;
    if (/^H[1-6]$/.test(tag)) {
      const lvl = Number(tag[1]);
      const fs = lvl <= 1 ? 18 : lvl === 2 ? 14 : 12;
      b.addParagraph((node.textContent || "").trim(), { fontSize: fs, bold: true, color: "#192744", fontName: KO_HEAD });
    } else if (tag === "P") {
      b.addStyledText(segments(node, { fontSize: 11, fontName: KO_FONT }));
    } else if (tag === "UL" || tag === "OL") {
      let i = 0;
      for (const li of node.children) {
        if (li.tagName !== "LI") continue;
        i += 1;
        const prefix = tag === "OL" ? `${i}. ` : "• ";
        b.addStyledText([{ text: prefix, style: { fontName: KO_FONT, fontSize: 11 } }, ...segments(li, { fontSize: 11, fontName: KO_FONT })]);
      }
    } else if (tag === "TABLE") {
      const data = tableData(node);
      if (data.length) {
        b.addTable(data, { headerRow: node.querySelector("thead") !== null, borderStyle: "SOLID" });
        b.addEmptyParagraph();
      }
    } else if (tag === "BLOCKQUOTE") {
      b.addParagraph((node.textContent || "").trim(), { fontSize: 11, italic: true, fontName: KO_FONT });
    } else if (tag === "PRE") {
      b.addParagraph(node.textContent || "", { fontSize: 10, fontName: KO_FONT });
    } else if (tag === "HR") {
      b.addEmptyParagraph();
    } else {
      const t = (node.textContent || "").trim();
      if (t) b.addStyledText(segments(node, { fontSize: 11, fontName: KO_FONT }));
    }
  }

  const bytes = hwpx.write(b.build(), { compress: true });
  downloadBytes(bytes, `${sanitizeName(opts.title)}.hwpx`);
}
