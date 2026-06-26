#!/usr/bin/env python3
"""
exam_pdf.py -- Render a structured exam JSON model into a polished A4 PDF
using WeasyPrint and locally bundled fonts (no CDN).

CLI:
    python3 scripts/exam_pdf.py --in model.json --out exam.pdf
    cat model.json | python3 scripts/exam_pdf.py --out exam.pdf

On success prints a one-line JSON QA log to STDOUT, e.g.:
    {"ok":true,"pages":7,"passes":[...],"fellBack":false}
On failure exits non-zero with a JSON error on STDOUT:
    {"ok":false,"error":"..."}
Diagnostic details are written to STDERR only; never a stack trace to STDOUT.

See scripts/EXAM_PDF_README.md for the full schema + deployment notes.
"""

import sys
import os
import json
import argparse
import html as html_mod
import traceback

# WeasyPrint is required. Import lazily so that a missing dependency produces a
# clean JSON error on stdout rather than an import-time stack trace.
try:
    import weasyprint
    from weasyprint import HTML, CSS
    from weasyprint.text.fonts import FontConfiguration
    _WEASY_IMPORT_ERROR = None
except Exception as _e:  # pragma: no cover - environment guard
    weasyprint = None
    _WEASY_IMPORT_ERROR = _e


# --------------------------------------------------------------------------- #
# Paths / constants
# --------------------------------------------------------------------------- #

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)
FONTS_DIR = os.path.join(REPO_ROOT, "fonts")

# Palette (EXACT per spec)
NAVY = "#192744"
BRASS = "#A8894E"
PAGE_BG = "#FBF8F1"
PANEL_BG = "#F3ECDC"
CONTENT_BG = "#FFFFFF"
BODY_INK = "#22252B"
FOOTER_GRAY = "#9A9486"

# Scale loop bounds
SCALE_MAX = 1.0
SCALE_MIN = 0.85
SCALE_STEP = 0.05
MAX_PASSES = 3
# Tolerance (px) for floating-point edge comparison.
OVERFLOW_EPS = 0.5


# --------------------------------------------------------------------------- #
# Small helpers
# --------------------------------------------------------------------------- #

def log(*args):
    """Write a diagnostic line to STDERR only."""
    print(*args, file=sys.stderr)


def esc(value):
    """HTML-escape a value, treating None/empty safely."""
    if value is None:
        return ""
    return html_mod.escape(str(value))


def is_nonempty(value):
    if value is None:
        return False
    if isinstance(value, str):
        return value.strip() != ""
    if isinstance(value, (list, tuple, dict)):
        return len(value) > 0
    return True


def font_url(filename):
    path = os.path.join(FONTS_DIR, filename)
    # Absolute file:// URL, per spec.
    return "file://" + path


def letter_for(index):
    """0 -> A, 1 -> B ..."""
    return chr(ord("A") + index) if 0 <= index < 26 else str(index + 1)


CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳"


def circled(index):
    """0 -> ①, 1 -> ② … (options render as circled numbers, per the blueprint)."""
    return CIRCLED[index] if 0 <= index < len(CIRCLED) else str(index + 1)


def circled_answer(value):
    """Map an answer token ('A'/'b'/'①'/'B,D'…) to circled number(s) for display.
    Non-letter answers (e.g. a 서술형 모범답안) are returned unchanged."""
    s = str(value or "").strip()
    if not s:
        return s
    if s[0] in CIRCLED:
        return s
    out = []
    for ch in s:
        up = ch.upper()
        if "A" <= up <= "Z":
            out.append(circled(ord(up) - ord("A")))
        elif ch in CIRCLED:
            out.append(ch)
        elif ch in " ,·/":
            out.append(ch)
        else:
            # Mixed/long text (서술형) — not a simple letter list; leave as-is.
            return s
    return "".join(out)


# --------------------------------------------------------------------------- #
# CSS
# --------------------------------------------------------------------------- #

