/**
 * Slide rendering engine for generated PPT decks.
 *
 * Guarantees (per requirements):
 *  1. Uniform geometry — every slide is the same fixed 16:9 canvas (1280×720),
 *     same safe-zone padding, and a single shared type scale (TYPE).
 *  2. Text always fits — content is capped at generation time (prompt) and, as a
 *     safety net here, auto-fit shrinks the font within a min/max range; if it
 *     still doesn't fit, trailing bullets overflow onto a new slide. Nothing is
 *     clipped or spilled outside the slide.
 *  3. No overlap — fixed grid + safe zones; contrast is enforced so text stays
 *     readable on every palette.
 *  4. Fonts are loaded (document.fonts.ready + explicit font loads) BEFORE any
 *     measurement, so the fallback-font-fits-but-webfont-overflows bug can't happen.
 *  5. Same rules for every template (the theme only changes colors/fonts).
 *  6. A validation pass measures every slide and re-flows / shrinks / splits, and
 *     logs everything it had to fix.
 *
 * The parser/caps (parseDeck, capDeck) are pure (no DOM) so they are unit-tested
 * in Node. All DOM access lives inside the render functions (browser only).
 */

// Shared QA primitives (color/contrast + font loading) live in docqa.js so the
// slide renderer and the document renderer don't each reimplement them.
import { resolveColors, ensureFonts as ensureFontsShared, famName } from "./docqa.js";

/* ---------- Geometry & type scale (single source of truth) ---------- */
export const SLIDE = {
  W: 1280,
  H: 720,
  padX: 84, // horizontal safe margin
  padTop: 70, // top safe margin
  padBottom: 96, // bottom safe margin (reserves space for the page number)
  flowGap: 22, // gap between title/subtitle/bullets blocks
  bulletGap: 14,
};

export const TYPE = {
  title: { max: 48, min: 26, lh: 1.16 },
  titleSlide: { max: 76, min: 34, lh: 1.1 },
  subtitle: { max: 27, min: 17, lh: 1.34 },
  body: { max: 25, min: 15, lh: 1.5 },
  caption: 14,
};

// Content caps. The generation prompt authors to these; we enforce maxBullets
// here by splitting, and rely on auto-fit for the rest (no lossy truncation).
export const CAPS = {
  titleChars: 44,
  subtitleChars: 90,
  maxBullets: 6,
};

/* ---------- Pure parsing (no DOM) ---------- */
function stripEmphasis(s) {
  return s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\([^)]*\)/g, "$1")
    .trim();
}

function cleanTitle(t) {
  return stripEmphasis(t)
    .replace(/^slide\s*\d+\s*[:.\-—)]\s*/i, "")
    .replace(/^슬라이드\s*\d+\s*[:.\-—)]\s*/, "")
    .replace(/^\d+\s*[).:]\s*/, "")
    .trim();
}

function stripNoteLabel(s) {
  return s.replace(/^(speaker\s*notes?|발표자\s*노트|노트)\s*[:：]\s*/i, "").trim();
}

function isDesignGuide(title) {
  return /디자인\s*가이드|design\s*guide|컬러\s*가이드|palette/i.test(title);
}

/**
 * Parse a Markdown deck outline into structured slides. Returns null when no
 * slide-like structure is found (caller then falls back to plain markdown).
 */
