/**
 * pptx.js — export a real, editable .pptx (PptxGenJS) in the chosen design.
 *
 * Runs entirely client-side (no server document runtime, no Python). PptxGenJS
 * is lazy-loaded only when the user exports, so it doesn't weigh down page load.
 *
 * A "deck model" (array of slides, each with a `layout` archetype + content) is
 * mapped to PptxGenJS builders that mirror the showcase preview archetypes:
 * cover · bullets · twocol · section · stat · quote. The same builders serve the
 * fixed sample deck (works now, no API key) and, later, AI-generated content —
 * only the deck model's source changes, never this export.
 */
import { resolveColors, bestText, blend } from "./docqa.js";

const KO_FALLBACK = "Noto Sans KR"; // Korean-capable; PowerPoint substitutes gracefully

// LAYOUT_WIDE (16:9) is 13.333 × 7.5 inches.
const W = 13.333;
const H = 7.5;
const M = 0.7; // safe margin

let pptxLoading = null;
function ensurePptx() {
  if (window.PptxGenJS) return Promise.resolve();
  if (pptxLoading) return pptxLoading;
  pptxLoading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "/vendor/pptxgen.bundle.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("PptxGenJS 로드 실패"));
    document.head.appendChild(s);
  });
  return pptxLoading;
}

const hx = (c) => String(c || "#000000").replace("#", "").toUpperCase();

function themeTokens(theme) {
  const c = resolveColors((theme && theme.palette) || {});
  return {
    bg: hx(c.bg),
    ink: hx(c.ink),
    sub: hx(c.sub),
    accent: hx(c.accent),
    panel: hx(blend(c.bg, c.ink, 0.07)),
    onAccent: hx(bestText(c.accent)),
    grayBar: hx(blend(c.bg, c.ink, 0.22)),
  };
}
function themeFonts(theme) {
  return {
    head: (theme && theme.heading && theme.heading.webFont) || KO_FALLBACK,
    body: (theme && theme.body && theme.body.webFont) || KO_FALLBACK,
  };
}

/* ---------- archetype builders (each = one slide) ---------- */
function buildCover(slide, s, t, f) {
  slide.background = { color: t.bg };
  if (s.eyebrow) {
    slide.addText(String(s.eyebrow).toUpperCase(), {
      x: M, y: 2.2, w: W - 2 * M, h: 0.5, fontFace: f.body, fontSize: 14, bold: true,
      color: t.accent, charSpacing: 3, align: "left", valign: "bottom",
    });
  }
  slide.addShape("rect", { x: M, y: 2.85, w: 1.3, h: 0.14, fill: { color: t.accent } });
  slide.addText(s.title || "", {
    x: M, y: 3.1, w: W - 2 * M, h: 2.0, fontFace: f.head, fontSize: 46, bold: true,
    color: t.ink, align: "left", valign: "top", fit: "shrink",
  });
  if (s.subtitle) {
    slide.addText(s.subtitle, {
      x: M, y: 5.1, w: W - 2 * M, h: 0.8, fontFace: f.body, fontSize: 22, color: t.sub, align: "left", valign: "top", fit: "shrink",
    });
  }
}

function heading(slide, title, t, f) {
  slide.addShape("rect", { x: M, y: 0.82, w: 0.14, h: 0.62, fill: { color: t.accent } });
  slide.addText(title || "", {
    x: M + 0.32, y: 0.7, w: W - 2 * M - 0.32, h: 0.95, fontFace: f.head, fontSize: 30, bold: true,
    color: t.ink, align: "left", valign: "middle", fit: "shrink",
  });
}

function buildBullets(slide, s, t, f) {
  slide.background = { color: t.bg };
  heading(slide, s.title, t, f);
  const items = (s.bullets || []).map((b) => ({
    text: b,
    options: { bullet: { indent: 18 }, color: t.ink, breakLine: true },
  }));
  slide.addText(items.length ? items : [{ text: "" }], {
    x: M, y: 2.1, w: W - 2 * M, h: 4.6, fontFace: f.body, fontSize: 20, color: t.ink,
    align: "left", valign: "top", lineSpacingMultiple: 1.3, paraSpaceAfter: 10, fit: "shrink",
  });
}

