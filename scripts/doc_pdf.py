#!/usr/bin/env python3
"""
doc_pdf.py — premium document PDF renderer (WeasyPrint) for the non-exam modules.

Input (stdin or --in): JSON
  { "type": "vocab" | "notes" | "quiz" | "worksheet" | "doc",
    "title": str, "subtitle": str, "meta": str, "brand": str,
    "markdown": str, "theme": str (optional key or auto), "footer": str }
Output: --out <pdf>. Stdout: one-line JSON QA log.

Design goals (per product rules):
- 인쇄 품질: embedded fonts, must read cleanly in BOTH color and grayscale.
- 중립: no school/brand unless provided.
- 단어장 follows the professional word-book layout (sections bar, zebra entries,
  품사 chips, IPA); 학습노트 gets a topic-matched theme; 퀴즈 is lively; 학습지
  follows commercial workbook conventions (개념 박스, 문제 카드, 해설집).
"""

import argparse
import json
import os
import re
import sys
import traceback

try:
    import weasyprint
    from weasyprint import HTML, CSS
    from weasyprint.text.fonts import FontConfiguration
    _WEASY_IMPORT_ERROR = None
except Exception as e:  # pragma: no cover
    weasyprint = None
    _WEASY_IMPORT_ERROR = str(e)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)
FONTS_DIR = os.path.join(REPO_ROOT, "fonts")


def font_url(name):
    return "file://" + os.path.join(FONTS_DIR, name).replace("\\", "/")


def esc(s):
    return (str(s or "")
            .replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace('"', "&quot;"))


# --------------------------------------------------------------------------- #
# Themes — accent palettes picked by topic keywords (or explicit key).
# Every palette is chosen to hold up in grayscale (dark primary ≥ WCAG-ish).
# --------------------------------------------------------------------------- #
THEMES = {
    "navy":    {"pri": "#1F2A44", "acc": "#8B2332", "soft": "#F4F6FA", "chip": "#FBF3F4", "band2": "#3A4A6B"},
    "teal":    {"pri": "#0F4C5C", "acc": "#C05621", "soft": "#EFF6F7", "chip": "#FDF3EC", "band2": "#1D6B7E"},
    "green":   {"pri": "#22543D", "acc": "#B7791F", "soft": "#F0F6F1", "chip": "#FBF5E9", "band2": "#38795B"},
    "plum":    {"pri": "#44337A", "acc": "#B83280", "soft": "#F4F2FA", "chip": "#FBF0F6", "band2": "#5D4BA0"},
    "brown":   {"pri": "#5F370E", "acc": "#276749", "soft": "#F8F4EE", "chip": "#EFF6F0", "band2": "#8A5A2B"},
    "indigo":  {"pri": "#2A3B8F", "acc": "#C05621", "soft": "#F1F3FB", "chip": "#FDF3EC", "band2": "#4557B5"},
    "coral":   {"pri": "#9B2C2C", "acc": "#0F4C5C", "soft": "#FBF2F0", "chip": "#EFF6F7", "band2": "#C05050"},
}
KEYWORD_THEMES = [
    (r"역사|조선|고려|신라|한국사|근현대|세계사", "brown"),
    (r"수학|방정식|함수|기하|확률|통계|math", "indigo"),
    (r"광합성|식물|생물|자연|환경|숲|생태|nature|bio", "green"),
    (r"문학|소설|이야기|동화|시집|story|novel", "plum"),
    (r"날씨|기후|바다|해양|강수|폭풍|water|weather|climate|rain", "teal"),
    (r"과학|물리|화학|지구과학|전기|science", "teal"),
    (r"엑셀|시트|excel|데이터", "indigo"),
    (r"영어|english|단어|vocab", "navy"),
]


def pick_theme(explicit, title, subtitle, body):
    """Explicit key wins; otherwise match title+subtitle first (most reliable
    signal), then the body text. Keywords are ≥2 chars to avoid false hits."""
    if explicit and explicit in THEMES:
        return explicit
    for blob in (f"{title or ''} {subtitle or ''}", body or ""):
        for pat, key in KEYWORD_THEMES:
            if re.search(pat, blob, re.I):
                return key
    return "navy"


# --------------------------------------------------------------------------- #
# Tiny markdown-lite → HTML (headings, lists, tables, bold, code, quotes)
# --------------------------------------------------------------------------- #
def inline(s):
    s = esc(s)
    s = re.sub(r"`([^`]+)`", r'<code>\1</code>', s)
    s = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"\*([^*]+)\*", r"<em>\1</em>", s)
    return s


