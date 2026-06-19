# Bundled fonts for the WeasyPrint PDF pipeline

These fonts are bundled locally so the PDF rendering pipeline has **no runtime
CDN / network dependency** for Korean (Hangul) + Latin text and a few symbols.
They are loaded directly via `@font-face` from this directory.

## Files

| File                      | Family         | Style / Weight | Source |
|---------------------------|----------------|----------------|--------|
| `NotoSansKR-Regular.ttf`  | Noto Sans KR   | Regular (400)  | Google Fonts, subset static instance |
| `NotoSansKR-Bold.ttf`     | Noto Sans KR   | Bold (700)     | Google Fonts, subset static instance |
| `NotoSerifKR-Regular.ttf` | Noto Serif KR  | Regular (400)  | Google Fonts, subset static instance |
| `NotoSerifKR-Bold.ttf`    | Noto Serif KR  | Bold (700)     | Google Fonts, subset static instance |
| `DejaVuSans.ttf`          | DejaVu Sans    | Regular        | System DejaVu (symbol fallback) |

## How the Noto fonts were produced

Each Noto family is shipped upstream as a single **variable font**
(`NotoSansKR[wght].ttf`, `NotoSerifKR[wght].ttf`) from the Google Fonts repo:

- Noto Sans KR: https://github.com/google/fonts/raw/main/ofl/notosanskr/NotoSansKR%5Bwght%5D.ttf
- Noto Serif KR: https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifkr/NotoSerifKR%5Bwght%5D.ttf

For each family we used `fontTools`:

1. **Instance** the variable font at two fixed weights with
   `instantiateVariableFont(font, {'wght': 400 or 700}, updateFontNames=True)`,
   producing static Regular and Bold faces. The OS/2 `usWeightClass`,
   `fsSelection` (REGULAR/BOLD bits), `head.macStyle` bold bit, and the `name`
   table (subfamily "Regular"/"Bold") are all set so each face is correctly
   recognized as Regular or Bold by the renderer.
2. **Subset** with `pyftsubset` keeping only the unicode ranges below, using:
   `--layout-features='*' --glyph-names --no-hinting --desubroutinize`.

## Unicode ranges kept

| Range            | Block |
|------------------|-------|
| U+0020 – U+007E  | Basic Latin |
| U+00A0 – U+00FF  | Latin-1 Supplement (includes · U+00B7) |
| U+2000 – U+206F  | General Punctuation |
| U+1100 – U+11FF  | Hangul Jamo |
| U+3000 – U+303F  | CJK Symbols and Punctuation |
| U+3130 – U+318F  | Hangul Compatibility Jamo |
| U+AC00 – U+D7A3  | Hangul Syllables (full ~11k block) |
| U+FF00 – U+FFEF  | Halfwidth and Fullwidth Forms |
| individual       | ASCII digits 0-9, ★ U+2605, ✦ U+2726, ■ U+25A0, · U+00B7 |

Note: ★ (U+2605) is present in the Noto KR fonts. ✦ (U+2726) is **not** present
in either Noto Sans KR or Noto Serif KR upstream, so it is served by the
**DejaVu Sans fallback**, which is the reason DejaVu Sans is bundled here for
star/diamond symbol fallback.

## Licenses

- **Noto Sans KR** and **Noto Serif KR** — Copyright the Noto Project Authors.
  Licensed under the **SIL Open Font License, Version 1.1**
  (https://scripts.sil.org/OFL). Subsetting and weight-instancing a font is
  permitted under the OFL.
- **DejaVu Sans** — distributed under the **DejaVu Fonts License** (a permissive
  Bitstream Vera / public-domain-derived license). See
  https://dejavu-fonts.github.io/License.html.
