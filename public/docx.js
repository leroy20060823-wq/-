/**
 * docx.js — export a real, editable .docx (Microsoft Word) from a rendered
 * document, fully client-side (no server runtime, no Python). The `docx` library
 * is lazy-loaded only on export so it doesn't weigh down page load.
 *
 * Input is a DOM element holding the document's rendered HTML (from the same
 * Markdown the on-screen preview uses), so sample content works now and, once the
 * API key is set, AI content flows through this exact export unchanged.
 *
 * Word reflows text across pages automatically, so there is no overflow/clipping;
 * the on-screen preview is what runs through the doc QA loop.
 */

const KO_FONT = "맑은 고딕"; // Malgun Gothic — present where Word/HWP are used; HWP opens it too
const MONO_FONT = "Consolas";

// Page sizes in twips (1 inch = 1440 twips).
export const PAPER = {
  a4: { width: 11906, height: 16838 },
  letter: { width: 12240, height: 15840 },
  b5: { width: 9978, height: 14173 },
};

let loading = null;
function ensureDocx() {
  if (window.docx) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "/vendor/docx.umd.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("docx 로드 실패"));
    document.head.appendChild(s);
  });
  return loading;
}

function inlineRuns(node, d, base) {
  const runs = [];
  const walk = (n, fmt) => {
    for (const c of n.childNodes) {
      if (c.nodeType === 3) {
        const text = c.textContent;
        if (text)
          runs.push(
            new d.TextRun({ text, bold: fmt.bold, italics: fmt.italics, font: fmt.code ? MONO_FONT : KO_FONT, size: fmt.size, color: fmt.color }),
          );
      } else if (c.nodeType === 1) {
        const t = c.tagName;
        if (t === "BR") runs.push(new d.TextRun({ break: 1 }));
        else
          walk(c, {
            ...fmt,
            bold: fmt.bold || /^(STRONG|B)$/.test(t),
            italics: fmt.italics || /^(EM|I)$/.test(t),
            code: fmt.code || t === "CODE",
          });
      }
    }
  };
  walk(node, { bold: !!base.bold, italics: !!base.italics, code: false, size: base.size || 22, color: base.color });
  if (runs.length === 0)
    runs.push(new d.TextRun({ text: node.textContent || "", font: KO_FONT, size: base.size || 22, bold: !!base.bold, color: base.color }));
  return runs;
}

function tableBorders(d) {
  const b = { style: d.BorderStyle.SINGLE, size: 4, color: "D8D2C4" };
  return { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b };
}

function buildTable(tableNode, d) {
  const rows = [];
  tableNode.querySelectorAll("tr").forEach((tr) => {
    const cells = [];
    tr.querySelectorAll("th,td").forEach((cell) => {
      const isH = cell.tagName === "TH";
      cells.push(
        new d.TableCell({
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          shading: isH ? { type: "clear", fill: "192744" } : undefined,
          children: [new d.Paragraph({ children: inlineRuns(cell, d, { size: 20, bold: isH, color: isH ? "FFFFFF" : undefined }) })],
        }),
      );
    });
    if (cells.length) rows.push(new d.TableRow({ children: cells, tableHeader: tr.closest("thead") !== null }));
  });
  return new d.Table({ width: { size: 100, type: d.WidthType.PERCENTAGE }, rows, borders: tableBorders(d) });
}

function buildChildren(sourceEl, d) {
  const out = [];
  for (const node of sourceEl.children) {
    const tag = node.tagName;
    if (/^H[1-6]$/.test(tag)) {
      const lvl = Number(tag[1]);
      const size = lvl <= 1 ? 34 : lvl === 2 ? 28 : 24;
      out.push(new d.Paragraph({ spacing: { before: 240, after: 110 }, children: inlineRuns(node, d, { bold: true, size, color: "192744" }) }));
    } else if (tag === "P") {
      out.push(new d.Paragraph({ spacing: { after: 140, line: 312 }, children: inlineRuns(node, d, { size: 22 }) }));
    } else if (tag === "UL" || tag === "OL") {
      let i = 0;
      for (const li of node.children) {
        if (li.tagName !== "LI") continue;
        i += 1;
        const runs = inlineRuns(li, d, { size: 22 });
        if (tag === "OL") {
          runs.unshift(new d.TextRun({ text: `${i}. `, font: KO_FONT, size: 22 }));
          out.push(new d.Paragraph({ spacing: { after: 70, line: 300 }, indent: { left: 360 }, children: runs }));
        } else {
          out.push(new d.Paragraph({ bullet: { level: 0 }, spacing: { after: 70, line: 300 }, children: runs }));
        }
      }
    } else if (tag === "TABLE") {
      out.push(buildTable(node, d));
      out.push(new d.Paragraph({ spacing: { after: 120 }, children: [] }));
    } else if (tag === "BLOCKQUOTE") {
      out.push(new d.Paragraph({ indent: { left: 480 }, spacing: { after: 140 }, children: inlineRuns(node, d, { italics: true, size: 22 }) }));
    } else if (tag === "PRE") {
      out.push(new d.Paragraph({ spacing: { after: 140 }, children: [new d.TextRun({ text: node.textContent || "", font: MONO_FONT, size: 20 })] }));
    } else if (tag === "HR") {
      out.push(new d.Paragraph({ border: { bottom: { style: d.BorderStyle.SINGLE, size: 6, color: "CCCCCC" } }, spacing: { after: 120 } }));
    } else {
      const t = (node.textContent || "").trim();
      if (t) out.push(new d.Paragraph({ spacing: { after: 120 }, children: inlineRuns(node, d, { size: 22 }) }));
    }
  }
  if (out.length === 0) out.push(new d.Paragraph({ children: [new d.TextRun({ text: "", font: KO_FONT, size: 22 })] }));
  return out;
}

function downloadBlob(blob, filename) {
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
 * Build + download an editable .docx from a rendered document element.
 * opts: { paper: "a4"|"letter"|"b5", title }
 */
export async function exportDocx(sourceEl, opts = {}) {
  await ensureDocx();
  const d = window.docx;
  const size = PAPER[opts.paper] || PAPER.a4;
  const doc = new d.Document({
    creator: "올인원 AI",
    title: opts.title || "문서",
    styles: { default: { document: { run: { font: KO_FONT, size: 22 } } } },
    sections: [
      {
        properties: { page: { size: { width: size.width, height: size.height }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
        children: buildChildren(sourceEl, d),
      },
    ],
  });
  const blob = await d.Packer.toBlob(doc);
  downloadBlob(blob, `${sanitizeName(opts.title)}.docx`);
}