def md_blocks(md):
    """Yield (kind, payload) blocks: h1/h2/h3, ul, ol, table, quote, p."""
    lines = (md or "").replace("\r\n", "\n").split("\n")
    i, n = 0, len(lines)
    while i < n:
        ln = lines[i].rstrip()
        if not ln.strip():
            i += 1
            continue
        m = re.match(r"^(#{1,3})\s+(.*)$", ln)
        if m:
            yield ("h%d" % len(m.group(1)), m.group(2).strip())
            i += 1
            continue
        if ln.lstrip().startswith("|") and i + 1 < n and re.match(r"^\s*\|[\s:|-]+\|?\s*$", lines[i + 1]):
            rows = []
            while i < n and lines[i].lstrip().startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if not re.match(r"^[\s:-]+$", "".join(cells)):
                    rows.append(cells)
                i += 1
            yield ("table", rows)
            continue
        if re.match(r"^\s*[-*]\s+", ln):
            items = []
            while i < n and re.match(r"^\s*[-*]\s+", lines[i]):
                items.append(re.sub(r"^\s*[-*]\s+", "", lines[i]).strip())
                i += 1
            yield ("ul", items)
            continue
        if re.match(r"^\s*\d+[.)]\s+", ln):
            items = []
            while i < n and re.match(r"^\s*\d+[.)]\s+", lines[i]):
                items.append(re.sub(r"^\s*\d+[.)]\s+", "", lines[i]).strip())
                i += 1
            yield ("ol", items)
            continue
        if ln.lstrip().startswith(">"):
            q = []
            while i < n and lines[i].lstrip().startswith(">"):
                q.append(lines[i].lstrip()[1:].strip())
                i += 1
            yield ("quote", " ".join(q))
            continue
        para = [ln.strip()]
        i += 1
        while i < n and lines[i].strip() and not re.match(r"^(#{1,3}\s|\s*[-*]\s|\s*\d+[.)]\s|\s*\||\s*>)", lines[i]):
            para.append(lines[i].strip())
            i += 1
        yield ("p", " ".join(para))


def md_html(md, skip_h1=True):
    out = []
    for kind, payload in md_blocks(md):
        if kind == "h1":
            if not skip_h1:
                out.append(f"<h1>{inline(payload)}</h1>")
        elif kind in ("h2", "h3"):
            out.append(f"<{kind}>{inline(payload)}</{kind}>")
        elif kind == "ul":
            out.append("<ul>" + "".join(f"<li>{inline(x)}</li>" for x in payload) + "</ul>")
        elif kind == "ol":
            out.append("<ol>" + "".join(f"<li>{inline(x)}</li>" for x in payload) + "</ol>")
        elif kind == "quote":
            out.append(f'<div class="callout">{inline(payload)}</div>')
        elif kind == "table":
            head, *rows = payload
            out.append("<table><thead><tr>" + "".join(f"<th>{inline(c)}</th>" for c in head) + "</tr></thead><tbody>")
            for r in rows:
                out.append("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>")
            out.append("</tbody></table>")
        else:
            out.append(f"<p>{inline(payload)}</p>")
    return "\n".join(out)


def first_h1(md):
    for kind, payload in md_blocks(md):
        if kind == "h1":
            return payload
    return ""