def build_css(content_scale, hard_wrap):
    """
    Build the full stylesheet. `content_scale` scales all font sizes via the
    --content-scale custom property used inside calc(); `hard_wrap` toggles a
    more aggressive break-word mode as a last resort.
    """
    word_break = "break-word" if hard_wrap else "keep-all"
    overflow_wrap = "anywhere"  # always permit breaking very long unbreakable runs

    return f"""
/* ----- Bundled fonts (no CDN) ----- */
@font-face {{
    font-family: 'ExamSerif';
    src: url('{font_url("NotoSerifKR-Regular.ttf")}') format('truetype');
    font-weight: 400; font-style: normal;
}}
@font-face {{
    font-family: 'ExamSerif';
    src: url('{font_url("NotoSerifKR-Bold.ttf")}') format('truetype');
    font-weight: 700; font-style: normal;
}}
@font-face {{
    font-family: 'ExamSans';
    src: url('{font_url("NotoSansKR-Regular.ttf")}') format('truetype');
    font-weight: 400; font-style: normal;
}}
@font-face {{
    font-family: 'ExamSans';
    src: url('{font_url("NotoSansKR-Bold.ttf")}') format('truetype');
    font-weight: 700; font-style: normal;
}}
@font-face {{
    /* DejaVu Sans: provides U+2726 (diamond) and other symbol fallbacks. */
    font-family: 'ExamSym';
    src: url('{font_url("DejaVuSans.ttf")}') format('truetype');
    font-weight: 400; font-style: normal;
}}

:root {{
    --content-scale: {content_scale:.4f};
    --navy: {NAVY};
    --brass: {BRASS};
    --page-bg: {PAGE_BG};
    --panel-bg: {PANEL_BG};
    --content-bg: {CONTENT_BG};
    --ink: {BODY_INK};
    --gray: {FOOTER_GRAY};
    /* Font stacks: KR primary + DejaVu symbol fallback so '✦' renders. */
    --serif-stack: 'ExamSerif', 'ExamSym', serif;
    --sans-stack: 'ExamSans', 'ExamSym', sans-serif;
}}

/* ----- Page setup + running footer via @page margin boxes ----- */
@page {{
    size: A4;
    margin: 18mm 16mm 20mm 16mm;
    background: var(--page-bg);

    @bottom-left {{
        content: string(footer-left);
        font-family: var(--sans-stack);
        font-size: 8pt;
        color: var(--gray);
        vertical-align: top;
        padding-top: 2.4mm;
    }}
    @bottom-right {{
        content: string(footer-right) ' · ' counter(page) ' / ' counter(pages);
        font-family: var(--sans-stack);
        font-size: 8pt;
        color: var(--gray);
        vertical-align: top;
        padding-top: 2.4mm;
    }}
    /* Hairline rule above the footer (full content width). */
    @bottom-center {{
        content: '';
        display: block;
    }}
}}

html {{
    background: var(--page-bg);
}}

body {{
    font-family: var(--sans-stack);
    color: var(--ink);
    background: var(--page-bg);
    margin: 0;
    padding: 0;
    line-height: 1.65;            /* generous line-height for Korean */
    font-size: calc(10.5pt * var(--content-scale));
    word-break: {word_break};
    overflow-wrap: {overflow_wrap};
    -weasy-hyphens: manual;
}}

/* Carry footer strings on the body so they apply from page 1. */
.footer-left {{ string-set: footer-left content(); }}
.footer-right {{ string-set: footer-right content(); }}
.footer-anchor {{
    position: absolute;
    width: 0; height: 0;
    overflow: hidden;
    visibility: hidden;
}}

/* The hairline rule above the footer: draw via a border on @bottom-center
   is awkward; instead we draw it on every page using a fixed running line. */
.page-rule {{ display: none; }}

* {{
    box-sizing: border-box;
}}

h1, h2, h3 {{
    margin: 0;
    font-weight: 700;
}}

p {{ margin: 0; }}

/* ============================ COVER ============================ */
.cover {{
    text-align: center;
    padding-top: 4mm;
}}
.cover .brand {{
    font-family: var(--serif-stack);
    font-weight: 700;
    color: var(--brass);
    text-transform: uppercase;
    letter-spacing: 0.42em;
    font-size: calc(10pt * var(--content-scale));
    margin-bottom: 9mm;
    padding-left: 0.42em;       /* offset trailing tracking for centering */
}}
.cover .subtitle {{
    font-family: var(--serif-stack);
    color: var(--navy);
    letter-spacing: 0.30em;
    font-size: calc(11pt * var(--content-scale));
    padding-left: 0.30em;
    margin-bottom: 3.5mm;
}}
.cover .hairline {{
    width: 46mm;
    height: 0;
    border-top: 1px solid var(--brass);
    margin: 0 auto 6mm auto;
}}
.cover .exam-title {{
    font-family: var(--serif-stack);
    font-weight: 700;
    color: var(--navy);
    letter-spacing: 0.10em;
    font-size: calc(31pt * var(--content-scale));
    line-height: 1.25;
    padding-left: 0.10em;
    margin-bottom: 3mm;
}}
.cover .title-latin {{
    font-family: var(--serif-stack);
    color: var(--brass);
    text-transform: uppercase;
    letter-spacing: 0.36em;
    font-size: calc(9.5pt * var(--content-scale));
    padding-left: 0.36em;
    margin-bottom: 7mm;
}}
.cover .meta-line {{
    font-family: var(--sans-stack);
    color: var(--ink);
    font-size: calc(10pt * var(--content-scale));
    letter-spacing: 0.02em;
    margin-bottom: 6mm;
}}
.cover .meta-line .sep {{
    color: var(--brass);
    padding: 0 0.5em;
}}
.cover .difficulty-box {{
    display: inline-block;
    border: 1px solid var(--navy);
    color: var(--navy);
    font-family: var(--sans-stack);
    font-weight: 700;
    letter-spacing: 0.14em;
    font-size: calc(9.5pt * var(--content-scale));
    padding: 2mm 7mm;
    margin-bottom: 9mm;
}}
.cover .difficulty-box .dl {{
    color: var(--brass);
    font-weight: 700;
    letter-spacing: 0.18em;
    margin-right: 0.7em;
}}

/* ----- Generic bordered box ----- */
.box {{
    border: 1px solid var(--navy);
    background: var(--content-bg);
    text-align: left;
    margin: 0 auto 7mm auto;
    padding: 0;
}}
.box-thin {{
    border: 1px solid var(--brass);
}}
.box-head {{
    font-family: var(--serif-stack);
    font-weight: 700;
    color: var(--navy);
    letter-spacing: 0.16em;
    font-size: calc(10.5pt * var(--content-scale));
    padding: 2.6mm 5mm;
    border-bottom: 1px solid var(--navy);
    background: var(--panel-bg);
}}
.box-body {{
    padding: 4mm 5mm;
    font-size: calc(10pt * var(--content-scale));
    color: var(--ink);
}}

.notice-box {{
    margin: 0 auto 7mm auto;
    border: 1px solid var(--brass);
    background: var(--content-bg);
    padding: 3.5mm 5mm;
    text-align: left;
    font-size: calc(9.8pt * var(--content-scale));
}}
.notice-box .notice-label {{
    font-family: var(--serif-stack);
    font-weight: 700;
    color: var(--brass);
    letter-spacing: 0.18em;
    margin-right: 0.8em;
}}

.instructions {{
    margin: 0;
    padding-left: 5.5mm;
    list-style-position: outside;
}}
.instructions li {{
    margin-bottom: 1.6mm;
    line-height: 1.6;
}}
.instructions li::marker {{
    color: var(--brass);
    font-weight: 700;
}}

/* ----- Fill-in table ----- */
table.fillin {{
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    margin: 0 auto 7mm auto;
    font-size: calc(10pt * var(--content-scale));
}}
table.fillin td {{
    border: 1px solid var(--navy);
    padding: 3mm 4mm;
    word-break: {word_break};
    overflow-wrap: {overflow_wrap};
}}
table.fillin td.label {{
    background: var(--panel-bg);
    font-family: var(--sans-stack);
    font-weight: 700;
    color: var(--navy);
    letter-spacing: 0.1em;
    width: 18mm;
    white-space: nowrap;
}}

/* ----- Score table (배점표) ----- */
table.score {{
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    margin: 0 auto 7mm auto;
    font-size: calc(9.2pt * var(--content-scale));
}}
table.score th, table.score td {{
    border: 1px solid var(--navy);
    padding: 2.4mm 2.6mm;
    text-align: center;
    word-break: {word_break};
    overflow-wrap: {overflow_wrap};
    vertical-align: middle;
}}
table.score thead th {{
    background: var(--navy);
    color: #FFFFFF;
    font-family: var(--sans-stack);
    font-weight: 700;
    letter-spacing: 0.04em;
}}
table.score thead {{ display: table-header-group; }}
table.score tr {{ break-inside: avoid; }}
table.score tr.summary td {{
    background: var(--panel-bg);
    font-weight: 700;
    color: var(--navy);
}}

/* ----- Part-summary 2-col box ----- */
.part-summary-grid {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
}}
.part-summary-grid .ps-cell {{
    border: 1px solid var(--navy);
    margin: -0.5px 0 0 -0.5px;   /* collapse adjacent borders */
    padding: 3mm 4mm;
    break-inside: avoid;
}}
.ps-cell .ps-code {{
    font-family: var(--serif-stack);
    font-weight: 700;
    color: var(--brass);
    letter-spacing: 0.12em;
    margin-right: 0.7em;
}}
.ps-cell .ps-name {{
    font-family: var(--sans-stack);
    font-weight: 700;
    color: var(--navy);
}}
.ps-cell .ps-meta {{
    display: block;
    color: var(--gray);
    font-size: calc(8.6pt * var(--content-scale));
    margin-top: 0.8mm;
    letter-spacing: 0.02em;
}}

/* ----- Cover footer motto ----- */
.cover-motto {{
    text-align: center;
    font-family: var(--serif-stack);
    color: var(--gray);
    letter-spacing: 0.22em;
    font-size: calc(9pt * var(--content-scale));
    margin-top: 6mm;
    padding-left: 0.22em;
}}

/* ============================ PARTS / ITEMS ============================ */
.part-divider {{
    background: var(--navy);
    color: #FFFFFF;
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 3mm 5mm;
    margin: 0 0 6mm 0;
    break-inside: avoid;
    break-after: avoid;
}}
.part-divider .pd-left {{
    font-family: var(--serif-stack);
    font-weight: 700;
    letter-spacing: 0.20em;
    font-size: calc(12.5pt * var(--content-scale));
}}
.part-divider .pd-left .pd-code {{
    color: #D8C39A;
    margin-right: 0.9em;
}}
.part-divider .pd-right {{
    font-family: var(--sans-stack);
    color: #D8C39A;
    letter-spacing: 0.06em;
    font-size: calc(9pt * var(--content-scale));
    text-align: right;
}}

/* ----- Reading passage panel ----- */
.passage {{
    border: 1px solid var(--navy);
    background: var(--content-bg);
    padding: 4mm 5mm 4.5mm 5mm;
    margin: 0 0 6mm 0;
    break-inside: avoid;
}}
.passage .pg-head {{
    display: flex;
    justify-content: space-between;
    align-items: baseline;
}}
.passage .pg-title {{
    font-family: var(--serif-stack);
    font-weight: 700;
    color: var(--navy);
    letter-spacing: 0.06em;
    font-size: calc(11.5pt * var(--content-scale));
}}
.passage .pg-tag {{
    font-family: var(--sans-stack);
    color: var(--brass);
    font-weight: 700;
    letter-spacing: 0.08em;
    font-size: calc(8.4pt * var(--content-scale));
    text-align: right;
}}
.passage .pg-rule {{
    border-top: 1px solid var(--brass);
    margin: 2.6mm 0 3mm 0;
}}
.passage .pg-body p {{
    text-align: justify;
    margin-bottom: 2.4mm;
    line-height: 1.7;
    font-size: calc(10pt * var(--content-scale));
}}
.passage .pg-body p:last-child {{ margin-bottom: 0; }}

/* ----- Question item ----- */
.item {{
    margin: 0 0 6mm 0;
    break-inside: avoid;
}}
.item .q-head {{
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 2.4mm;
}}
.item .q-head-left {{
    display: flex;
    align-items: baseline;
}}
.q-num {{
    display: inline-block;
    background: var(--navy);
    color: #FFFFFF;
    font-family: var(--sans-stack);
    font-weight: 700;
    width: calc(7mm * var(--content-scale));
    height: calc(7mm * var(--content-scale));
    line-height: calc(7mm * var(--content-scale));
    text-align: center;
    font-size: calc(10pt * var(--content-scale));
    margin-right: 3mm;
    flex: none;
}}
.q-label {{
    font-family: var(--sans-stack);
    font-weight: 700;
    color: var(--navy);
    letter-spacing: 0.04em;
    font-size: calc(10.5pt * var(--content-scale));
    align-self: center;
}}
.q-label .killer {{
    color: var(--brass);
    margin-left: 0.5em;
    letter-spacing: 0.02em;
}}
.q-points {{
    font-family: var(--sans-stack);
    font-weight: 700;
    color: var(--navy);
    font-size: calc(9.5pt * var(--content-scale));
    white-space: nowrap;
    align-self: center;
}}
.item .q-prompt {{
    margin: 0 0 2.6mm 0;
    line-height: 1.65;
    font-size: calc(10.3pt * var(--content-scale));
}}

/* Example / quote box: beige fill + LEFT navy accent bar */
.example-box {{
    background: var(--panel-bg);
    border-left: 3px solid var(--navy);
    padding: 2.6mm 4mm;
    margin: 0 0 3mm 0;
    font-style: italic;
    color: var(--navy);
    font-size: calc(10pt * var(--content-scale));
    line-height: 1.55;
    word-break: {word_break};
    overflow-wrap: {overflow_wrap};
}}

/* Choices: 2-col grid */
.choices {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.4mm 5mm;
    margin-top: 1mm;
}}
.choice {{
    display: flex;
    align-items: baseline;
    font-size: calc(10pt * var(--content-scale));
    line-height: 1.5;
    word-break: {word_break};
    overflow-wrap: {overflow_wrap};
}}
.choice .ch-letter {{
    font-family: var(--sans-stack);
    font-weight: 700;
    color: var(--navy);
    margin-right: 2.2mm;
    flex: none;
}}

/* 서술형 답안란: a ruled writing area when an item has no options */
.answer-blank {{
    margin: 1.5mm 0 1mm 0;
    min-height: 20mm;
    border: 1px solid var(--rule, #D7D2C4);
    border-radius: 3px;
    background-image: repeating-linear-gradient(
        180deg,
        transparent 0,
        transparent 7.4mm,
        var(--rule, #E4DFD2) 7.4mm,
        var(--rule, #E4DFD2) 7.6mm
    );
    background-position: 0 6mm;
    break-inside: avoid;
}}

/* ============================ OMR ANSWER SHEET ============================ */
.omr-section {{ break-before: auto; }}
.omr-title {{
    font-family: var(--sans-stack);
    font-weight: 700;
    color: var(--navy);
    letter-spacing: 0.12em;
    font-size: calc(11pt * var(--content-scale));
    margin: 1mm 0 3mm 0;
}}
.omr-grid {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0 8mm;
    margin-top: 4mm;
}}
.omr-cell {{
    display: flex;
    align-items: center;
    gap: 3mm;
    padding: 1.8mm 0;
    border-bottom: 1px solid var(--rule, #E4DFD2);
    font-size: calc(10.5pt * var(--content-scale));
}}
.omr-cell .omr-n {{
    flex: none;
    min-width: 7mm;
    text-align: right;
    font-family: var(--sans-stack);
    font-weight: 700;
    color: var(--navy);
}}
.omr-bubbles {{ display: flex; gap: 2.4mm; }}
.omr-bubbles .b {{
    color: #9a958a;
    font-size: calc(11pt * var(--content-scale));
    line-height: 1;
}}
.omr-bubbles .b.on {{
    color: #FFFFFF;
    background: var(--navy);
    border-radius: 50%;
    font-weight: 700;
}}
.omr-essay {{
    font-family: var(--sans-stack);
    color: var(--navy);
    font-size: calc(9pt * var(--content-scale));
}}
.omr-rule {{
    flex: 1;
    border-bottom: 1px dotted #B9B3A6;
    height: 0;
    margin-left: 2mm;
}}

/* ============================ ANSWER KEY ============================ */
.section-header {{
    background: var(--navy);
    color: #FFFFFF;
    font-family: var(--serif-stack);
    font-weight: 700;
    letter-spacing: 0.16em;
    font-size: calc(13pt * var(--content-scale));
    padding: 3.4mm 5mm;
    margin: 0 0 6mm 0;
    break-after: avoid;
}}
.section-header .sh-latin {{
    font-family: var(--sans-stack);
    font-weight: 400;
    color: #D8C39A;
    letter-spacing: 0.10em;
    font-size: calc(9pt * var(--content-scale));
    margin-left: 0.9em;
}}

.ak-part {{
    margin: 0 0 5mm 0;
    break-inside: avoid;
}}
.ak-part .ak-part-head {{
    font-family: var(--serif-stack);
    font-weight: 700;
    color: var(--navy);
    border-left: 3px solid var(--brass);
    padding: 0.5mm 0 0.5mm 3mm;
    letter-spacing: 0.08em;
    font-size: calc(10.5pt * var(--content-scale));
    margin-bottom: 2.6mm;
}}
.ak-grid {{
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 1.6mm;
}}
.ak-cell {{
    border: 1px solid var(--navy);
    text-align: center;
    padding: 1.6mm 1mm;
    font-size: calc(9pt * var(--content-scale));
    break-inside: avoid;
}}
.ak-cell .ak-n {{
    display: block;
    color: var(--gray);
    font-size: calc(7.6pt * var(--content-scale));
    letter-spacing: 0.04em;
}}
.ak-cell .ak-a {{
    font-family: var(--sans-stack);
    font-weight: 700;
    color: var(--navy);
    font-size: calc(11pt * var(--content-scale));
}}
.ak-cell .ak-star {{
    color: var(--brass);
    font-size: calc(8pt * var(--content-scale));
}}

/* ============================ EXPLANATIONS ============================ */
.ex-part-head {{
    font-family: var(--serif-stack);
    font-weight: 700;
    color: var(--navy);
    border-left: 3px solid var(--brass);
    padding: 0.6mm 0 0.6mm 3mm;
    letter-spacing: 0.08em;
    font-size: calc(11pt * var(--content-scale));
    margin: 0 0 4mm 0;
    break-after: avoid;
}}
.ex-card {{
    border: 1px solid var(--navy);
    background: var(--content-bg);
    padding: 3.4mm 4.5mm 4mm 4.5mm;
    margin: 0 0 4.5mm 0;
    break-inside: avoid;
}}
.ex-card .ex-head {{
    display: flex;
    align-items: baseline;
    margin-bottom: 2.4mm;
}}
.ex-card .ex-answer {{
    font-family: var(--sans-stack);
    font-weight: 700;
    color: var(--navy);
    letter-spacing: 0.04em;
    font-size: calc(10.5pt * var(--content-scale));
    align-self: center;
}}
.ex-card .ex-head .killer {{
    margin-left: 2.2mm;
    align-self: center;
}}
.ex-card .ex-meta {{
    margin-left: 2.2mm;
    align-self: center;
    font-family: var(--sans-stack);
    color: var(--ink-soft, #6b6357);
    font-size: calc(9pt * var(--content-scale));
}}
.ex-card .ex-text {{
    font-size: calc(10pt * var(--content-scale));
    line-height: 1.65;
    margin-bottom: 2.6mm;
    text-align: justify;
}}
.pill-row {{
    margin-bottom: 1.8mm;
}}
.pill-row:last-child {{ margin-bottom: 0; }}
.pill {{
    display: inline-block;
    background: var(--navy);
    color: #FFFFFF;
    font-family: var(--sans-stack);
    font-weight: 700;
    letter-spacing: 0.08em;
    font-size: calc(8pt * var(--content-scale));
    padding: 0.7mm 2.6mm;
    border-radius: 1.4mm;
    margin-right: 2.2mm;
}}
.pill-text {{
    font-size: calc(9.6pt * var(--content-scale));
    line-height: 1.55;
}}

/* ----- Page break utilities ----- */
.page-break {{ break-before: page; }}
"""