function colBlock(slide, x, w, data, t, f, accent) {
  slide.addShape("roundRect", { x, y: 2.05, w, h: 4.3, rectRadius: 0.12, fill: { color: accent ? t.accent : t.panel } });
  const fg = accent ? t.onAccent : t.ink;
  const body = [{ text: data.h || "", options: { bold: true, fontSize: 18, color: fg, breakLine: true, paraSpaceAfter: 10 } }];
  for (const it of data.items || []) body.push({ text: it, options: { fontSize: 15, color: fg, breakLine: true, paraSpaceAfter: 8 } });
  slide.addText(body, { x: x + 0.32, y: 2.35, w: w - 0.64, h: 3.7, fontFace: f.body, align: "left", valign: "top", fit: "shrink" });
}
function buildTwocol(slide, s, t, f) {
  slide.background = { color: t.bg };
  heading(slide, s.title, t, f);
  const gap = 0.4;
  const colW = (W - 2 * M - gap) / 2;
  colBlock(slide, M, colW, s.left || {}, t, f, false);
  colBlock(slide, M + colW + gap, colW, s.right || {}, t, f, true);
}

function buildSection(slide, s, t, f) {
  slide.background = { color: t.accent };
  slide.addText(String(s.no || ""), {
    x: M, y: 1.7, w: 6, h: 2.7, fontFace: f.head, fontSize: 130, bold: true, color: t.onAccent, align: "left", valign: "middle",
  });
  slide.addText(s.name || "", {
    x: M, y: 4.6, w: W - 2 * M, h: 1.2, fontFace: f.head, fontSize: 40, bold: true, color: t.onAccent, align: "left", valign: "top", fit: "shrink",
  });
}

function buildStat(slide, s, t, f) {
  slide.background = { color: t.bg };
  slide.addText(String(s.num || ""), {
    x: M, y: 2.2, w: 6.4, h: 2.4, fontFace: f.head, fontSize: 96, bold: true, color: t.accent, align: "left", valign: "middle", fit: "shrink",
  });
  slide.addText(s.label || "", {
    x: M, y: 4.7, w: 6.4, h: 1.4, fontFace: f.body, fontSize: 20, color: t.sub, align: "left", valign: "top", fit: "shrink",
  });
  // Simple bar "chart" from shapes (editable; mirrors the preview, last bar accent).
  const bars = (s.bars || []).slice(0, 6);
  const areaX = 8.0, areaW = W - M - 8.0, baseY = 6.2, maxH = 3.8;
  const gap = 0.3;
  const bw = bars.length ? (areaW - gap * (bars.length - 1)) / bars.length : 0;
  bars.forEach((v, i) => {
    const bh = Math.max(0.15, (Math.max(0, Math.min(100, v)) / 100) * maxH);
    slide.addShape("rect", {
      x: areaX + i * (bw + gap), y: baseY - bh, w: bw, h: bh,
      fill: { color: i === bars.length - 1 ? t.accent : t.grayBar }, rectRadius: 0.04,
    });
  });
}

function buildQuote(slide, s, t, f) {
  slide.background = { color: t.panel };
  slide.addText("“", { x: M, y: 1.2, w: 3, h: 2, fontFace: f.head, fontSize: 120, bold: true, color: t.accent, align: "left", valign: "top" });
  slide.addText(s.quote || "", {
    x: M, y: 3.0, w: W - 2 * M, h: 2.4, fontFace: f.head, fontSize: 34, bold: true, color: t.ink, align: "left", valign: "top", fit: "shrink",
  });
  if (s.by) {
    slide.addText(s.by, { x: M, y: 5.5, w: W - 2 * M, h: 0.7, fontFace: f.body, fontSize: 20, color: t.sub, align: "left", valign: "top", fit: "shrink" });
  }
}

const BUILDERS = {
  cover: buildCover,
  bullets: buildBullets,
  twocol: buildTwocol,
  section: buildSection,
  stat: buildStat,
  quote: buildQuote,
};

function sanitizeName(s) {
  return (String(s || "").replace(/[^\w가-힣 .-]/g, "").trim().slice(0, 60) || "발표");
}

/**
 * Build + download an editable .pptx from a deck model in the given design.
 * deckModel = { title, slides: [{ layout, ...fields }] }
 */
export async function exportPptx(deckModel, theme, filename) {
  await ensurePptx();
  const pptx = new window.PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "올인원 AI";
  pptx.title = deckModel.title || "발표";

  const t = themeTokens(theme);
  const f = themeFonts(theme);
  const slides = (deckModel && deckModel.slides) || [];
  for (const s of slides) {
    const build = BUILDERS[s.layout] || buildBullets;
    const slide = pptx.addSlide();
    build(slide, s, t, f);
    if (s.notes) slide.addNotes(String(s.notes)); // 발표자 노트 보존
  }
  const name = sanitizeName(filename || deckModel.title);
  await pptx.writeFile({ fileName: `${name}.pptx` });
}