# --------------------------------------------------------------------------- #
# Shared CSS
# --------------------------------------------------------------------------- #
def base_css(t):
    return f"""
@font-face {{ font-family:'DocSans'; src: url('{font_url("NotoSansKR-Regular.ttf")}'); font-weight:400; }}
@font-face {{ font-family:'DocSans'; src: url('{font_url("NotoSansKR-Bold.ttf")}'); font-weight:700; }}
@font-face {{ font-family:'DocSerif'; src: url('{font_url("NotoSerifKR-Regular.ttf")}'); font-weight:400; }}
@font-face {{ font-family:'DocSerif'; src: url('{font_url("NotoSerifKR-Bold.ttf")}'); font-weight:700; }}
@font-face {{ font-family:'DocSym'; src: url('{font_url("DejaVuSans.ttf")}'); }}
:root {{
  --pri: {t["pri"]}; --acc: {t["acc"]}; --soft: {t["soft"]}; --chip: {t["chip"]}; --band2: {t["band2"]};
  --ink: #23272E; --gray: #6B7280; --line: #E5E7EB;
}}
@page {{
  size: A4; margin: 16mm 15mm 18mm 15mm;
  @bottom-center {{ content: string(doc-footer); font-family: DocSans; font-size: 7.5pt; color: var(--gray); }}
  @bottom-right  {{ content: counter(page) ' / ' counter(pages); font-family: DocSans; font-size: 7.5pt; color: var(--gray); }}
}}
* {{ box-sizing: border-box; }}
body {{ font-family: 'DocSans','DocSym',sans-serif; color: var(--ink); font-size: 10pt; line-height: 1.62; margin: 0; }}
.footer-anchor {{ string-set: doc-footer content(); display:none; }}
code {{ font-family:'DocSym','DocSans',monospace; background: var(--soft); border:1px solid var(--line); border-radius:3px; padding:0 .35em; font-size: 9.2pt; }}
table {{ width:100%; border-collapse:collapse; margin: 3mm 0; font-size: 9.3pt; table-layout: fixed; }}
th {{ background: var(--pri); color:#fff; font-weight:700; padding: 2.2mm 2.6mm; border:1px solid var(--pri);
  word-break: keep-all; overflow-wrap: break-word; }}
td {{ border:1px solid #CBD2DA; padding: 2mm 2.6mm; vertical-align: top;
  word-break: keep-all; overflow-wrap: break-word; }}
tbody tr:nth-child(even) td {{ background: var(--soft); }}
.callout {{ background: var(--chip); border-left: 3px solid var(--acc); padding: 2.6mm 4mm; margin: 3mm 0; }}
"""


# --------------------------------------------------------------------------- #
# 단어장 (vocab) — professional word-book layout
# --------------------------------------------------------------------------- #
ENTRY_RE = re.compile(r"^\*\*(\d+)\s*·\s*(.+?)\*\*\s*\[([^\]]+)\]\s*·\s*([^—\-]+?)\s*[—\-]\s*(.+?)\s*$")


def parse_vocab(md):
    sections, cur = [], {"name": "", "entries": []}
    lines = (md or "").split("\n")
    i = 0
    while i < len(lines):
        ln = lines[i].strip()
        m2 = re.match(r"^##\s+(.*)$", ln)
        if m2:
            if cur["entries"]:
                sections.append(cur)
            cur = {"name": m2.group(1).strip(), "entries": []}
            i += 1
            continue
        # allow a leading "N. " (numbered-list wrapper) before the bold entry
        core = re.sub(r"^\d+\.\s+", "", ln)
        em = ENTRY_RE.match(core)
        if em:
            entry = {"n": em.group(1), "word": em.group(2), "ipa": em.group(3),
                     "pos": em.group(4).strip(), "meaning": em.group(5), "ex": "", "tr": ""}
            j = i + 1
            got = []
            while j < len(lines) and len(got) < 2:
                s = lines[j].strip()
                if s and not ENTRY_RE.match(re.sub(r"^\d+\.\s+", "", s)) and not s.startswith("#"):
                    got.append(s)
                elif s == "":
                    pass
                else:
                    break
                j += 1
            if got:
                entry["ex"] = got[0]
            if len(got) > 1:
                entry["tr"] = got[1]
            cur["entries"].append(entry)
            i = j
            continue
        i += 1
    if cur["entries"]:
        sections.append(cur)
    return sections


def vocab_css():
    return """
.vhead { margin-bottom: 4mm; }
.vbrand { font-weight:700; color: var(--acc); letter-spacing: .28em; font-size: 8.5pt; text-transform: uppercase; }
.vtitle-row { display:flex; justify-content: space-between; align-items: flex-end; }
.vtitle { font-weight:700; color: var(--pri); font-size: 21pt; line-height:1.2; margin: 1mm 0 .5mm; }
.vsub { color: var(--gray); font-size: 9.3pt; }
.vmeta { text-align:right; font-size: 8.6pt; color: var(--gray); line-height: 1.5; }
.vmeta .vtotal { color: var(--acc); font-weight: 700; font-size: 9.5pt; }
.legend { background: var(--soft); border-left: 3px solid var(--acc); color: var(--gray);
  font-size: 8.2pt; padding: 1.8mm 3.5mm; margin: 3.5mm 0 5mm; }
.legend b { color: var(--pri); }
.secbar { background: var(--pri); color:#fff; display:flex; justify-content:space-between; align-items:center;
  padding: 2.2mm 4.5mm; margin: 5mm 0 0; font-weight:700; font-size: 11pt; border-radius: 1.2mm 1.2mm 0 0; }
.secbar .cnt { font-weight:400; font-size: 8.5pt; opacity:.9; }
.entry { display:flex; gap: 3.5mm; padding: 3mm 4mm; border-bottom: 1px solid var(--line); break-inside: avoid; }
.entry:nth-child(even) { background: var(--soft); }
.e-num { flex:none; width: 7mm; text-align:right; color: var(--acc); font-weight:700; font-size: 10.5pt; padding-top: .4mm; }
.e-word { font-weight:700; color: var(--pri); font-size: 12.5pt; }
.e-ipa { color: var(--gray); font-size: 9pt; margin-left: 1.6mm; font-family:'DocSym','DocSans'; }
.e-pos { display:inline-block; margin-left: 2mm; border: 1px solid var(--acc); color: var(--acc); background: var(--chip);
  font-size: 7.4pt; font-weight:700; padding: .2mm 1.8mm; border-radius: 1mm; vertical-align: 1px; }
.e-mean { font-weight: 700; font-size: 10.3pt; margin-top: .8mm; }
.e-ex { font-style: italic; color: #3F4650; font-size: 9.3pt; margin-top: .8mm; }
.e-tr { color: var(--gray); font-size: 8.7pt; margin-top: .2mm; }
"""