# --------------------------------------------------------------------------- #
# HTML building
# --------------------------------------------------------------------------- #

def meta_line_html(meta):
    """총문항 · 시간 · 배점 · 출제 범위 -- omit empty pieces."""
    if not isinstance(meta, dict):
        meta = {}
    parts = []
    tq = meta.get("totalQuestions")
    if tq not in (None, ""):
        parts.append(f"총문항 {esc(tq)}문항")
    tm = meta.get("timeMinutes")
    if tm not in (None, ""):
        parts.append(f"시험시간 {esc(tm)}분")
    tp = meta.get("totalPoints")
    if tp not in (None, ""):
        parts.append(f"배점 {esc(tp)}점")
    scope = meta.get("scope")
    if is_nonempty(scope):
        parts.append(f"출제 범위 {esc(scope)}")
    if not parts:
        return ""
    sep = '<span class="sep">·</span>'
    return '<div class="meta-line">' + sep.join(parts) + "</div>"


def build_cover(model):
    out = ['<section class="cover">']

    brand = model.get("brand", "")
    if is_nonempty(brand):
        out.append(f'<div class="brand">{esc(brand)}</div>')

    subtitle = model.get("subtitle", "")
    if is_nonempty(subtitle):
        out.append(f'<div class="subtitle">{esc(subtitle)}</div>')
        out.append('<div class="hairline"></div>')

    title = model.get("title") or ""
    if not is_nonempty(title):
        title = "모의고사"
    out.append(f'<h1 class="exam-title">{esc(title)}</h1>')

    title_latin = model.get("titleLatin", "")
    if is_nonempty(title_latin):
        out.append(f'<div class="title-latin">{esc(title_latin)}</div>')

    ml = meta_line_html(model.get("meta") or {})
    if ml:
        out.append(ml)

    difficulty = model.get("difficulty", "")
    if is_nonempty(difficulty):
        out.append(
            '<div class="difficulty-box">'
            '<span class="dl">난이도</span>'
            f"{esc(difficulty)}</div>"
        )

    out.append("</section>")

    # ----- 안내 notice -----
    notice = model.get("notice", "")
    if is_nonempty(notice):
        out.append(
            '<div class="notice-box">'
            '<span class="notice-label">안내</span>'
            f"{esc(notice)}</div>"
        )

    # ----- 수험자 유의사항 -----
    instructions = model.get("instructions") or []
    instructions = [i for i in instructions if is_nonempty(i)]
    if instructions:
        out.append('<div class="box">')
        out.append('<div class="box-head">수험자 유의사항</div>')
        out.append('<div class="box-body">')
        out.append('<ol class="instructions">')
        for ins in instructions:
            out.append(f"<li>{esc(ins)}</li>")
        out.append("</ol></div></div>")

    # ----- fill-in table -----
    fillin = model.get("fillIn") or []
    fillin = [f for f in fillin if is_nonempty(f)]
    if fillin:
        out.append('<table class="fillin"><tbody>')
        # Lay out 2 label/value pairs per row for balance.
        i = 0
        while i < len(fillin):
            out.append("<tr>")
            for _ in range(2):
                if i < len(fillin):
                    out.append(f'<td class="label">{esc(fillin[i])}</td>')
                    out.append("<td></td>")
                    i += 1
                else:
                    out.append('<td class="label"></td><td></td>')
            out.append("</tr>")
        out.append("</tbody></table>")

    # ----- score table 배점표 -----
    out.append(build_score_table(model.get("scoreTable")))

    # ----- part summary 2-col box -----
    out.append(build_part_summary(model.get("partSummary")))

    # ----- motto -----
    motto = model.get("motto", "")
    if is_nonempty(motto):
        out.append(f'<div class="cover-motto">{esc(motto)}</div>')

    return "\n".join(out)


