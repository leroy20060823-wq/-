/**
 * Best-effort parser: generated exam Markdown -> structured ExamModel (the JSON
 * the WeasyPrint renderer consumes). The generated text is free-form, so this is
 * deliberately tolerant: it extracts what it reliably can (title, meta,
 * difficulty, 배점표, items bucketed into parts, 정답표, 정밀 해설지) and always
 * returns a valid model — the renderer handles any empty sections gracefully.
 *
 * Pure (no I/O) so it can be unit-tested directly.
 */

export interface ExamMeta {
  totalQuestions: number | null;
  timeMinutes: number | null;
  totalPoints: number | null;
  scope: string;
}
export interface ScoreTable {
  headers: string[];
  rows: string[][];
  summary: string[] | null;
}
export interface PartSummaryRow {
  code: string;
  name: string;
  meta: string;
}
export type ExamBlock =
  | { type: "passage"; title: string; tag: string; paragraphs: string[] }
  | {
      type: "item";
      number: number;
      label: string;
      points: number | null;
      killer: boolean;
      prompt: string;
      example: string | null;
      choices: string[];
      /** 서술형 (open response): a '✏️ ____' blank instead of options. */
      blank: boolean;
    };
export interface ExamPart {
  code: string;
  name: string;
  meta: string;
  blocks: ExamBlock[];
}
export interface AnswerKeyGroup {
  part: string;
  answers: { n: number; a: string; killer: boolean }[];
}
export interface ExplanationCard {
  number: number;
  answer: string;
  explanation: string;
  key: string;
  wrong: string;
}
export interface ExplanationGroup {
  part: string;
  cards: ExplanationCard[];
}
export interface ExamModel {
  brand: string;
  motto: string;
  subtitle: string;
  title: string;
  titleLatin: string;
  meta: ExamMeta;
  difficulty: string;
  notice: string;
  instructions: string[];
  fillIn: string[];
  scoreTable: ScoreTable | null;
  partSummary: PartSummaryRow[];
  parts: ExamPart[];
  answerKey: AnswerKeyGroup[];
  explanations: ExplanationGroup[];
}
export interface ExamMetaInput {
  title?: string;
  subject?: string;
  scope?: string;
  timeMinutes?: number;
  difficulty?: string;
  brand?: string;
  motto?: string;
  subtitle?: string;
  notice?: string;
}

const FILL_IN_DEFAULT = ["반", "이름", "전공", "학번"];

function stripEmphasis(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .trim();
}

function tableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => stripEmphasis(c.trim()));
}
function isSeparatorRow(line: string): boolean {
  return /^\s*\|?[\s:-]*-{2,}[\s:|-]*\|?\s*$/.test(line) && line.includes("-");
}

function parseScoreTable(lines: string[]): ScoreTable | null {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (!line.includes("|") || !line.includes("파트")) continue;
    const headers = tableCells(line);
    let j = i + 1;
    if (isSeparatorRow(lines[j] ?? "")) j++;
    const rows: string[][] = [];
    let summary: string[] | null = null;
    for (; j < lines.length; j++) {
      const l = lines[j] ?? "";
      if (!l.includes("|")) break;
      if (isSeparatorRow(l)) continue;
      const cells = tableCells(l);
      if (cells.every((c) => c === "")) continue;
      const first = cells[0] ?? "";
      if (/^(합계|총계|계|총점|소계)/.test(first)) summary = cells;
      else rows.push(cells);
    }
    if (rows.length) return { headers, rows, summary };
  }
  return null;
}

// Index range [start, end) of the 배점표 table block, so item parsing can begin
// after it (and not mistake the 응시 안내 numbered list for exam items).
function scoreTableRange(lines: string[]): { start: number; end: number } | null {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (!line.includes("|") || !line.includes("파트")) continue;
    let j = i + 1;
    while (j < lines.length && (lines[j] ?? "").includes("|")) j++;
    return { start: i, end: j };
  }
  return null;
}

function headerIndex(headers: string[], ...needles: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i] ?? "";
    if (needles.some((n) => h.includes(n))) return i;
  }
  return -1;
}