def build_vocab(doc):
    sections = parse_vocab(doc.get("markdown", ""))
    total = sum(len(s["entries"]) for s in sections)
    title = doc.get("title") or first_h1(doc.get("markdown", "")) or "VOCABULARY"
    brk = " / ".join(f"{s['name'].split(' ')[0]} {len(s['entries'])}" for s in sections if s["name"]) or ""
    pos_set = []
    for s in sections:
        for e in s["entries"]:
            if e["pos"] not in pos_set:
                pos_set.append(e["pos"])
    out = [f'<div class="footer-anchor">{esc(title)} · 뜻은 단원 맥락 기준 핵심 의미 1개</div>']
    out.append('<div class="vhead">')
    if doc.get("brand"):
        out.append(f'<div class="vbrand">{esc(doc["brand"])}</div>')
    out.append('<div class="vtitle-row"><div>')
    out.append(f'<div class="vtitle">{esc(title)}</div>')
    if doc.get("subtitle"):
        out.append(f'<div class="vsub">{esc(doc["subtitle"])}</div>')
    out.append("</div>")
    out.append('<div class="vmeta">')
    out.append(f'<div class="vtotal">총 {total}단어</div>')
    if brk:
        out.append(f"<div>{esc(brk)}</div>")
    if doc.get("meta"):
        out.append(f'<div>{esc(doc["meta"])}</div>')
    out.append("</div></div></div>")
    out.append('<div class="legend"><b>' + esc(" · ".join(pos_set[:6])) + "</b>  |  뜻은 본 단원 맥락에 맞춘 핵심 의미 1개로 정리함</div>")
    roman = ["I", "II", "III", "IV", "V", "VI"]
    for si, s in enumerate(sections):
        name = s["name"] or "단어"
        out.append(f'<div class="secbar"><span>{roman[si % 6]}. {esc(name)}</span><span class="cnt">{len(s["entries"])} words</span></div>')
        out.append("<div>")
        for e in s["entries"]:
            out.append('<div class="entry">')
            out.append(f'<div class="e-num">{esc(e["n"])}</div><div>')
            out.append(f'<span class="e-word">{esc(e["word"])}</span><span class="e-ipa">[{esc(e["ipa"])}]</span><span class="e-pos">{esc(e["pos"])}</span>')
            out.append(f'<div class="e-mean">{esc(e["meaning"])}</div>')
            if e["ex"]:
                out.append(f'<div class="e-ex">{esc(e["ex"])}</div>')
            if e["tr"]:
                out.append(f'<div class="e-tr">{esc(e["tr"])}</div>')
            out.append("</div></div>")
        out.append("</div>")
    return "\n".join(out), vocab_css()