def build_score_table(score):
    if not isinstance(score, dict):
        return ""
    headers = score.get("headers") or []
    rows = score.get("rows") or []
    summary = score.get("summary")
    if not headers and not rows:
        return ""
    out = ['<table class="score">']
    if headers:
        out.append("<thead><tr>")
        for h in headers:
            out.append(f"<th>{esc(h)}</th>")
        out.append("</tr></thead>")
    out.append("<tbody>")
    ncol = len(headers) if headers else (len(rows[0]) if rows else 1)
    for row in rows:
        out.append("<tr>")
        cells = list(row) + [""] * (ncol - len(row))
        for c in cells[:ncol]:
            out.append(f"<td>{esc(c)}</td>")
        out.append("</tr>")
    if isinstance(summary, (list, tuple)) and len(summary) > 0:
        out.append('<tr class="summary">')
        cells = list(summary) + [""] * (ncol - len(summary))
        for c in cells[:ncol]:
            out.append(f"<td>{esc(c)}</td>")
        out.append("</tr>")
    out.append("</tbody></table>")
    return "\n".join(out)


def build_part_summary(part_summary):
    items = part_summary or []
    items = [p for p in items if isinstance(p, dict)]
    if not items:
        return ""
    out = ['<div class="box">']
    out.append('<div class="box-head">파트 구성</div>')
    out.append('<div class="box-body"><div class="part-summary-grid">')
    for ps in items:
        code = esc(ps.get("code", ""))
        name = esc(ps.get("name", ""))
        meta = esc(ps.get("meta", ""))
        out.append('<div class="ps-cell">')
        out.append(f'<span class="ps-code">{code}</span>')
        out.append(f'<span class="ps-name">{name}</span>')
        if meta:
            out.append(f'<span class="ps-meta">{meta}</span>')
        out.append("</div>")
    out.append("</div></div></div>")
    return "\n".join(out)