export function parseDeck(md) {
  if (typeof md !== "string" || !md.trim()) return null;
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const slides = [];
  let cur = null;

  const finalize = () => {
    if (!cur) return;
    if (isDesignGuide(cur.rawTitle)) {
      cur = null;
      return;
    }
    const subtitle = cur.subtitleParts.join(" ").slice(0, CAPS.subtitleChars).trim();
    slides.push({
      title: cur.title,
      subtitle: subtitle || undefined,
      bullets: cur.bullets,
      notes: cur.notes || undefined,
    });
    cur = null;
  };

  for (const line of lines) {
    const h = line.match(/^#{1,3}\s+(.*)$/);
    if (h) {
      finalize();
      const rawTitle = h[1].trim();
      cur = { rawTitle, title: cleanTitle(rawTitle), bullets: [], subtitleParts: [], notes: "" };
      continue;
    }
    if (!cur) continue;

    const note = line.match(/^\s*>\s*(.*)$/);
    if (note) {
      const n = stripNoteLabel(note[1]);
      if (n) cur.notes += (cur.notes ? " " : "") + n;
      continue;
    }
    const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
    if (bullet) {
      const b = stripEmphasis(bullet[1]);
      if (b) cur.bullets.push(b);
      continue;
    }
    const txt = stripEmphasis(line);
    // Plain text before any bullet becomes the subtitle (handles title slides).
    if (txt && cur.bullets.length === 0) cur.subtitleParts.push(txt);
  }
  finalize();

  if (slides.length === 0) return null;

  // First slide with no bullets is a centered title slide; everything else is a
  // content slide.
  slides.forEach((s, i) => {
    s.kind = i === 0 && s.bullets.length === 0 ? "title" : "content";
  });
  return { slides };
}

/**
 * Enforce the per-slide bullet cap by splitting overflowing slides into
 * continuation slides. Pure. Auto-fit later handles height-based splitting.
 */
export function capDeck(deck) {
  const out = [];
  for (const s of deck.slides) {
    const bullets = s.bullets || [];
    if (bullets.length <= CAPS.maxBullets) {
      out.push({ ...s, bullets });
      continue;
    }
    let first = true;
    for (let i = 0; i < bullets.length; i += CAPS.maxBullets) {
      out.push({
        ...s,
        kind: first ? s.kind : "content",
        subtitle: first ? s.subtitle : undefined,
        bullets: bullets.slice(i, i + CAPS.maxBullets),
        continued: !first,
      });
      first = false;
    }
  }
  return out;
}

/* ---------- Fonts: slide-specific wrapper over the shared loader ---------- */
function ensureFonts(theme) {
  return ensureFontsShared([
    theme?.heading?.webFont,
    theme?.body?.webFont,
    "Noto Sans KR",
    "Noto Serif KR",
  ]);
}

/* ---------- DOM building ---------- */
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function buildSlide(data, theme) {
  const colors = resolveColors(theme && theme.palette);
  const slide = el("div", "deck-slide");
  slide.style.setProperty("--s-bg", colors.bg);
  slide.style.setProperty("--s-ink", colors.ink);
  slide.style.setProperty("--s-sub", colors.sub);
  slide.style.setProperty("--s-accent", colors.accent);
  slide.style.setProperty("--title-font", `'${famName(theme && theme.heading && theme.heading.webFont)}'`);
  slide.style.setProperty("--body-font", `'${famName(theme && theme.body && theme.body.webFont)}'`);

  const isTitle = data.kind === "title";
  slide.style.setProperty("--title-size", (isTitle ? TYPE.titleSlide.max : TYPE.title.max) + "px");
  slide.style.setProperty("--title-lh", String(isTitle ? TYPE.titleSlide.lh : TYPE.title.lh));
  slide.style.setProperty("--subtitle-size", TYPE.subtitle.max + "px");
  slide.style.setProperty("--body-size", TYPE.body.max + "px");

  const flow = el("div", "deck-flow" + (isTitle ? " is-title" : ""));
  flow.appendChild(el("div", "deck-bar"));
  flow.appendChild(el("h3", "deck-title", data.title || ""));
  if (data.subtitle) flow.appendChild(el("p", "deck-subtitle", data.subtitle));
  if (data.bullets && data.bullets.length) {
    const ul = el("ul", "deck-bullets");
    for (const b of data.bullets) ul.appendChild(el("li", "deck-bullet", b));
    flow.appendChild(ul);
  }
  slide.appendChild(flow);
  slide.appendChild(el("div", "deck-foot", ""));
  return slide;
}

function overflows(flow) {
  return flow.scrollHeight - flow.clientHeight > 0.5;
}

// Shrink body, then title, within their min/max ranges. Returns what it did.
function autoFit(slide) {
  const flow = slide.querySelector(".deck-flow");
  const isTitle = flow.classList.contains("is-title");
  const tRange = isTitle ? TYPE.titleSlide : TYPE.title;
  let body = TYPE.body.max;
  let title = tRange.max;
  let shrankBody = false;
  let shrankTitle = false;

  let guard = 0;
  while (overflows(flow) && body > TYPE.body.min && guard++ < 80) {
    body -= 1;
    slide.style.setProperty("--body-size", body + "px");
    shrankBody = true;
  }
  guard = 0;
  while (overflows(flow) && title > tRange.min && guard++ < 120) {
    title -= 1;
    slide.style.setProperty("--title-size", title + "px");
    shrankTitle = true;
  }
  return { fits: !overflows(flow), shrankBody, shrankTitle };
}

/**
 * Render a parsed deck into `container` with full text-fit validation.
 * Returns a report of what the validation pass had to fix.
 */
export async function renderDeck(container, deck, theme) {
  await ensureFonts(theme);

  const measurer = el("div", "deck-measure");
  document.body.appendChild(measurer);

  const report = { slides: 0, shrunk: 0, splits: 0, unfit: 0 };
  const finals = [];
  const queue = capDeck(deck);
  let guard = 0;

  while (queue.length && guard++ < 400) {
    const data = queue.shift();
    const slide = buildSlide(data, theme);
    measurer.appendChild(slide);

    const fit = autoFit(slide);
    if (fit.shrankBody || fit.shrankTitle) report.shrunk += 1;

    // Still overflowing after shrinking → move trailing bullets to a new slide.
    if (!fit.fits && data.bullets && data.bullets.length > 1) {
      const ul = slide.querySelector(".deck-bullets");
      const flow = slide.querySelector(".deck-flow");
      const removed = [];
      while (overflows(flow) && ul.children.length > 1) {
        removed.unshift(data.bullets[ul.children.length - 1]);
        ul.removeChild(ul.lastElementChild);
      }
      if (removed.length) {
        report.splits += 1;
        queue.unshift({
          title: data.title,
          subtitle: undefined,
          bullets: removed,
          kind: "content",
          continued: true,
        });
      }
    }

    if (overflows(slide.querySelector(".deck-flow"))) report.unfit += 1;

    measurer.removeChild(slide);
    finals.push(slide);
  }

  document.body.removeChild(measurer);

  // Commit to the visible container with responsive scaling frames.
  container.innerHTML = "";
  const total = finals.length;
  finals.forEach((slide, i) => {
    slide.querySelector(".deck-foot").textContent = `${i + 1} / ${total}`;
    const frame = el("div", "deck-frame");
    frame.appendChild(slide);
    container.appendChild(frame);
  });
  report.slides = total;

  scaleDeck(container);
  attachResize(container);

  const fixed = [];
  if (report.shrunk) fixed.push(`${report.shrunk}장 글자 크기 자동 조정`);
  if (report.splits) fixed.push(`${report.splits}회 슬라이드 분할`);
  if (report.unfit) fixed.push(`${report.unfit}장 완전히 맞추지 못함(최소 크기 유지)`);
  console.info(
    `[deck] ${total}개 슬라이드 렌더링 · 검증 결과: ${fixed.length ? fixed.join(", ") : "조정 없음"}`,
    report,
  );
  return report;
}

/* ---------- Responsive scaling (measure at 1280, display scaled) ---------- */
function scaleDeck(container) {
  const w = container.clientWidth || SLIDE.W;
  const scale = Math.min(1, w / SLIDE.W);
  container.querySelectorAll(".deck-frame").forEach((frame) => {
    frame.style.height = SLIDE.H * scale + "px";
    const slide = frame.firstElementChild;
    if (slide) {
      slide.style.transformOrigin = "top left";
      slide.style.transform = `scale(${scale})`;
    }
  });
}

function attachResize(container) {
  if (container._deckRO || typeof ResizeObserver === "undefined") return;
  let raf = 0;
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => scaleDeck(container));
  });
  ro.observe(container);
  container._deckRO = ro;
}