# --------------------------------------------------------------------------- #
# 학습노트 (notes) — topic-themed concept cards
# --------------------------------------------------------------------------- #
def notes_css():
    return """
.nband { background: var(--pri); color:#fff; border-radius: 2.5mm; padding: 7mm 7mm 6mm; margin-bottom: 6mm; }
.nband .nk { display:inline-block; background: rgba(255,255,255,.18); border:1px solid rgba(255,255,255,.45);
  border-radius: 999px; font-size: 8.2pt; padding: .6mm 4mm; letter-spacing:.12em; margin-bottom: 2.5mm; }
.nband h1 { margin:0; font-size: 20pt; line-height:1.25; }
.nband .nsub { opacity:.85; font-size: 9.3pt; margin-top: 1.2mm; }
.ncard { border: 1px solid var(--line); border-left: 3.5px solid var(--acc); border-radius: 2mm;
  padding: 4mm 5mm 3.4mm; margin: 0 0 4.5mm; break-inside: avoid; background: #fff; }
.ncard h2 { margin: 0 0 2mm; color: var(--pri); font-size: 12.5pt; }
.ncard h2 .ndot { color: var(--acc); margin-right: 1.6mm; }
.ncard ul, .ncard ol { margin: 0; padding-left: 5.5mm; }
.ncard li { margin-bottom: 1.2mm; }
.ncard li::marker { color: var(--acc); font-weight: 700; }
strong { color: var(--pri); border-bottom: 1.6px solid var(--acc); padding-bottom: .2mm; }
.ncard.remember { background: var(--chip); border-color: var(--acc); }
.ncard.remember h2 { color: var(--acc); }
"""


def build_notes(doc):
    md = doc.get("markdown", "")
    title = doc.get("title") or first_h1(md) or "학습 노트"
    out = [f'<div class="footer-anchor">{esc(title)}</div>']
    out.append('<div class="nband">')
    out.append(f'<div class="nk">STUDY NOTES</div><h1>{esc(title)}</h1>')
    if doc.get("subtitle"):
        out.append(f'<div class="nsub">{esc(doc["subtitle"])}</div>')
    out.append("</div>")
    # group blocks by h2 into cards
    card, cards = None, []
    for kind, payload in md_blocks(md):
        if kind == "h1":
            continue
        if kind == "h2":
            if card:
                cards.append(card)
            card = {"title": payload, "body": []}
            continue
        if card is None:
            card = {"title": "", "body": []}
        if kind == "ul":
            card["body"].append("<ul>" + "".join(f"<li>{inline(x)}</li>" for x in payload) + "</ul>")
        elif kind == "ol":
            card["body"].append("<ol>" + "".join(f"<li>{inline(x)}</li>" for x in payload) + "</ol>")
        elif kind == "table":
            head, *rows = payload
            t = "<table><thead><tr>" + "".join(f"<th>{inline(c)}</th>" for c in head) + "</tr></thead><tbody>"
            for r in rows:
                t += "<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>"
            card["body"].append(t + "</tbody></table>")
        elif kind == "quote":
            card["body"].append(f'<div class="callout">{inline(payload)}</div>')
        elif kind == "h3":
            card["body"].append(f"<h3>{inline(payload)}</h3>")
        else:
            card["body"].append(f"<p>{inline(payload)}</p>")
    if card:
        cards.append(card)
    for c in cards:
        cls = "ncard remember" if re.search(r"기억|주의|중요|꿀팁", c["title"]) else "ncard"
        out.append(f'<div class="{cls}">')
        if c["title"]:
            out.append(f'<h2><span class="ndot">●</span>{inline(c["title"])}</h2>')
        out.extend(c["body"])
        out.append("</div>")
    return "\n".join(out), notes_css()


# --------------------------------------------------------------------------- #
# 퀴즈 (quiz) — lively question cards + answer booklet
# --------------------------------------------------------------------------- #
CHOICE_RE = re.compile(r"^([A-E])\)\s+(.+)$")
Q_RE = re.compile(r"^(\d+)[.)]\s+(.+)$")
CIRC = "①②③④⑤"


def parse_qa(md):
    """questions: [{n, stem, choices[], space}], answers: [{n, ans, lines[]}]"""
    lines = (md or "").split("\n")
    # split at 정답/해설 heading
    split = len(lines)
    for i, ln in enumerate(lines):
        if re.match(r"^#{1,3}\s*정답", ln.strip()):
            split = i
            break
    qlines, alines = lines[:split], lines[split + 1:]
    questions, cur = [], None
    intro = []
    for ln in qlines:
        s = ln.strip()
        if re.match(r"^#{1,3}\s+", s):
            continue
        qm = Q_RE.match(s)
        cm = CHOICE_RE.match(s)
        if qm and not cm:
            if cur:
                questions.append(cur)
            cur = {"n": qm.group(1), "stem": qm.group(2), "choices": []}
        elif cm and cur:
            cur["choices"].append(cm.group(2))
        elif s and cur:
            cur["stem"] += " " + s
        elif s and not cur:
            intro.append(s)
    if cur:
        questions.append(cur)
    answers, cura = [], None
    for ln in alines:
        s = ln.strip()
        if not s:
            continue
        am = re.match(r"^(\d+)[.)]\s*정답\s*[:：]?\s*(.*)$", s)
        if am:
            if cura:
                answers.append(cura)
            cura = {"n": am.group(1), "ans": am.group(2), "lines": []}
        elif cura:
            cura["lines"].append(s)
    if cura:
        answers.append(cura)
    return intro, questions, answers