function partsFromScoreTable(st: ScoreTable | null): {
  parts: ExamPart[];
  summary: PartSummaryRow[];
  ranges: { code: string; lo: number; hi: number }[];
} {
  const parts: ExamPart[] = [];
  const summary: PartSummaryRow[] = [];
  const ranges: { code: string; lo: number; hi: number }[] = [];
  if (!st) return { parts, summary, ranges };
  const iType = headerIndex(st.headers, "유형");
  const iRange = headerIndex(st.headers, "범위");
  const iTotal = headerIndex(st.headers, "총점", "파트 총점");
  for (const row of st.rows) {
    const code = (row[0] ?? "").trim();
    const name = (row[1] ?? "").trim();
    if (!code && !name) continue;
    const type = iType >= 0 ? (row[iType] ?? "") : "";
    const total = iTotal >= 0 ? (row[iTotal] ?? "") : "";
    const meta = [type, total].filter(Boolean).join(" · ");
    parts.push({ code, name, meta, blocks: [] });
    summary.push({ code, name, meta });
    const rangeStr = iRange >= 0 ? (row[iRange] ?? "") : "";
    const m = rangeStr.match(/(\d+)\s*[~\-–]\s*(\d+)/);
    if (m) ranges.push({ code, lo: Number(m[1]), hi: Number(m[2]) });
    else {
      const single = rangeStr.match(/(\d+)/);
      if (single) ranges.push({ code, lo: Number(single[1]), hi: Number(single[1]) });
    }
  }
  return { parts, summary, ranges };
}

// Parse one item block (an array of its lines) into an ExamBlock item.
function parseItem(headerLine: string, bodyLines: string[]): Extract<ExamBlock, { type: "item" }> | null {
  const header = stripEmphasis(headerLine);
  const m = header.match(/^(\d+)\s*[.)]\s*(.*)$/);
  if (!m) return null;
  const number = Number(m[1]);
  let rest = (m[2] ?? "").trim();
  let points: number | null = null;
  const pm = rest.match(/\[\s*(\d+)\s*점\s*\]/);
  if (pm) {
    points = Number(pm[1]);
    rest = rest.replace(pm[0], "").trim();
  }
  const killer = /★|killer/i.test(header);
  const label = rest.replace(/★\s*killer/i, "").replace(/★/g, "").replace(/[—\-·]\s*$/, "").trim();

  const choices: string[] = [];
  let example: string | null = null;
  let blank = false;
  const promptParts: string[] = [];

  // `closed` = the item's content is complete (options or the ✏️ blank seen).
  // Once closed, a blank line means anything that follows is trailing prose
  // (e.g. the paper's closing line) — stop so it isn't glued onto the stem.
  let closed = false;
  let blankAfterClose = false;
  for (const raw of bodyLines) {
    const line = raw.trim();
    if (!line) {
      if (closed) blankAfterClose = true;
      continue;
    }
    if (closed && blankAfterClose) break;
    // 서술형 answer blank: '✏️ ____' (or a bare underscore run) → flag it, don't show as prompt.
    if (/✏/.test(line) || /^_{2,}\s*$/.test(line)) {
      blank = true;
      closed = true;
      continue;
    }
    // Choices: "A) ...  B) …  E) …" — five options, one per line or several on one line.
    const choiceMatches = [...line.matchAll(/([A-E])\s*[)\].]\s*([^]*?)(?=(?:\s+[A-E]\s*[)\].])|$)/g)];
    if (choiceMatches.length >= 2 || /^[A-E]\s*[)\].]/.test(line)) {
      for (const cm of choiceMatches) {
        const text = stripEmphasis((cm[2] ?? "").trim());
        if (text) choices.push(text);
      }
      closed = true;
      continue;
    }
    // Example / quote box: a quoted sentence or a blockquote line.
    const quoted = line.match(/^[>"“]\s*(.+?)["”]?$/);
    if ((line.startsWith(">") || /^["“].+["”]$/.test(line)) && quoted) {
      example = stripEmphasis(quoted[1] ?? "");
      continue;
    }
    promptParts.push(stripEmphasis(line));
  }

  let prompt = promptParts.join(" ").trim();
  // If no standalone quote was found, lift a quoted sentence out of the prompt.
  if (!example) {
    const q = prompt.match(/[""“”"](.+?)[""“”"]/);
    if (q && q[1]) {
      example = q[1].trim();
      prompt = prompt.replace(q[0], "").replace(/\s{2,}/g, " ").trim();
    }
  }

  return { type: "item", number, label: label || "문항", points, killer, prompt, example, choices, blank };
}

