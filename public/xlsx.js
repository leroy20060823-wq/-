/**
 * xlsx.js — native .xlsx (OOXML spreadsheet) builder, no heavy library.
 * Zips minimal parts with the vendored fflate. Formulas are written live
 * (<f>…</f>) with fullCalcOnLoad, so Excel/Sheets recalculate on open.
 *
 * Input: the 엑셀 module's answer Markdown. Preferred source is the trailing
 * machine-readable block the system prompt requires:
 *   ```xlsx
 *   {"sheets":[{"name":"예시 데이터","rows":[[..],[..]],"formulas":[{"cell":"E2","f":"SUMIFS(...)","label":"서울 합계"}]}]}
 *   ```
 * Fallback (no block): a guide workbook — 안내 sheet (text lines) + 수식 sheet
 * (every `=...` code span with its surrounding step title).
 */

let fflatePromise = null;
function loadFflate() {
  if (!fflatePromise) fflatePromise = import("./vendor/fflate.esm.js");
  return fflatePromise;
}

/* ---------- cell helpers ---------- */
function colLetter(n) {
  // 1 -> A
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
function cellRef(row, col) {
  return colLetter(col) + row;
}
function parseRef(ref) {
  const m = /^([A-Z]+)(\d+)$/i.exec(String(ref || "").trim());
  if (!m) return null;
  let col = 0;
  for (const ch of m[1].toUpperCase()) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { row: Number(m[2]), col };
}
function xesc(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/* ---------- sheet XML ---------- */
function sheetXml(sheet) {
  // cells map "r,c" -> {v:number}|{s:string}|{f:string}
  const cells = new Map();
  const put = (r, c, val) => cells.set(`${r},${c}`, val);
  (sheet.rows || []).forEach((row, ri) => {
    (row || []).forEach((v, ci) => {
      if (v === null || v === undefined || v === "") return;
      if (typeof v === "number" && Number.isFinite(v)) put(ri + 1, ci + 1, { v });
      else put(ri + 1, ci + 1, { s: String(v) });
    });
  });
  for (const fm of sheet.formulas || []) {
    const ref = parseRef(fm.cell);
    if (!ref || !fm.f) continue;
    const f = String(fm.f).replace(/^=/, "");
    put(ref.row, ref.col, { f });
    if (fm.label) {
      const lc = ref.col > 1 ? ref.col - 1 : ref.col + 1;
      if (!cells.has(`${ref.row},${lc}`)) put(ref.row, lc, { s: String(fm.label) });
    }
  }
  let maxR = 1, maxC = 1;
  for (const k of cells.keys()) {
    const [r, c] = k.split(",").map(Number);
    if (r > maxR) maxR = r;
    if (c > maxC) maxC = c;
  }
  const rowsXml = [];
  for (let r = 1; r <= maxR; r++) {
    const cs = [];
    for (let c = 1; c <= maxC; c++) {
      const cell = cells.get(`${r},${c}`);
      if (!cell) continue;
      const ref = cellRef(r, c);
      if ("f" in cell) cs.push(`<c r="${ref}"><f>${xesc(cell.f)}</f></c>`);
      else if ("v" in cell) cs.push(`<c r="${ref}"><v>${cell.v}</v></c>`);
      else cs.push(`<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xesc(cell.s)}</t></is></c>`);
    }
    if (cs.length) rowsXml.push(`<row r="${r}">${cs.join("")}</row>`);
  }
  // generous default widths for the first columns
  const cols = `<cols><col min="1" max="1" width="22" customWidth="1"/><col min="2" max="8" width="16" customWidth="1"/></cols>`;
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    cols + `<sheetData>${rowsXml.join("")}</sheetData></worksheet>`
  );
}

/* ---------- workbook parts ---------- */
function buildParts(sheets) {
  const names = sheets.map((s, i) => (s.name || `Sheet${i + 1}`).slice(0, 28).replace(/[\\/?*[\]:]/g, " "));
  const parts = {};
  parts["[Content_Types].xml"] =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("") +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    `</Types>`;
  parts["_rels/.rels"] =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`;
  parts["xl/workbook.xml"] =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets>` +
    names.map((n, i) => `<sheet name="${xesc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") +
    `</sheets><calcPr fullCalcOnLoad="1"/></workbook>`;
  parts["xl/_rels/workbook.xml.rels"] =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("") +
    `<Relationship Id="rIdS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    `</Relationships>`;
  parts["xl/styles.xml"] =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<fonts count="1"><font><sz val="11"/><name val="Malgun Gothic"/></font></fonts>` +
    `<fills count="1"><fill><patternFill patternType="none"/></fill></fills>` +
    `<borders count="1"><border/></borders>` +
    `<cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="1"><xf/></cellXfs>` +
    `</styleSheet>`;
  sheets.forEach((s, i) => {
    parts[`xl/worksheets/sheet${i + 1}.xml`] = sheetXml(s);
  });
  return parts;
}

/* ---------- spec extraction from the answer markdown ---------- */
export function specFromMarkdown(markdown) {
  const m = /```xlsx\s*\n([\s\S]*?)```/.exec(markdown || "");
  if (!m) return null;
  try {
    const spec = JSON.parse(m[1]);
    if (spec && Array.isArray(spec.sheets) && spec.sheets.length) return spec;
  } catch {
    /* fall through to guide workbook */
  }
  return null;
}

// Fallback: guide workbook (안내 + 수식 sheets) from the plain answer.
export function guideSpecFromMarkdown(markdown, title) {
  const lines = (markdown || "").split("\n");
  const guide = [[title || "엑셀 안내"], [""]];
  for (const ln of lines) {
    const s = ln.replace(/^#+\s*/, "").replace(/\*\*/g, "").trim();
    if (s && !s.startsWith("```")) guide.push([s]);
  }
  const formulas = [];
  const rx = /`(=[^`]+)`/g;
  let mm;
  let ri = 2;
  const fsheet = [["수식", "복사해서 쓰세요"]];
  while ((mm = rx.exec(markdown || ""))) {
    fsheet.push([`수식 ${ri - 1}`, mm[1]]);
    ri++;
  }
  const sheets = [{ name: "안내", rows: guide }];
  if (fsheet.length > 1) sheets.push({ name: "수식", rows: fsheet });
  return { sheets };
}

/* ---------- build + download ---------- */
export async function buildXlsx(spec) {
  const { zipSync, strToU8 } = await loadFflate();
  const parts = buildParts(spec.sheets);
  const files = {};
  for (const [path, xml] of Object.entries(parts)) files[path] = strToU8(xml);
  const zipped = zipSync(files, { level: 6 });
  return new Blob([zipped], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export async function exportXlsx(markdown, title, filename) {
  const spec = specFromMarkdown(markdown) || guideSpecFromMarkdown(markdown, title);
  const blob = await buildXlsx(spec);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename || title || "엑셀"}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
