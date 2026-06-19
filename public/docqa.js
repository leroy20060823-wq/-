/**
 * docqa.js — shared layout + QA engine for ALL generated documents.
 *
 * One reusable module (used by every document module and, for its shared
 * primitives, by the PPT slide renderer) that guarantees:
 *  - Consistent geometry: a fixed page size (A4/Letter) with uniform margins and
 *    a single typography scale (heading/subheading/body/caption) defined once.
 *  - Text that never clips/overflows/overlaps: measurement-based pagination flows
 *    content onto the next page instead of cramming; Korean/CJK-aware wrapping;
 *    generous line-height/padding.
 *  - Clean pagination: never splits a keep-together unit (list item, table row,
 *    question + choices); repeats table header rows across pages.
 *  - Fonts loaded before measuring (document.fonts.ready) so metrics are correct.
 *  - An automated review-and-revise loop: render → inspect → repair → re-inspect
 *    up to 3 passes (re-flow, resize within a min/max range, fix tables); if it
 *    still can't pass, fall back to the safest layout. Everything is logged.
 *
 * Geometry, the type scale, the QA contract, and the color/contrast + font
 * helpers are shared so no module reimplements them.
 */

/* ---------- Geometry registry (CSS px @96dpi) ---------- */
export const PAGE = {
  // A4 = 210×297mm, Letter = 8.5×11in. footer reserves space for the running foot.
  a4: { w: 794, h: 1123, margin: 64, footer: 30 },
  letter: { w: 816, h: 1056, margin: 64, footer: 30 },
};

/* ---------- Typography scale (single source of truth) ---------- */
export const TYPE_SCALE = {
  title: { size: 26, lh: 1.25, weight: 800 },
  heading: { size: 20, lh: 1.3, weight: 700 },
  subheading: { size: 16.5, lh: 1.35, weight: 700 },
  body: { size: 15, lh: 1.65, weight: 400 },
  caption: { size: 12, lh: 1.45, weight: 400 },
};

/* ---------- QA contract ---------- */
export const QA = {
  maxPasses: 3,
  minScale: 0.82, // never shrink below this (keeps body text readable)
  scaleStep: 0.06,
};