const ITEM_START = /^\s*\*{0,2}(\d+)\s*[.)]\s+/;
function isPartDivider(line: string): { code: string; name: string } | null {
  const m = line.match(/^#{0,3}\s*(P\s*\d+)\b\s*[·\-—:.\s]*(.*)$/i);
  if (m) return { code: (m[1] ?? "").replace(/\s+/g, "").toUpperCase(), name: stripEmphasis(m[2] ?? "") };
  return null;
}
function isPassageHeading(line: string): { title: string; tag: string } | null {
  const m = line.match(/^#{3,4}\s+(.*)$/);
  if (!m) return null;
  const text = stripEmphasis(m[1] ?? "");
  const parts = text.split(/\s*[—–]\s*/);
  if (parts.length >= 2) return { title: (parts[0] ?? "").trim(), tag: parts.slice(1).join(" — ").trim() };
  return { title: text, tag: "" };
}

function parseBodyIntoParts(
  bodyLines: string[],
  base: { parts: ExamPart[]; ranges: { code: string; lo: number; hi: number }[] },
): ExamPart[] {
  const parts = base.parts.map((p) => ({ ...p, blocks: [] as ExamBlock[] }));
  const findByCode = (code: string) => parts.find((p) => p.code.toUpperCase() === code.toUpperCase());
  const partForNumber = (n: number) => {
    const r = base.ranges.find((x) => n >= x.lo && n <= x.hi);
    return r ? findByCode(r.code) : undefined;
  };
  const ensureDefault = () => {
    let d = parts.find((p) => p.code === "" && p.name === "문제");
    if (!d) {
      d = { code: "", name: "문제", meta: "", blocks: [] };
      parts.push(d);
    }
    return d;
  };

  let current: ExamPart | undefined = parts[0];
  const stray: string[] = [];
  let added = false;

  // Find the part for the next item appearing at/after index `from` (lookahead so
  // a reading passage attaches to the part of the items that follow it).
  const nextItemPart = (from: number): ExamPart | undefined => {
    for (let k = from; k < bodyLines.length; k++) {
      const lk = (bodyLines[k] ?? "").trim();
      if (ITEM_START.test(lk)) {
        const mm = stripEmphasis(lk).match(/^(\d+)/);
        return mm ? partForNumber(Number(mm[1])) : undefined;
      }
      if (isPartDivider(lk)) return undefined;
    }
    return undefined;
  };

  // Group lines into blocks separated by item starts / passage headings / dividers.
  let i = 0;
  while (i < bodyLines.length) {
    const line = bodyLines[i] ?? "";
    const trimmed = line.trim();
    if (!trimmed) {
      i++;
      continue;
    }

    const divider = isPartDivider(trimmed);
    if (divider && (findByCode(divider.code) || base.ranges.length === 0)) {
      let p = findByCode(divider.code);
      if (!p) {
        p = { code: divider.code, name: divider.name || divider.code, meta: "", blocks: [] };
        parts.push(p);
      }
      current = p;
      i++;
      continue;
    }

    if (ITEM_START.test(trimmed)) {
      const headerLine = trimmed;
      const bodyAcc: string[] = [];
      i++;
      while (i < bodyLines.length) {
        const l = (bodyLines[i] ?? "").trim();
        if (ITEM_START.test(l) || isPartDivider(l) || isPassageHeading(l)) break;
        bodyAcc.push(l);
        i++;
      }
      const item = parseItem(headerLine, bodyAcc);
      if (item) {
        const target = partForNumber(item.number) || current || ensureDefault();
        target.blocks.push(item);
        current = target;
        added = true;
      }
      continue;
    }

    const passage = isPassageHeading(trimmed);
    if (passage) {
      const paragraphs: string[] = [];
      i++;
      while (i < bodyLines.length) {
        const l = (bodyLines[i] ?? "").trim();
        if (ITEM_START.test(l) || isPartDivider(l) || isPassageHeading(l)) break;
        if (l) paragraphs.push(stripEmphasis(l));
        i++;
      }
      const target = nextItemPart(i) || current || ensureDefault();
      target.blocks.push({ type: "passage", title: passage.title, tag: passage.tag, paragraphs });
      current = target;
      added = true;
      continue;
    }

    // Stray prose (not a heading/table) — kept for the no-structure fallback.
    if (!/^#/.test(trimmed) && !trimmed.includes("|")) stray.push(stripEmphasis(trimmed));
    i++;
  }

  // No items/passages parsed at all → keep the prose so nothing is lost.
  if (!added && stray.length) {
    const def = ensureDefault();
    def.blocks.push({ type: "passage", title: "", tag: "", paragraphs: stray });
  }

  // Drop empty parts unless they're the only content holder.
  const nonEmpty = parts.filter((p) => p.blocks.length > 0);
  return nonEmpty.length ? nonEmpty : parts.slice(0, 1);
}

function parseAnswerKey(lines: string[]): AnswerKeyGroup[] {
  const groups: AnswerKeyGroup[] = [];
  let current: AnswerKeyGroup | null = null;
  for (const raw of lines) {
    let line = stripEmphasis(raw.trim());
    if (!line) continue;
    // A leading part label (P1, P2 …) may either sit on its own line OR start the
    // line with the answers following on the SAME line, e.g. 'P1.  1. A  2. C  3. B'.
    // Split it off so the inline answers aren't swallowed into the part name.
    const head = line.match(/^(P\s*\d+)\b\s*[.·\-—:]*\s*/i);
    if (head) {
      const code = (head[1] ?? "").replace(/\s+/g, "").toUpperCase();
      current = { part: code, answers: [] };
      groups.push(current);
      line = line.slice((head[0] ?? "").length).trim();
      if (!line) continue;
    }
    // killer ★ may sit before the number or after the answer letter.
    const pairs = [...line.matchAll(/(★?)\s*(\d+)\s*[.)]?\s*([A-Ea-e①②③④⑤])\s*(★?)/g)];
    if (pairs.length) {
      if (!current) {
        current = { part: "", answers: [] };
        groups.push(current);
      }
      for (const p of pairs) {
        current.answers.push({
          n: Number(p[2]),
          a: (p[3] ?? "").toUpperCase(),
          killer: (p[1] ?? "") === "★" || (p[4] ?? "") === "★",
        });
      }
    }
  }
  return groups.filter((g) => g.answers.length);
}

function parseExplanations(lines: string[]): ExplanationGroup[] {
  const groups: ExplanationGroup[] = [];
  let current: ExplanationGroup | null = null;
  const ensure = () => {
    if (!current) {
      current = { part: "", cards: [] };
      groups.push(current);
    }
    return current;
  };

  let i = 0;
  while (i < lines.length) {
    const line = stripEmphasis((lines[i] ?? "").trim());
    if (!line) {
      i++;
      continue;
    }
    const divider = isPartDivider(line);
    if (divider) {
      current = { part: [divider.code, divider.name].filter(Boolean).join(" "), cards: [] };
      groups.push(current);
      i++;
      continue;
    }
    const cm = line.match(/^(\d+)\s*[.)]\s*정답\s*[:：]?\s*([A-Ea-e①②③④⑤]|.+?)(?:\s|$)(.*)$/);
    if (cm) {
      const card: ExplanationCard = {
        number: Number(cm[1]),
        answer: (cm[2] ?? "").trim(),
        explanation: stripEmphasis((cm[3] ?? "").replace(/^[—\-·]\s*/, "").trim()),
        key: "",
        wrong: "",
      };
      i++;
      while (i < lines.length) {
        const l = stripEmphasis((lines[i] ?? "").trim());
        if (!l) {
          i++;
          continue;
        }
        if (/^(\d+)\s*[.)]\s*정답/.test(l) || isPartDivider(l)) break;
        const keyM = l.match(/^핵심\s*[:：]?\s*(.*)$/);
        const wrongM = l.match(/^오답\s*체크\s*[:：]?\s*(.*)$/);
        if (keyM) card.key = (keyM[1] ?? "").trim();
        else if (wrongM) card.wrong = (wrongM[1] ?? "").trim();
        else card.explanation = (card.explanation ? card.explanation + " " : "") + l;
        i++;
      }
      ensure().cards.push(card);
      continue;
    }
    i++;
  }
  return groups.filter((g) => g.cards.length);
}