def build_passage(block):
    title = esc(block.get("title", ""))
    tag = esc(block.get("tag", ""))
    paragraphs = [p for p in (block.get("paragraphs") or []) if is_nonempty(p)]
    out = ['<div class="passage">']
    out.append('<div class="pg-head">')
    out.append(f'<div class="pg-title">{title}</div>')
    if tag:
        out.append(f'<div class="pg-tag">{tag}</div>')
    out.append("</div>")
    out.append('<div class="pg-rule"></div>')
    out.append('<div class="pg-body">')
    for p in paragraphs:
        out.append(f"<p>{esc(p)}</p>")
    out.append("</div></div>")
    return "\n".join(out)


def build_item(block):
    number = block.get("number", "")
    label = esc(block.get("label", ""))
    killer = bool(block.get("killer"))
    points = block.get("points")
    prompt = block.get("prompt", "")
    example = block.get("example", "")
    choices = block.get("choices") or []

    out = ['<div class="item">']
    out.append('<div class="q-head"><div class="q-head-left">')
    out.append(f'<span class="q-num">{esc(number)}</span>')
    killer_html = ' <span class="killer">★Killer</span>' if killer else ""
    out.append(f'<span class="q-label">{label}{killer_html}</span>')
    out.append("</div>")
    if points not in (None, ""):
        out.append(f'<span class="q-points">[{esc(points)}점]</span>')
    out.append("</div>")

    if is_nonempty(prompt):
        out.append(f'<p class="q-prompt">{esc(prompt)}</p>')

    if is_nonempty(example):
        out.append(f'<div class="example-box">{esc(example)}</div>')

    choices = [c for c in choices if is_nonempty(c)]
    if choices:
        out.append('<div class="choices">')
        for idx, ch in enumerate(choices):
            out.append(
                '<div class="choice">'
                f'<span class="ch-letter">{circled(idx)}</span>'
                f"<span>{esc(ch)}</span></div>"
            )
        out.append("</div>")
    elif block.get("blank") or is_nonempty(prompt):
        # 서술형 (no options): a ruled answer-writing area.
        out.append('<div class="answer-blank" aria-label="서술형 답안란"></div>')

    out.append("</div>")
    return "\n".join(out)


