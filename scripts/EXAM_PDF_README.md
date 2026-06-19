# Exam PDF Renderer (`exam_pdf.py`)

A standalone Python + [WeasyPrint](https://weasyprint.org/) renderer that turns a
structured exam JSON model into a polished, print-ready **A4 PDF** with a cover
page, parts/questions, a reading-passage panel, an answer key, and a detailed
explanation section. Korean (Hangul) is fully supported; all fonts are
**bundled locally** with **no CDN / network dependency**.

---

## CLI

```bash
# From a file:
python3 scripts/exam_pdf.py --in model.json --out exam.pdf

# From stdin (omit --in):
cat model.json | python3 scripts/exam_pdf.py --out exam.pdf
```

- `--in PATH` — path to the JSON model. If omitted, the model is read from **stdin**.
- `--out PATH` — output PDF path (**required**). Parent directories are created if missing.

### Output contract

On **success**, a single line of JSON is printed to **stdout**:

```json
{"ok":true,"pages":9,"passes":[ ... ],"fellBack":false}
```

- `pages` — final page count.
- `passes` — one record per text-fit QA pass (what it checked + what it fixed; see below).
- `fellBack` — `true` if the QA loop exhausted its passes and applied the safest fallback settings.

On **failure**, exit code is **non-zero** and a single line of JSON is printed to **stdout**:

```json
{"ok":false,"error":"invalid JSON model: Expecting value: line 1 column 1 (char 0)"}
```

**Stack traces / diagnostics are written to STDERR only** — stdout always stays a
single clean JSON line, safe to parse from a calling process.

Exit codes: `0` success · `1` model/render error · `2` usage error (missing `--out`,
WeasyPrint unavailable).

---

## JSON model schema

Every field is **optional-safe**: missing, `null`, or empty values never crash the
renderer, and the layout still looks balanced. `title` is the only effectively
required field — if empty it falls back to `"모의고사"`.

```jsonc
{
  "brand": "",            // optional brass tracked-caps brand/institution line; "" => omitted
  "motto": "",            // optional centered tracked footer quote on the cover; "" => omitted
  "subtitle": "",         // optional tracked navy subtitle above the title (e.g. "기말 대비 모의고사")
  "title": "string",      // exam title (large navy serif). If empty => "모의고사"
  "titleLatin": "",       // optional brass tracked Latin subtitle under the title
  "meta": {               // omit any piece by leaving it null/empty
    "totalQuestions": 33,
    "timeMinutes": 45,
    "totalPoints": 100,
    "scope": ""
  },
  "difficulty": "중 · 표준",       // shown in a navy-bordered cover box and in the footer
  "notice": "",                    // optional 안내 note in a thin brass-bordered box
  "instructions": ["...", "..."],  // 수험자 유의사항 numbered list (may be empty)
  "fillIn": ["반", "이름", "전공", "학번"],   // labels for the fill-in table (beige label cells)

  "scoreTable": {                  // 배점표; may be null
    "headers": ["파트", "파트명", "유형", "문항 범위", "문항 수", "배점", "총점"],
    "rows": [
      ["P1", "어휘 & 문법", "객관식", "1~9", "9", "3점", "27점"]
    ],
    "summary": ["합계", "", "", "", "33", "", "100점"]   // beige summary row; may be null
  },

  "partSummary": [                 // 2-col cover box; may be empty
    {"code": "P1", "name": "어휘 & 문법", "meta": "객관식 · 27점"}
  ],

  "parts": [
    {
      "code": "P1", "name": "어휘 & 문법", "meta": "유형 객관식 · 27점",
      "blocks": [
        {"type": "passage", "title": "...", "tag": "...",
         "paragraphs": ["...", "..."]},
        {"type": "item", "number": 1, "label": "어휘 — 정의", "points": 3,
         "killer": false, "prompt": "...",
         "example": "a person who studies the stars",   // shown in the beige accent-bar quote box
         "choices": ["farmer", "astronomer", "sailor", "painter"]}  // A/B/C/D auto-lettered
      ]
    }
  ],

  "answerKey": [                   // may be empty
    {"part": "P1  어휘 & 문법",
     "answers": [{"n": 1, "a": "B", "killer": false}]}
  ],

  "explanations": [                // may be empty
    {"part": "P1  어휘 & 문법",
     "cards": [{"number": 1, "answer": "B",
                "explanation": "...", "key": "...", "wrong": "..."}]}
  ]
}
```

Notes:
- Block `type` is either `"passage"` or `"item"`. Unknown types are skipped.
- For `item`, `killer: true` appends ` ★Killer` to the topic label.
- Choice letters (A/B/C/D…) are derived automatically from the order of `choices`.
- A worked example model lives at [`scripts/exam_fixture.json`](./exam_fixture.json)
  (4 parts, a reading passage, a 배점표 with a summary row, a part summary, a full
  answer key, and explanation cards). It deliberately sets `brand=""` and
  `motto=""` to demonstrate that neutral branding still looks complete.

---

## Visual design

- **A4** page via `@page { size: A4; margin: 18mm 16mm 20mm 16mm }`.
- **Palette (exact):** navy `#192744`, brass/gold `#A8894E`, page background
  `#FBF8F1` (warm cream), panel/box fill `#F3ECDC` (beige), content `#FFFFFF`,
  body ink `#22252B`, secondary/footer gray `#9A9486`.
- **Components:** centered cover hierarchy; per-question header (navy numbered
  square + label + `[N점]` tag); beige example/quote box with a left navy accent
  bar; 2-column choice grid; full-width navy part dividers; bordered reading
  passage panels; a grouped answer-key grid with ★ killer marks; and an
  explanation section with navy section header, brass-accented part subheaders,
  and bordered cards each carrying a navy **핵심** and **오답 체크** pill.
- **Running footer on every page:** hairline + left (brand or title) and right
  `난이도 X · n / total` using `@page` margin boxes with CSS `counter(page)` /
  `counter(pages)` and `string-set`.

### Branding is neutral by design

There is **no hardcoded personal brand or motto** anywhere in the renderer.
`brand` and `motto` are optional inputs that default to empty and are rendered
only when non-empty; the cover stays balanced when they are omitted.

---

## Fonts (bundled, no CDN)

All faces are loaded via `@font-face` using **absolute `file://` URLs** to
`/<repo>/fonts/` — there is no external/CDN dependency at render time.

| CSS family   | Files                                                | Role |
|--------------|------------------------------------------------------|------|
| `ExamSerif`  | `NotoSerifKR-Regular.ttf`, `NotoSerifKR-Bold.ttf`    | brand/title line, exam title, section & part headers, passage titles, part-divider bars, explanation section header (with generous letter-spacing/tracking) |
| `ExamSans`   | `NotoSansKR-Regular.ttf`, `NotoSansKR-Bold.ttf`      | body, prompts, choices, explanations, tables |
| `ExamSym`    | `DejaVuSans.ttf`                                      | symbol **fallback** so `✦` (U+2726) renders |

Font stacks: `--serif-stack: 'ExamSerif','ExamSym',serif` and
`--sans-stack: 'ExamSans','ExamSym',sans-serif`.

**Symbol coverage:** ★ (U+2605) is present in the Noto KR subsets and renders
from them. ✦ (U+2726) is **not** in Noto KR — it is served by the bundled
**DejaVu Sans** fallback. Verified: all faces (including `ExamSym`) are embedded
and subset in the output PDF, so both glyphs render rather than showing tofu.

---

## Text-fit / QA loop

The renderer uses CSS paged media for clean pagination:

- `break-inside: avoid` so a question + its choices, a passage panel, a table
  row, and an explanation card never split across pages.
- `thead { display: table-header-group }` so a table spanning pages repeats its header.
- Tables use `table-layout: fixed; width: 100%` with `word-break: keep-all`
  (Korean) + `overflow-wrap: anywhere` so columns never exceed the page width.
- Generous `line-height` for Korean.

On top of that, `exam_pdf.py` runs an **automated review-and-revise loop**:

1. Render the HTML to a WeasyPrint `Document`.
2. **Inspect** the page/box tree (`document.pages -> page._page_box` descendants)
   for **horizontal overflow** — any box whose border-box edge falls outside the
   page content area `[margin_left, margin_left + content_width]`. (WeasyPrint
   never overflows vertically — it paginates — so inspection focuses on
   horizontal overflow + unbreakable boxes, and reports the page count.)
3. If overflow is found, **repair**: reduce the `--content-scale` CSS variable
   (scales all font sizes, down to a `0.85` floor) and/or enable
   `word-break: break-word` (hard wrap), then **re-render**.
4. Repeat up to **3 passes**. If still failing, apply the safest fallback (min
   scale + hard wrap) and set `fellBack: true`.

Each pass records what it checked and what it fixed; the full list is included in
the stdout QA log under `passes`.

---

## Production / deployment note (IMPORTANT)

This feature requires a **Python 3 runtime with WeasyPrint installed** (plus
WeasyPrint's native deps — Pango/Cairo/HarfBuzz/GDK-Pixbuf via libffi etc.).

> ⚠️ The current Render service for this project uses the **Node runtime**
> (see `render.yaml` / `.node-version` / `Procfile`). The Node environment does
> **not** include Python or WeasyPrint. To ship this PDF feature in production
> you must **provision Python + WeasyPrint** in the deploy environment — e.g. a
> separate Python service/worker, a Docker image that installs both runtimes and
> the WeasyPrint system libraries, or a build step that makes `python3` +
> `weasyprint` available to the process that shells out to this script.

Locally / in CI, confirm availability with:

```bash
python3 --version
python3 -c "import weasyprint; print(weasyprint.__version__)"
```

---

## Quick verification

```bash
python3 scripts/exam_pdf.py --in scripts/exam_fixture.json --out /tmp/exam.pdf
# -> {"ok":true,"pages":9,"passes":[...],"fellBack":false}

pdfinfo /tmp/exam.pdf      # Pages: 9 ; Page size: 595.276 x 841.89 pts (A4)
pdffonts /tmp/exam.pdf     # all ExamSerif/ExamSans/ExamSym faces: emb=yes sub=yes
pdftotext /tmp/exam.pdf -  # Hangul + ★ appear in the text layer
```