/** Heading matchers for the answer-key / explanation section boundaries. */
function sectionIndex(lines: string[], re: RegExp): number {
  for (let i = 0; i < lines.length; i++) {
    if (/^#{1,3}\s+/.test(lines[i] ?? "") && re.test(lines[i] ?? "")) return i;
  }
  return -1;
}

export function buildExamModel(markdown: string, input: ExamMetaInput = {}): ExamModel {
  const safe = typeof markdown === "string" ? markdown : "";
  try {
    const lines = safe.replace(/\r\n/g, "\n").split("\n");

    // Section boundaries.
    const akIdx = sectionIndex(lines, /정답표|answer\s*key/i);
    const exIdx = sectionIndex(lines, /해설|explanation/i);
    const bodyEnd = Math.min(...[akIdx, exIdx].filter((x) => x >= 0).concat([lines.length]));

    const headerAndBody = lines.slice(0, bodyEnd);
    const akLines = akIdx >= 0 ? lines.slice(akIdx + 1, exIdx >= 0 && exIdx > akIdx ? exIdx : lines.length) : [];
    const exLines = exIdx >= 0 ? lines.slice(exIdx + 1) : [];

    // Title: first '# ' heading.
    let title = input.title?.trim() || "";
    if (!title) {
      const h = headerAndBody.find((l) => /^#\s+/.test(l));
      if (h) title = stripEmphasis(h.replace(/^#\s+/, ""));
    }
    if (!title) title = "모의고사";

    // Meta line.
    const text = headerAndBody.join("\n");
    const meta: ExamMeta = {
      totalQuestions: matchNum(text, /총?\s*(\d+)\s*문항/),
      timeMinutes: input.timeMinutes ?? matchNum(text, /(\d+)\s*분/),
      totalPoints: matchNum(text, /(\d+)\s*점\s*만점/) ?? 100,
      scope: input.scope?.trim() || (text.match(/출제\s*범위\s*[:：]\s*([^\n|]+)/)?.[1]?.trim() ?? ""),
    };
    // Trim a trailing "· 난이도 …" that sometimes rides on the scope line.
    meta.scope = meta.scope.replace(/[·|]\s*난이도.*$/, "").trim();

    const difficulty =
      input.difficulty?.trim() ||
      text.match(/난이도\s*[:：]?\s*([^\n|]+?)(?:\s*$|\n)/)?.[1]?.trim() ||
      "";

    // 배점표 + parts. Item parsing starts AFTER the 배점표 (so the 응시 안내
    // numbered list isn't mistaken for exam items); if there's no table, start
    // after the meta line.
    const scoreTable = parseScoreTable(headerAndBody);
    const { parts: baseParts, summary, ranges } = partsFromScoreTable(scoreTable);
    const range = scoreTableRange(headerAndBody);
    const metaIdx = headerAndBody.findIndex((l) => /문항/.test(l) && /(분|만점)/.test(l));
    const bodyStartIdx = range ? range.end : metaIdx >= 0 ? metaIdx + 1 : 0;
    const parts = parseBodyIntoParts(headerAndBody.slice(bodyStartIdx), { parts: baseParts, ranges });

    // 수험자 유의사항 (numbered list under a 유의사항/안내 heading), best-effort.
    const instructions = extractInstructions(headerAndBody);

    return {
      brand: input.brand?.trim() || "",
      motto: input.motto?.trim() || "",
      subtitle: input.subtitle?.trim() || "",
      title,
      titleLatin: "",
      meta,
      difficulty: difficulty.replace(/^[·\-]\s*/, ""),
      notice: input.notice?.trim() || "",
      instructions,
      fillIn: FILL_IN_DEFAULT,
      scoreTable,
      partSummary: summary,
      parts,
      answerKey: parseAnswerKey(akLines),
      explanations: parseExplanations(exLines),
    };
  } catch {
    // Never throw — return a minimal valid model so the renderer still produces a page.
    return {
      brand: input.brand?.trim() || "",
      motto: input.motto?.trim() || "",
      subtitle: input.subtitle?.trim() || "",
      title: input.title?.trim() || "모의고사",
      titleLatin: "",
      meta: { totalQuestions: null, timeMinutes: input.timeMinutes ?? null, totalPoints: 100, scope: input.scope ?? "" },
      difficulty: input.difficulty ?? "",
      notice: input.notice ?? "",
      instructions: [],
      fillIn: FILL_IN_DEFAULT,
      scoreTable: null,
      partSummary: [],
      parts: [{ code: "", name: "문제", meta: "", blocks: [{ type: "passage", title: "", tag: "", paragraphs: safe.split("\n").filter(Boolean) }] }],
      answerKey: [],
      explanations: [],
    };
  }
}

function matchNum(text: string, re: RegExp): number | null {
  const m = text.match(re);
  return m && m[1] ? Number(m[1]) : null;
}

function extractInstructions(lines: string[]): string[] {
  const out: string[] = [];
  let inSection = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (/유의\s*사항|응시\s*안내|안내\s*사항/.test(line) && /^#{1,4}|^\*\*|유의|안내/.test(line)) {
      inSection = true;
      continue;
    }
    if (!inSection) continue;
    if (/^#{1,4}\s+/.test(line) || line.includes("|")) break; // next heading / table ends it
    const m = line.match(/^\s*(?:\d+[.)]|[-*])\s+(.*)$/);
    if (m) out.push(stripEmphasis(m[1] ?? ""));
    else if (out.length && line) out[out.length - 1] += " " + stripEmphasis(line);
  }
  return out.slice(0, 8);
}