def build_parts(parts):
    parts = [p for p in (parts or []) if isinstance(p, dict)]
    if not parts:
        return ""
    out = ['<section class="parts page-break">']
    for part in parts:
        code = esc(part.get("code", ""))
        name = esc(part.get("name", ""))
        meta = esc(part.get("meta", ""))
        out.append('<div class="part-divider">')
        left = f'<span class="pd-code">{code}</span>{name}' if code else name
        out.append(f'<div class="pd-left">{left}</div>')
        if meta:
            out.append(f'<div class="pd-right">{meta}</div>')
        out.append("</div>")
        for block in (part.get("blocks") or []):
            if not isinstance(block, dict):
                continue
            btype = block.get("type")
            if btype == "passage":
                out.append(build_passage(block))
            elif btype == "item":
                out.append(build_item(block))
    out.append("</section>")
    return "\n".join(out)


def build_answer_key(answer_key):
    groups = [g for g in (answer_key or []) if isinstance(g, dict)]
    groups = [g for g in groups if g.get("answers")]
    if not groups:
        return ""
    out = ['<section class="answer-key page-break">']
    out.append(
        '<div class="section-header">[ 정답표 ]'
        '<span class="sh-latin">Answer Key</span></div>'
    )
    for g in groups:
        part = esc(g.get("part", ""))
        answers = [a for a in (g.get("answers") or []) if isinstance(a, dict)]
        out.append('<div class="ak-part">')
        out.append(f'<div class="ak-part-head">{part}</div>')
        out.append('<div class="ak-grid">')
        for a in answers:
            n = esc(a.get("n", ""))
            ans = esc(circled_answer(a.get("a", "")))
            star = ' <span class="ak-star">★</span>' if a.get("killer") else ""
            out.append(
                '<div class="ak-cell">'
                f'<span class="ak-n">{n}</span>'
                f'<span class="ak-a">{ans}</span>{star}</div>'
            )
        out.append("</div></div>")
    out.append("</section>")
    return "\n".join(out)


def build_explanations(explanations):
    groups = [g for g in (explanations or []) if isinstance(g, dict)]
    groups = [g for g in groups if g.get("cards")]
    if not groups:
        return ""
    out = ['<section class="explanations page-break">']
    out.append(
        '<div class="section-header">[ 정밀 해설지 ]'
        '<span class="sh-latin">Detailed Explanations</span></div>'
    )
    for g in groups:
        part = esc(g.get("part", ""))
        cards = [c for c in (g.get("cards") or []) if isinstance(c, dict)]
        out.append(f'<div class="ex-part-head">{part}</div>')
        for c in cards:
            number = esc(c.get("number", ""))
            answer = esc(circled_answer(c.get("answer", "")))
            explanation = c.get("explanation", "")
            key = c.get("key", "")
            wrong = c.get("wrong", "")
            killer = bool(c.get("killer"))
            points = c.get("points")
            difficulty = c.get("difficulty", "")
            out.append('<div class="ex-card">')
            out.append('<div class="ex-head">')
            out.append(f'<span class="q-num">{number}</span>')
            out.append(f'<span class="ex-answer">정답 {answer}</span>')
            if killer:
                out.append('<span class="killer">★Killer</span>')
            meta_bits = []
            if is_nonempty(difficulty):
                meta_bits.append(esc(difficulty))
            if points not in (None, ""):
                meta_bits.append(f"({esc(points)}점)")
            if meta_bits:
                out.append('<span class="ex-meta">· ' + " ".join(meta_bits) + "</span>")
            out.append("</div>")
            if is_nonempty(explanation):
                out.append(f'<p class="ex-text">{esc(explanation)}</p>')
            if is_nonempty(key):
                out.append(
                    '<div class="pill-row"><span class="pill">핵심</span>'
                    f'<span class="pill-text">{esc(key)}</span></div>'
                )
            if is_nonempty(wrong):
                out.append(
                    '<div class="pill-row"><span class="pill">오답 체크</span>'
                    f'<span class="pill-text">{esc(wrong)}</span></div>'
                )
            out.append("</div>")
    out.append("</section>")
    return "\n".join(out)