def ans_display(ans, choices_count):
    a = (ans or "").strip()
    if len(a) >= 1 and a[0].upper() in "ABCDE":
        return CIRC[ord(a[0].upper()) - 65]
    return a


def quiz_css():
    return """
.qband { border-radius: 3mm; padding: 6mm 7mm; margin-bottom: 5mm; color:#fff;
  background: var(--pri);
  border-bottom: 3.5px solid var(--acc); }
.qband .qk { font-size: 8.4pt; letter-spacing: .3em; opacity: .9; }
.qband h1 { margin: 1mm 0 0; font-size: 19pt; }
.qband .qsub { font-size: 9.2pt; opacity: .9; margin-top: 1mm; }
.qcard { border: 1.5px solid var(--pri); border-radius: 2.5mm; padding: 0; margin-bottom: 4.5mm; break-inside: avoid; overflow: hidden; }
.qcard .qhead { display:flex; align-items:center; gap: 3mm; padding: 2.6mm 4mm; background: var(--soft); }
.qcard .qnum { flex:none; width: 8mm; height: 8mm; border-radius: 50%; background: var(--acc); color:#fff;
  font-weight:700; text-align:center; line-height: 8mm; font-size: 10.5pt; }
.qcard .qstem { font-weight: 700; font-size: 10.6pt; }
.qcard .qopts { display:grid; grid-template-columns: 1fr 1fr; gap: 1.6mm 5mm; padding: 3mm 4.5mm 3.4mm; }
.qopt { display:flex; gap: 2mm; align-items: baseline; font-size: 9.8pt; }
.qopt .oc { color: var(--pri); font-weight:700; font-family:'DocSym','DocSans'; }
.score-line { text-align:right; color: var(--gray); font-size: 8.6pt; margin: 1mm 0 4mm; }
.abook { break-before: page; }
.abar { background: var(--acc); color: #fff; border-radius: 2mm; padding: 3mm 5mm; font-weight:700; font-size: 12.5pt; margin-bottom: 4mm; }
.acard { border-left: 3px solid var(--acc); background: var(--soft); border-radius: 0 2mm 2mm 0;
  padding: 3mm 4.5mm; margin-bottom: 3.5mm; break-inside: avoid; }
.acard .ahead { font-weight: 700; color: var(--pri); margin-bottom: 1mm; }
.acard .ahead .abadge { display:inline-block; width: 6.5mm; height: 6.5mm; border-radius: 50%; text-align:center;
  line-height: 6.5mm; background: var(--pri); color:#fff; margin-right: 2mm; font-size: 9pt; }
.acard .aline { font-size: 9.3pt; margin-top: .6mm; }
.acard .aline b { color: var(--acc); }
"""


def build_quiz(doc):
    intro, questions, answers = parse_qa(doc.get("markdown", ""))
    title = doc.get("title") or first_h1(doc.get("markdown", "")) or "퀴즈"
    out = [f'<div class="footer-anchor">{esc(title)}</div>']
    out.append('<div class="qband"><div class="qk">Q U I Z</div>')
    out.append(f"<h1>{esc(title)}</h1>")
    sub = doc.get("subtitle") or f"총 {len(questions)}문항 · 다 풀면 스스로 채점해 보세요!"
    out.append(f'<div class="qsub">{esc(sub)}</div></div>')
    out.append(f'<div class="score-line">이름 ______________ · 점수 _______ / {len(questions)}</div>')
    for q in questions:
        out.append('<div class="qcard">')
        out.append(f'<div class="qhead"><div class="qnum">{esc(q["n"])}</div><div class="qstem">{inline(q["stem"])}</div></div>')
        if q["choices"]:
            out.append('<div class="qopts">')
            for idx, ch in enumerate(q["choices"]):
                out.append(f'<div class="qopt"><span class="oc">{CIRC[idx] if idx < 5 else idx + 1}</span><span>{inline(ch)}</span></div>')
            out.append("</div>")
        out.append("</div>")
    if answers:
        out.append('<div class="abook"><div class="abar">✔ 정답 및 해설</div>')
        for a in answers:
            out.append('<div class="acard">')
            out.append(f'<div class="ahead"><span class="abadge">{esc(a["n"])}</span>정답 {esc(ans_display(a["ans"], 5))}</div>')
            for ln in a["lines"]:
                ln2 = re.sub(r"^(핵심|오답 체크|해설)\s*", r"<b>\1</b>  ", esc(ln), count=1)
                out.append(f'<div class="aline">{ln2}</div>')
            out.append("</div>")
        out.append("</div>")
    return "\n".join(out), quiz_css()