/* ---------- Color / contrast (shared with slides.js) ---------- */
export function rgb(hex) {
  const h = String(hex || "").replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6).padEnd(6, "0");
  return [parseInt(n.slice(0, 2), 16) || 0, parseInt(n.slice(2, 4), 16) || 0, parseInt(n.slice(4, 6), 16) || 0];
}
export function toHex(r, g, b) {
  const t = (x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0");
  return "#" + t(r) + t(g) + t(b);
}
function lin(c) {
  const x = c / 255;
  return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}
export function relLum(hex) {
  const [r, g, b] = rgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
export function contrast(a, b) {
  const la = relLum(a);
  const lb = relLum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
export function blend(a, b, t) {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return toHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}
export function bestText(bg) {
  return contrast(bg, "#14110c") >= contrast(bg, "#ffffff") ? "#14110c" : "#ffffff";
}
export function resolveColors(pal) {
  const p = pal || {};
  const bg = p.bg || "#ffffff";
  let ink = p.ink || bestText(bg);
  let sub = p.sub || ink;
  let accent = p.accent || "#2f6db5";
  if (contrast(bg, ink) < 4.5) ink = bestText(bg);
  if (contrast(bg, sub) < 3) {
    sub = blend(ink, bg, 0.32);
    if (contrast(bg, sub) < 3) sub = ink;
  }
  if (contrast(bg, accent) < 1.9) accent = blend(ink, bg, 0.1);
  return { bg, ink, sub, accent };
}

/* ---------- Fonts: load before measuring (shared with slides.js) ---------- */
const injectedFonts = new Set();
export function famName(name) {
  return (name || "Noto Sans KR").replace(/'/g, "");
}
export function injectFontLink(name) {
  const f = famName(name);
  if (injectedFonts.has(f)) return;
  injectedFonts.add(f);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${f.replace(/ /g, "+")}:wght@400;500;700;800;900&display=swap`;
  document.head.appendChild(link);
}
export async function ensureFonts(families) {
  const list = (families || ["Noto Sans KR", "Noto Serif KR"])
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i);
  list.forEach(injectFontLink);
  if (!document.fonts) return;
  try {
    await Promise.all(
      list.flatMap((f) => [
        document.fonts.load(`700 32px '${famName(f)}'`),
        document.fonts.load(`400 16px '${famName(f)}'`),
      ]),
    );
  } catch {
    /* best-effort */
  }
  try {
    await document.fonts.ready;
  } catch {
    /* ignore */
  }
}

/* ---------- Generic QA loop runner (shared contract) ---------- */
/**
 * render → inspect → repair → re-inspect, up to QA.maxPasses. `render(state)`
 * produces output, `inspect()` returns an array of issues, `repair(issues,state)`
 * returns a new state (or null when it can't improve). `fallback(state)` applies
 * the safest layout. Returns a structured log of every pass.
 */
export async function qaLoop({ render, inspect, repair, fallback, initialState }) {
  let state = initialState;
  const passes = [];
  for (let pass = 1; pass <= QA.maxPasses; pass++) {
    await render(state);
    const issues = inspect(state);
    passes.push({ pass, state: describeState(state), issues: issues.map((i) => i.type) });
    if (issues.length === 0) return { ok: true, passes };
    const next = repair(issues, state);
    if (!next) break;
    state = next;
  }
  if (fallback) {
    state = fallback(state);
    await render(state);
    const issues = inspect(state);
    passes.push({ pass: "fallback", state: describeState(state), issues: issues.map((i) => i.type) });
    return { ok: issues.length === 0, passes, fellBack: true };
  }
  return { ok: false, passes };
}
function describeState(s) {
  if (!s || typeof s !== "object") return s;
  const out = {};
  for (const k of ["scale", "tableFixed", "hardWrap", "page"]) if (k in s) out[k] = s[k];
  return out;
}

/* ---------- Paged document renderer ---------- */
function makePage(framesEl, geo) {
  const frame = document.createElement("div");
  frame.className = "doc-frame";
  const page = document.createElement("div");
  page.className = "doc-page";
  page.style.width = geo.w + "px";
  page.style.height = geo.h + "px";
  page.style.padding = geo.margin + "px";
  page.style.paddingBottom = geo.margin + geo.footer + "px";
  const content = document.createElement("div");
  content.className = "doc-content";
  content.style.height = geo.h - geo.margin * 2 - geo.footer + "px";
  page.appendChild(content);
  const foot = document.createElement("div");
  foot.className = "doc-foot";
  page.appendChild(foot);
  frame.appendChild(page);
  framesEl.appendChild(frame);
  return { frame, page, content, foot };
}

function overflowV(content) {
  return content.scrollHeight - content.clientHeight > 0.5;
}

// Last-resort character split for a single block taller than a whole page.
function splitTextBlock(clone, content, startNewPage, report) {
  const full = clone.textContent || "";
  if (!full.trim()) return;
  // Binary-search the largest prefix (by characters) that fits.
  let lo = 0;
  let hi = full.length;
  let best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    clone.textContent = full.slice(0, mid);
    if (!overflowV(content)) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (best <= 0) best = Math.max(1, Math.floor(full.length / 4));
  clone.textContent = full.slice(0, best);
  const rest = full.slice(best);
  report.splitParas += 1;
  if (rest.trim()) {
    const np = startNewPage();
    const cont = document.createElement(clone.tagName.toLowerCase());
    cont.className = clone.className;
    np.content.appendChild(cont);
    cont.textContent = rest;
    if (overflowV(np.content)) splitTextBlock(cont, np.content, startNewPage, report);
  }
}

function tableShell(srcTable) {
  const t = document.createElement("table");
  t.className = srcTable.className;
  const thead = srcTable.querySelector("thead");
  if (thead) t.appendChild(thead.cloneNode(true)); // repeat header on every page
  t.appendChild(document.createElement("tbody"));
  return t;
}

/**
 * Flow the children of `sourceEl` into pages inside `framesEl`. Keep-together
 * units (list items, table rows) are never split; tables repeat their header.
 */
function paginate(framesEl, sourceEl, geo) {
  framesEl.innerHTML = "";
  const report = { pages: 0, moved: 0, splitParas: 0, splitTables: 0, splitLists: 0, unfit: 0 };
  let cur = makePage(framesEl, geo);
  const newPage = () => (cur = makePage(framesEl, geo));

  const placeGeneric = (node) => {
    const clone = node.cloneNode(true);
    cur.content.appendChild(clone);
    if (!overflowV(cur.content)) return;
    if (cur.content.children.length > 1) {
      cur.content.removeChild(clone);
      newPage();
      cur.content.appendChild(clone);
      report.moved += 1;
      if (!overflowV(cur.content)) return;
    }
    // Alone on a page and still too tall → split text or accept (clipped-safe) + log.
    if (/^(P|BLOCKQUOTE|PRE|DIV|H1|H2|H3|H4|H5|H6)$/.test(clone.tagName)) {
      splitTextBlock(clone, cur.content, newPage, report);
    } else {
      report.unfit += 1;
    }
  };

  const placeList = (listNode) => {
    const tag = listNode.tagName.toLowerCase();
    let listEl = document.createElement(tag);
    listEl.className = listNode.className;
    if (listNode.hasAttribute("start")) listEl.setAttribute("start", listNode.getAttribute("start"));
    cur.content.appendChild(listEl);
    let index = 0;
    for (const li of [...listNode.children]) {
      const liClone = li.cloneNode(true);
      listEl.appendChild(liClone);
      if (overflowV(cur.content)) {
        if (listEl.children.length > 1) {
          listEl.removeChild(liClone);
          newPage();
          listEl = document.createElement(tag);
          listEl.className = listNode.className;
          // Continue numbering for ordered lists across the page break.
          if (tag === "ol") listEl.setAttribute("start", String(index + 1));
          cur.content.appendChild(listEl);
          listEl.appendChild(liClone);
          report.splitLists += 1;
          if (overflowV(cur.content)) splitTextBlock(liClone, cur.content, newPage, report);
        } else {
          splitTextBlock(liClone, cur.content, newPage, report);
        }
      }
      index += 1;
    }
  };

  const placeTable = (tableNode) => {
    const rows = [...tableNode.querySelectorAll("tbody > tr")];
    const allRows = rows.length ? rows : [...tableNode.querySelectorAll("tr")].filter((r) => r.closest("thead") === null);
    let tbl = tableShell(tableNode);
    cur.content.appendChild(tbl);
    let tb = tbl.querySelector("tbody");
    for (const tr of allRows) {
      const rc = tr.cloneNode(true);
      tb.appendChild(rc);
      if (overflowV(cur.content)) {
        if (tb.children.length > 1) {
          tb.removeChild(rc);
          newPage();
          tbl = tableShell(tableNode); // repeats <thead>
          cur.content.appendChild(tbl);
          tb = tbl.querySelector("tbody");
          tb.appendChild(rc);
          report.splitTables += 1;
        } else {
          report.unfit += 1; // a single row taller than a page (rare)
        }
      }
    }
  };

  for (const node of [...sourceEl.children]) {
    if (!node.tagName) continue;
    const tag = node.tagName;
    if (tag === "TABLE") placeTable(node);
    else if (tag === "UL" || tag === "OL") placeList(node);
    else placeGeneric(node);
  }

  // Avoid an orphaned heading at the very bottom of a page (keep-with-next).
  framesEl.querySelectorAll(".doc-content").forEach((content, i, all) => {
    const last = content.lastElementChild;
    if (last && /^H[1-6]$/.test(last.tagName) && i < all.length - 1) {
      const next = all[i + 1];
      content.removeChild(last);
      next.insertBefore(last, next.firstChild);
    }
  });

  // Drop any empty trailing pages.
  framesEl.querySelectorAll(".doc-frame").forEach((frame) => {
    const c = frame.querySelector(".doc-content");
    if (c && !c.textContent.trim() && c.children.length === 0) frame.remove();
  });

  report.pages = framesEl.querySelectorAll(".doc-frame").length;
  return report;
}

function inspectPages(framesEl) {
  const issues = [];
  framesEl.querySelectorAll(".doc-content").forEach((c, i) => {
    if (c.scrollHeight - c.clientHeight > 1) issues.push({ type: "overflow-v", page: i });
    if (c.scrollWidth - c.clientWidth > 1) issues.push({ type: "overflow-h", page: i });
    c.querySelectorAll("table").forEach((t) => {
      if (t.scrollWidth - c.clientWidth > 1) issues.push({ type: "table-wide", page: i });
    });
  });
  return issues;
}

function applyState(framesEl, container, state) {
  container.style.setProperty("--doc-scale", String(state.scale));
  container.classList.toggle("tbl-fixed", !!state.tableFixed);
  container.classList.toggle("hard-wrap", !!state.hardWrap);
}

function scaleFrames(container, geo) {
  const w = container.clientWidth || geo.w;
  const scale = Math.min(1, w / geo.w);
  container.querySelectorAll(".doc-frame").forEach((frame) => {
    frame.style.height = geo.h * scale + "px";
    const page = frame.firstElementChild;
    if (page) {
      page.style.transformOrigin = "top left";
      page.style.transform = `scale(${scale})`;
    }
  });
}

function attachResize(container, geo) {
  if (container._docRO || typeof ResizeObserver === "undefined") return;
  let raf = 0;
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => scaleFrames(container, geo));
  });
  ro.observe(container);
  container._docRO = ro;
}

/**
 * Render `sourceEl`'s already-parsed HTML into a paged A4/Letter document inside
 * `container`, running the full QA review-and-revise loop. Returns the QA log.
 *
 * opts: { page: "a4"|"letter", fonts: string[], footer: {left, right} }
 */
export async function renderPagedDocument(container, sourceEl, opts = {}) {
  const geo = PAGE[opts.page] || PAGE.a4;
  await ensureFonts(opts.fonts);

  let lastReport = null;
  const result = await qaLoop({
    initialState: { scale: 1, tableFixed: false, hardWrap: false, page: opts.page || "a4" },
    render: async (state) => {
      applyState(container, container, state);
      lastReport = paginate(container, sourceEl, geo);
    },
    inspect: () => inspectPages(container),
    repair: (issues, state) => {
      const next = { ...state };
      if (issues.some((i) => i.type === "table-wide")) next.tableFixed = true;
      if (issues.some((i) => i.type === "overflow-h")) next.hardWrap = true;
      const needSmaller = issues.some((i) => ["overflow-v", "overflow-h", "table-wide"].includes(i.type));
      if (needSmaller && state.scale > QA.minScale) {
        next.scale = Math.max(QA.minScale, +(state.scale - QA.scaleStep).toFixed(3));
      } else if (next.tableFixed === state.tableFixed && next.hardWrap === state.hardWrap) {
        return null; // nothing left to try
      }
      return next;
    },
    fallback: (state) => ({ ...state, scale: QA.minScale, tableFixed: true, hardWrap: true }),
  });

  // Footer + responsive scaling.
  const total = container.querySelectorAll(".doc-frame").length;
  const footer = opts.footer || {};
  container.querySelectorAll(".doc-frame").forEach((frame, i) => {
    const foot = frame.querySelector(".doc-foot");
    if (foot) {
      foot.innerHTML =
        `<span class="doc-foot-l">${escapeText(footer.left || "")}</span>` +
        `<span class="doc-foot-r">${escapeText((footer.right ? footer.right + " · " : "") + `${i + 1} / ${total}`)}</span>`;
    }
  });
  scaleFrames(container, geo);
  attachResize(container, geo);

  const log = { pages: total, ok: result.ok, fellBack: !!result.fellBack, passes: result.passes, layout: lastReport };
  console.info(
    `[docqa] ${total}페이지 · ${result.ok ? "검증 통과" : "최종 안전 레이아웃 적용"} · 패스 ${result.passes.length}회`,
    log,
  );
  return log;
}

function escapeText(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