def build_footer_strings(model):
    """The running-footer left/right strings, set via string-set on hidden nodes."""
    brand = model.get("brand", "")
    title = model.get("title") or "모의고사"
    left = brand if is_nonempty(brand) else title
    difficulty = model.get("difficulty", "")
    right = f"난이도 {difficulty}" if is_nonempty(difficulty) else (title if not is_nonempty(brand) else "")
    if not is_nonempty(right):
        right = "출제"
    parts = [
        f'<div class="footer-left footer-anchor">{esc(left)}</div>',
        f'<div class="footer-right footer-anchor">{esc(right)}</div>',
    ]
    return "\n".join(parts)


def _item_list(model):
    """Ordered [{number, blank}] for every item across all parts."""
    items = []
    for part in (model.get("parts") or []):
        if not isinstance(part, dict):
            continue
        for b in (part.get("blocks") or []):
            if isinstance(b, dict) and b.get("type") == "item":
                items.append({"number": b.get("number"), "blank": bool(b.get("blank"))})
    return items


def _answer_map(model):
    """{item number -> answer letter} from the parsed 정답표."""
    m = {}
    for g in (model.get("answerKey") or []):
        if not isinstance(g, dict):
            continue
        for a in (g.get("answers") or []):
            if isinstance(a, dict) and a.get("n") is not None:
                m[a.get("n")] = str(a.get("a") or "").strip().upper()
    return m


def build_omr(model):
    """'key' variant: a standalone OMR answer sheet — number grid with the correct
    ①②③④⑤ bubble filled, 서술형 → 채점란. Carries its own light header (no full cover)."""
    items = _item_list(model)
    amap = _answer_map(model)
    out = ['<section class="omr-section">']
    title = model.get("title") or "모의고사"
    out.append(f'<h1 class="exam-title">{esc(title)}</h1>')
    out.append('<div class="omr-title">정답 · OMR 답안지</div>')
    ml = meta_line_html(model.get("meta") or {})
    if ml:
        out.append(ml)
    fillin = [f for f in (model.get("fillIn") or []) if is_nonempty(f)]
    if fillin:
        out.append('<table class="fillin"><tbody><tr>')
        for f in fillin[:4]:
            out.append(f'<td class="label">{esc(f)}</td><td></td>')
        out.append("</tr></tbody></table>")
    out.append('<div class="omr-grid">')
    for it in items:
        n = it.get("number")
        out.append('<div class="omr-cell">')
        out.append(f'<span class="omr-n">{esc(n)}</span>')
        if it.get("blank"):
            out.append('<span class="omr-essay">서술형</span><span class="omr-rule"></span>')
        else:
            correct = amap.get(n, "")
            idx = (ord(correct) - ord("A")) if (len(correct) == 1 and "A" <= correct <= "E") else -1
            bubbles = "".join(
                f'<span class="b{" on" if i == idx else ""}">{circled(i)}</span>' for i in range(5)
            )
            out.append(f'<span class="omr-bubbles">{bubbles}</span>')
        out.append("</div>")
    out.append("</div>")
    out.append("</section>")
    return "\n".join(out)


def build_html(model, variant="teacher"):
    variant = variant if variant in ("student", "teacher", "key") else "teacher"
    body = []
    body.append(build_footer_strings(model))
    if variant == "key":
        body.append(build_omr(model))
    else:
        body.append(build_cover(model))
        body.append(build_parts(model.get("parts")))
        if variant == "teacher":
            body.append(build_answer_key(model.get("answerKey")))
            body.append(build_explanations(model.get("explanations")))

    doc = (
        "<!DOCTYPE html>\n"
        '<html lang="ko"><head><meta charset="utf-8">'
        f"<title>{esc(model.get('title') or '모의고사')}</title>"
        "</head><body>\n"
        + "\n".join(body)
        + "\n</body></html>"
    )
    return doc


# --------------------------------------------------------------------------- #
# Overflow inspection
# --------------------------------------------------------------------------- #

def box_right_edge(box):
    """Border-box right edge of a box (content right + right padding + border)."""
    x = getattr(box, "position_x", None)
    w = getattr(box, "width", None)
    if x is None or w is None or not isinstance(w, (int, float)):
        return None
    pr = getattr(box, "padding_right", 0) or 0
    br = getattr(box, "border_right_width", 0) or 0
    return x + w + pr + br


def iter_boxes(box):
    yield box
    for child in getattr(box, "children", ()) or ():
        yield from iter_boxes(child)


def inspect_overflow(document):
    """
    Inspect the rendered document for HORIZONTAL overflow: any box whose
    border-box right edge exceeds the page content right edge.
    Returns dict: {pages, overflow_count, worst_overshoot, samples[]}.
    (WeasyPrint paginates vertically, so only horizontal overflow matters.)
    """
    result = {
        "pages": len(document.pages),
        "overflowCount": 0,
        "worstOvershoot": 0.0,
        "samples": [],
    }
    for pidx, page in enumerate(document.pages):
        pb = page._page_box
        # The PageBox reports position_x=0 but its content area is inset by the
        # page margins: content spans [margin_left, margin_left + width].
        content_left = pb.position_x + (pb.margin_left or 0)
        content_right = content_left + pb.width
        limit = content_right + OVERFLOW_EPS
        for box in iter_boxes(pb):
            if box is pb:
                continue
            edge = box_right_edge(box)
            if edge is None:
                continue
            if edge > limit:
                overshoot = edge - content_right
                result["overflowCount"] += 1
                if overshoot > result["worstOvershoot"]:
                    result["worstOvershoot"] = round(overshoot, 2)
                if len(result["samples"]) < 6:
                    result["samples"].append({
                        "page": pidx + 1,
                        "tag": getattr(box, "element_tag", None),
                        "overshootPx": round(overshoot, 2),
                    })
            # A box whose border-box left edge sits left of the content area
            # is a genuine horizontal overflow too. position_x is already the
            # border-box left edge (it includes any margin offset), so compare
            # it directly -- do NOT subtract margin_left (that breaks auto
            # centering, where a large computed margin is expected).
            if box.position_x < content_left - OVERFLOW_EPS:
                result["overflowCount"] += 1
                overshoot = content_left - box.position_x
                if overshoot > result["worstOvershoot"]:
                    result["worstOvershoot"] = round(overshoot, 2)
    return result