# --------------------------------------------------------------------------- #
# 학습지 (worksheet) — commercial workbook look
# --------------------------------------------------------------------------- #
def ws_css():
    return """
.whead { border: 1.5px solid var(--pri); border-radius: 2.5mm; overflow:hidden; margin-bottom: 5mm; }
.whead .wtop { background: var(--pri); color:#fff; display:flex; justify-content:space-between; align-items:center; padding: 3mm 5mm; }
.whead .wtop h1 { margin:0; font-size: 15.5pt; }
.whead .wtop .wtag { font-size: 8.4pt; letter-spacing:.22em; opacity:.9; }
.whead .winfo { display:flex; justify-content: space-between; padding: 2.2mm 5mm; font-size: 8.8pt; color: var(--gray); background: var(--soft); }
.concept { border: 1.2px dashed var(--acc); background: var(--chip); border-radius: 2mm; padding: 3.2mm 4.5mm; margin-bottom: 5mm; }
.concept .ct { font-weight:700; color: var(--acc); margin-bottom: 1mm; }
.concept .ct::before { content:'✦ '; }
.prob { display:flex; gap: 3mm; margin-bottom: 2.5mm; break-inside: avoid; }
.prob .pn { flex:none; width: 7.5mm; height: 7.5mm; border: 1.6px solid var(--pri); border-radius: 2mm; color: var(--pri);
  font-weight: 700; text-align:center; line-height: 7mm; font-size: 10.5pt; background:#fff; }
.prob .pbody { flex:1; }
.prob .pstem { font-size: 10.4pt; font-weight: 500; padding-top: .8mm; }
.workspace { border-bottom: 1px dashed #C9CFD6; height: 13mm; margin: 1.5mm 0 3mm; }
.wsans { break-before: page; }
.wsans .abar { background: var(--pri); color:#fff; border-radius: 2mm; padding: 3mm 5mm; font-weight:700; font-size: 12.5pt; margin-bottom: 4mm; }
.wsans .acard { border: 1px solid var(--line); border-left: 3px solid var(--acc); border-radius: 0 2mm 2mm 0;
  padding: 2.6mm 4mm; margin-bottom: 2.6mm; break-inside: avoid; }
.wsans .ahead { font-weight:700; color: var(--pri); }
.wsans .ahead .abn { color: var(--acc); margin-right: 1.6mm; }
.wsans .aline { font-size: 9.2pt; color: #3F4650; margin-top: .4mm; }
.wsans .aline b { color: var(--acc); }
"""


def build_worksheet(doc):
    md = doc.get("markdown", "")
    intro, questions, answers = parse_qa(md)
    title = doc.get("title") or first_h1(md) or (intro[0] if intro else "학습지")
    concept = doc.get("concept") or ""
    # allow a '> ...' quote block or '## 개념' section as the concept box
    for kind, payload in md_blocks(md):
        if kind == "quote" and not concept:
            concept = payload
    out = [f'<div class="footer-anchor">{esc(title)}</div>']
    out.append('<div class="whead">')
    out.append(f'<div class="wtop"><h1>{esc(title)}</h1><span class="wtag">WORKSHEET</span></div>')
    info = doc.get("subtitle") or f"총 {len(questions)}문항"
    out.append(f'<div class="winfo"><span>{esc(info)}</span><span>이름 ______________</span></div></div>')
    if concept:
        out.append(f'<div class="concept"><div class="ct">개념 콕콕</div><div>{inline(concept)}</div></div>')
    for q in questions:
        out.append('<div class="prob">')
        out.append(f'<div class="pn">{esc(q["n"])}</div><div class="pbody">')
        out.append(f'<div class="pstem">{inline(q["stem"])}</div>')
        if q["choices"]:
            out.append('<div class="qopts" style="display:grid;grid-template-columns:1fr 1fr;gap:1.4mm 5mm;margin-top:1.6mm;">')
            for idx, ch in enumerate(q["choices"]):
                out.append(f'<div class="qopt" style="display:flex;gap:2mm;"><span style="color:var(--pri);font-weight:700;font-family:DocSym">{CIRC[idx] if idx < 5 else idx + 1}</span><span>{inline(ch)}</span></div>')
            out.append("</div>")
        else:
            out.append('<div class="workspace"></div>')
        out.append("</div></div>")
    if answers:
        out.append('<div class="wsans"><div class="abar">정답 및 해설</div>')
        for a in answers:
            out.append('<div class="acard">')
            out.append(f'<div class="ahead"><span class="abn">{esc(a["n"])}</span>정답 {esc(a["ans"])}</div>')
            for ln in a["lines"]:
                ln2 = re.sub(r"^(핵심|오답 체크|해설)\s*", r"<b>\1</b>  ", esc(ln), count=1)
                out.append(f'<div class="aline">{ln2}</div>')
            out.append("</div>")
        out.append("</div>")
    return "\n".join(out), ws_css()