# --------------------------------------------------------------------------- #
# Render + QA loop
# --------------------------------------------------------------------------- #

def render_once(html_doc, content_scale, hard_wrap, font_config):
    css_text = build_css(content_scale, hard_wrap)
    css = CSS(string=css_text, font_config=font_config)
    html = HTML(string=html_doc, base_url=REPO_ROOT)
    document = html.render(stylesheets=[css], font_config=font_config)
    return document


def render_with_qa(model, variant="teacher"):
    """
    Render with an automated review-and-revise loop. Returns (document, qa_log).
    qa_log = {"ok":True,"pages":N,"passes":[...],"fellBack":bool}
    """
    html_doc = build_html(model, variant)
    font_config = FontConfiguration()

    passes = []
    scale = SCALE_MAX
    hard_wrap = False
    document = None
    fell_back = False

    for attempt in range(1, MAX_PASSES + 1):
        document = render_once(html_doc, scale, hard_wrap, font_config)
        report = inspect_overflow(document)
        clean = report["overflowCount"] == 0

        pass_record = {
            "pass": attempt,
            "scale": round(scale, 3),
            "hardWrap": hard_wrap,
            "checked": "horizontal box overflow vs page content width; "
                       "unbreakable boxes; page count",
            "pages": report["pages"],
            "overflowBoxes": report["overflowCount"],
            "worstOvershootPx": report["worstOvershoot"],
            "clean": clean,
        }
        if report["samples"]:
            pass_record["samples"] = report["samples"]

        if clean:
            pass_record["fixed"] = "none needed"
            passes.append(pass_record)
            break

        # Decide a repair for the next pass.
        repairs = []
        if scale > SCALE_MIN + 1e-9:
            scale = max(SCALE_MIN, round(scale - SCALE_STEP, 3))
            repairs.append(f"reduce --content-scale to {scale}")
        if not hard_wrap and (scale <= SCALE_MIN + 1e-9 or report["worstOvershoot"] > 6):
            hard_wrap = True
            repairs.append("enable word-break:break-word (hard wrap)")
        if not repairs:
            repairs.append("no further repair available")
        pass_record["fixed"] = "; ".join(repairs)
        passes.append(pass_record)

        if attempt == MAX_PASSES:
            # Final fallback render at safest settings.
            fell_back = True
            scale = SCALE_MIN
            hard_wrap = True
            document = render_once(html_doc, scale, hard_wrap, font_config)
            final_report = inspect_overflow(document)
            passes.append({
                "pass": "fallback",
                "scale": SCALE_MIN,
                "hardWrap": True,
                "checked": "final safe render",
                "pages": final_report["pages"],
                "overflowBoxes": final_report["overflowCount"],
                "worstOvershootPx": final_report["worstOvershoot"],
                "clean": final_report["overflowCount"] == 0,
                "fixed": "applied min scale + hard wrap fallback",
            })

    qa_log = {
        "ok": True,
        "pages": len(document.pages),
        "passes": passes,
        "fellBack": fell_back,
    }
    return document, qa_log


# --------------------------------------------------------------------------- #
# I/O + main
# --------------------------------------------------------------------------- #

def load_model(in_path):
    if in_path:
        with open(in_path, "r", encoding="utf-8") as f:
            raw = f.read()
    else:
        if sys.stdin.isatty():
            raise ValueError("no --in path given and no JSON on stdin")
        raw = sys.stdin.read()
    if not raw.strip():
        raise ValueError("empty input model")
    try:
        model = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"invalid JSON model: {e}") from e
    if not isinstance(model, dict):
        raise ValueError("JSON model must be an object")
    return model


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Render an exam JSON model into an A4 PDF (WeasyPrint).",
        add_help=True,
    )
    parser.add_argument("--in", dest="in_path", default=None,
                        help="path to JSON model (else read stdin)")
    parser.add_argument("--out", dest="out_path", default=None, required=False,
                        help="output PDF path")
    parser.add_argument("--html", dest="html", action="store_true",
                        help="emit the rendered HTML to stdout and exit (debug/QA)")
    parser.add_argument("--variant", dest="variant", default="teacher",
                        choices=["student", "teacher", "key"],
                        help="student=questions only · teacher=full (default) · key=OMR answer sheet")
    args = parser.parse_args(argv)

    # --html short-circuit: render the HTML only (no WeasyPrint needed). Handy for
    # tests/QA that just need to confirm structure (①②③④⑤, 서술형 답안란, …).
    if args.html:
        try:
            model = load_model(args.in_path)
        except Exception as e:
            print(json.dumps({"ok": False, "error": str(e)}))
            return 1
        sys.stdout.write(build_html(model, args.variant))
        return 0

    if weasyprint is None:
        print(json.dumps({"ok": False,
                          "error": f"weasyprint unavailable: {_WEASY_IMPORT_ERROR}"}))
        return 2

    if not args.out_path:
        print(json.dumps({"ok": False, "error": "--out is required"}))
        return 2

    try:
        model = load_model(args.in_path)
    except Exception as e:
        log("ERROR loading model:", traceback.format_exc())
        print(json.dumps({"ok": False, "error": str(e)}))
        return 1

    try:
        document, qa_log = render_with_qa(model, args.variant)
        out_path = args.out_path
        out_dir = os.path.dirname(os.path.abspath(out_path))
        if out_dir and not os.path.isdir(out_dir):
            os.makedirs(out_dir, exist_ok=True)
        document.write_pdf(out_path)
    except Exception as e:
        log("ERROR rendering:", traceback.format_exc())
        print(json.dumps({"ok": False, "error": str(e)}))
        return 1

    # Single-line JSON QA log to stdout.
    print(json.dumps(qa_log, ensure_ascii=False, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    sys.exit(main())