# --------------------------------------------------------------------------- #
# generic 문서 (doc) — elegant themed document (지도안·소설·엑셀 등)
# --------------------------------------------------------------------------- #
def doc_css():
    return """
.dband { border-bottom: 2.2pt solid var(--pri); padding-bottom: 3.5mm; margin-bottom: 6mm; position: relative; }
.dband::after { content:''; position:absolute; left:0; right:0; bottom:-1.9mm; border-bottom:.6pt solid var(--acc); }
.dband .dk { color: var(--acc); font-size: 8.4pt; letter-spacing:.3em; font-weight:700; }
.dband h1 { margin: 1mm 0 0; color: var(--pri); font-family:'DocSerif','DocSans'; font-size: 19pt; }
.dband .dsub { color: var(--gray); font-size: 9.2pt; margin-top: 1mm; }
h2 { color: var(--pri); font-size: 13pt; border-left: 3.5px solid var(--acc); padding-left: 3mm; margin: 6mm 0 2.5mm; }
h3 { color: var(--pri); font-size: 11pt; margin: 4mm 0 1.6mm; }
p { margin: 0 0 2.4mm; }
li { margin-bottom: 1mm; }
li::marker { color: var(--acc); font-weight:700; }
"""


def build_doc(doc):
    md = doc.get("markdown", "")
    title = doc.get("title") or first_h1(md) or "문서"
    out = [f'<div class="footer-anchor">{esc(title)}</div>']
    out.append('<div class="dband">')
    kicker = doc.get("kicker") or "DOCUMENT"
    out.append(f'<div class="dk">{esc(kicker)}</div><h1>{esc(title)}</h1>')
    if doc.get("subtitle"):
        out.append(f'<div class="dsub">{esc(doc["subtitle"])}</div>')
    out.append("</div>")
    out.append(md_html(md, skip_h1=True))
    return "\n".join(out), doc_css()


BUILDERS = {"vocab": build_vocab, "notes": build_notes, "quiz": build_quiz,
            "worksheet": build_worksheet, "doc": build_doc}


def render(doc, out_path):
    dtype = doc.get("type") if doc.get("type") in BUILDERS else "doc"
    theme = pick_theme(doc.get("theme"), doc.get("title"), doc.get("subtitle"), (doc.get("markdown") or "")[:1500])
    t = THEMES[theme]
    body, extra_css = BUILDERS[dtype](doc)
    html_doc = ("<!DOCTYPE html><html lang='ko'><head><meta charset='utf-8'><title>"
                + esc(doc.get("title") or "문서") + "</title></head><body>" + body + "</body></html>")
    font_config = FontConfiguration()
    css = CSS(string=base_css(t) + extra_css, font_config=font_config)
    document = HTML(string=html_doc, base_url=REPO_ROOT).render(stylesheets=[css], font_config=font_config)
    document.write_pdf(out_path)
    return {"ok": True, "type": dtype, "theme": theme, "pages": len(document.pages)}


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="in_path", default=None)
    ap.add_argument("--out", dest="out_path", required=False)
    args = ap.parse_args(argv)
    if weasyprint is None:
        print(json.dumps({"ok": False, "error": f"weasyprint unavailable: {_WEASY_IMPORT_ERROR}"}))
        return 2
    if not args.out_path:
        print(json.dumps({"ok": False, "error": "--out is required"}))
        return 2
    try:
        raw = open(args.in_path, encoding="utf-8").read() if args.in_path else sys.stdin.read()
        doc = json.loads(raw)
        log = render(doc, args.out_path)
        print(json.dumps(log, ensure_ascii=False))
        return 0
    except Exception as e:
        sys.stderr.write(traceback.format_exc())
        print(json.dumps({"ok": False, "error": str(e)}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
