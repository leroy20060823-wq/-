import { marked } from "./vendor/marked.esm.js";
import DOMPurify from "./vendor/purify.es.mjs";
import { parseDeck, renderDeck } from "./slides.js";
import { renderPagedDocument } from "./docqa.js";

marked.use({ gfm: true, breaks: false });

/* ---------- Per-module card theme (pastel tile + clay/sage/sky accent) ---------- */
// Lucide icons (MIT) — stroke uses currentColor (set to the module accent).
const ICONS = {
  exam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>',
  ppt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h20"/><path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3"/><path d="m7 21 5-5 5 5"/></svg>',
  vocabulary: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/></svg>',
  "lesson-plan": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>',
  resume: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>',
  "cover-letter": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>',
  worksheet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.4 2.6a2 2 0 0 1 2.8 2.8L12 14.6 8 16l1.4-4z"/></svg>',
  quiz: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>',
  "study-notes": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6h4"/><path d="M2 12h4"/><path d="M2 18h4"/><rect width="16" height="20" x="4" y="2" rx="2"/><path d="M16 2v20"/></svg>',
  "creative-writing": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12.67 19a2 2 0 0 0 1.42-.59l6.15-6.17a6 6 0 0 0-8.49-8.49L5.59 9.91A2 2 0 0 0 5 11.33V18a1 1 0 0 0 1 1z"/><path d="M16 8 2 22"/><path d="M17.5 15H9"/></svg>',
  excel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M12 3v18"/></svg>',
};
const DEFAULT_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9.94 14.06a4 4 0 1 1 5.66-5.66"/><path d="m12 2 1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5z"/></svg>';

// tile = pastel background, accent = icon/clay color, tagline = card copy.
const THEME = {
  exam: { tile: "#FBEDE4", accent: "#C2613A", tagline: "자료 올리면 문제 자동 생성" },
  ppt: { tile: "#FBF1DD", accent: "#C0913C", tagline: "주제만 입력하면 슬라이드로" },
  vocabulary: { tile: "#EAF1F8", accent: "#6F8FB8", tagline: "모르는 단어, 쉽게 풀이" },
  "lesson-plan": { tile: "#E6F0E2", accent: "#5F8B4A", tagline: "수업 흐름 자동 구성" },
  resume: { tile: "#E8F0FA", accent: "#5E86C0", tagline: "경력·역량을 한눈에 정리" },
  "cover-letter": { tile: "#E8F0FA", accent: "#5E86C0", tagline: "경험을 매력적인 이야기로" },
  worksheet: { tile: "#EAF2E1", accent: "#6E9B52", tagline: "특정 단원 집중 연습" },
  quiz: { tile: "#F7E9E5", accent: "#B56A4E", tagline: "빠른 이해 점검" },
  "study-notes": { tile: "#FBF1DD", accent: "#C0913C", tagline: "핵심 개념 요약" },
  "creative-writing": { tile: "#F7E9E5", accent: "#B56A4E", tagline: "장르만 고르면 초고 완성" },
  excel: { tile: "#EAF2E1", accent: "#6E9B52", tagline: "수식·차트 한 번에" },
};
const DEFAULT_THEME = { tile: "#EFEADD", accent: "#C2613A" };

/* ---------- Elements ---------- */
const viewHome = document.getElementById("view-home");
const viewApp = document.getElementById("view-app");
const viewTerms = document.getElementById("view-terms");
const viewPrivacy = document.getElementById("view-privacy");

const heroForm = document.getElementById("hero-form");
const heroInput = document.getElementById("hero-input");

const cardsEl = document.getElementById("module-cards");
const cardsStatus = document.getElementById("cards-status");

const form = document.getElementById("form");
const moduleSelect = document.getElementById("module");
const modulePurpose = document.getElementById("module-purpose");
const moduleDesc = document.getElementById("module-desc");
const moduleOptionsEl = document.getElementById("module-options");
const guideFieldsEl = document.getElementById("guide-fields");
const inputLabel = document.getElementById("input-label");
const inputEl = document.getElementById("input");
const pptDesign = document.getElementById("ppt-design");
const pptRecommendBtn = document.getElementById("ppt-recommend");
const pptAllBtn = document.getElementById("ppt-all");
const pptThemesEl = document.getElementById("ppt-themes");
const pptPreview = document.getElementById("ppt-preview");
const pptDesignStatus = document.getElementById("ppt-design-status");
const submitBtn = document.getElementById("submit");
const demoBtn = document.getElementById("demo");
const demoBanner = document.getElementById("demo-banner");
const stopBtn = document.getElementById("stop");
const statusEl = document.getElementById("status");
const loadingEl = document.getElementById("loading");
const outputEl = document.getElementById("output");
const deckEl = document.getElementById("deck");
const docPagesEl = document.getElementById("docpages");
const viewToggle = document.getElementById("view-toggle");
const viewPreviewBtn = document.getElementById("view-preview");
const viewTextBtn = document.getElementById("view-text");
const errorEl = document.getElementById("error");
const copyBtn = document.getElementById("copy");

// Fallback design theme for the slide renderer when the user hasn't picked one.
const DEFAULT_DECK_THEME = {
  name: "기본",
  palette: { bg: "#FFFFFF", surface: "#EEF3F9", ink: "#16203A", sub: "#5B6B82", accent: "#2F6DB5" },
  heading: { webFont: "Noto Sans KR", weights: [700] },
  body: { webFont: "Noto Sans KR", weights: [400] },
};
const wizardEl = document.getElementById("wizard");
const toWizardBtn = document.getElementById("to-wizard");
const extraField = document.getElementById("extra-field");
const actionsRow = document.getElementById("actions-row");

let modules = [];
let controller = null;
const defaultInputPlaceholder = inputEl.getAttribute("placeholder") ?? "";

// PPT design recommendation state
let themesById = {};
let selectedPptTheme = null;
const fontsLoaded = new Set();

// Beginner wizard state
let classicMode = false;
let wizardSteps = [];
let wizardIdx = 0;
let wizardValues = {};

// Internal guidance level from onboarding ("guided" = more help, "lite" = compact).
// Never shown as a label in the UI. Default to "guided" (more help) until known.
let guidanceLevel = localStorage.getItem("aio_guidance") || "guided";
document.body.dataset.guidance = guidanceLevel;

// Streaming render state.
let raw = "";
let renderScheduled = false;

function escapeHtml(s) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

/* ---------- View routing (hash-based) ---------- */
function applyRoute() {
  const h = location.hash;
  const route = h === "#generate" ? "app" : h === "#terms" ? "terms" : h === "#privacy" ? "privacy" : "home";
  viewHome.hidden = route !== "home";
  viewApp.hidden = route !== "app";
  viewTerms.hidden = route !== "terms";
  viewPrivacy.hidden = route !== "privacy";
  window.scrollTo(0, 0);
  if (route === "app") inputEl.focus();
}
window.addEventListener("hashchange", applyRoute);

/* ---------- Status helpers ---------- */
function setStatus(text) {
  statusEl.textContent = text ?? "";
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
  loadingEl.hidden = true;
  outputEl.hidden = raw.length === 0;
}

function clearError() {
  errorEl.textContent = "";
  errorEl.hidden = true;
}

/* ---------- Rendering ---------- */
function renderNow() {
  outputEl.innerHTML = DOMPurify.sanitize(marked.parse(raw));
  outputEl.scrollTop = outputEl.scrollHeight;
}

function scheduleRender() {
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(() => {
    renderScheduled = false;
    renderNow();
  });
}

function resetOutput() {
  raw = "";
  outputEl.innerHTML = "";
  outputEl.hidden = true;
  deckEl.hidden = true;
  deckEl.innerHTML = "";
  docPagesEl.hidden = true;
  docPagesEl.innerHTML = "";
  previewKind = null;
  viewToggle.hidden = true;
  copyBtn.hidden = true;
}

/* ---------- Preview view (slides for PPT, paged document for the rest) ---------- */
// The active rich preview ("deck" or "doc"); the raw markdown stays available via
// the "텍스트" toggle and copy button.
let previewKind = null;

function activePreviewEl() {
  return previewKind === "deck" ? deckEl : previewKind === "doc" ? docPagesEl : null;
}

function setView(mode) {
  const preview = mode === "preview" && previewKind !== null;
  const el = activePreviewEl();
  deckEl.hidden = !(preview && previewKind === "deck");
  docPagesEl.hidden = !(preview && previewKind === "doc");
  outputEl.hidden = preview;
  if (el) void el; // (no-op; keeps intent explicit)
  viewPreviewBtn.classList.toggle("active", preview);
  viewTextBtn.classList.toggle("active", !preview);
}

// PPT → rendered slides.
async function showDeck(markdown, theme) {
  const deck = parseDeck(markdown);
  if (!deck) {
    viewToggle.hidden = true;
    return;
  }
  viewPreviewBtn.textContent = "슬라이드";
  viewToggle.hidden = false;
  try {
    await renderDeck(deckEl, deck, theme || DEFAULT_DECK_THEME);
    previewKind = "deck";
    setView("preview");
  } catch (err) {
    console.error("[deck] render failed:", err);
    viewToggle.hidden = true;
    previewKind = null;
    setView("text");
  }
}

// Every other module → paginated A4 document with the shared QA loop.
async function showDoc(moduleId) {
  // Reuse the already-parsed, sanitized markdown DOM as the layout source.
  if (!outputEl.firstChild) {
    viewToggle.hidden = true;
    return;
  }
  const titleEl = outputEl.querySelector("h1, h2, h3");
  const docTitle =
    (titleEl && titleEl.textContent.trim()) ||
    (modules.find((m) => m.id === moduleId)?.name ?? "문서");
  viewPreviewBtn.textContent = "문서";
  viewToggle.hidden = false;
  try {
    await renderPagedDocument(docPagesEl, outputEl, {
      page: "a4",
      fonts: ["Noto Sans KR", "Noto Serif KR"],
      footer: { left: docTitle },
    });
    previewKind = "doc";
    setView("preview");
  } catch (err) {
    console.error("[docqa] render failed:", err);
    viewToggle.hidden = true;
    previewKind = null;
    setView("text");
  }
}

// Build the right preview for a finished result.
async function showPreview(moduleId) {
  if (!raw.trim()) return;
  if (moduleId === "ppt") {
    await showDeck(raw, selectedPptTheme || DEFAULT_DECK_THEME);
  } else {
    await showDoc(moduleId);
  }
}

/* ---------- Options ---------- */
function renderOptionControl(opt) {
  const label = `<span class="opt-label">${escapeHtml(opt.label)}</span>`;
  if (opt.type === "select") {
    const options = (opt.choices ?? [])
      .map((c) => {
        const value = escapeHtml(c.value);
        const text = escapeHtml(c.label ?? c.value);
        const selected = opt.default === c.value ? " selected" : "";
        return `<option value="${value}"${selected}>${text}</option>`;
      })
      .join("");
    return `<label class="opt">${label}<select data-opt-key="${escapeHtml(opt.key)}">${options}</select></label>`;
  }
  const type = opt.type === "number" ? "number" : "text";
  const attrs = [
    `type="${type}"`,
    `data-opt-key="${escapeHtml(opt.key)}"`,
    opt.default !== undefined ? `value="${escapeHtml(String(opt.default))}"` : "",
    opt.min !== undefined ? `min="${opt.min}"` : "",
    opt.max !== undefined ? `max="${opt.max}"` : "",
    type === "text" ? `maxlength="1000"` : "",
    opt.placeholder ? `placeholder="${escapeHtml(opt.placeholder)}"` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return `<label class="opt">${label}<input ${attrs} /></label>`;
}

function renderOptions(module) {
  const opts = module?.options ?? [];
  moduleOptionsEl.innerHTML = opts.map(renderOptionControl).join("");
}

function gatherOptions() {
  const values = {};
  moduleOptionsEl.querySelectorAll("[data-opt-key]").forEach((el) => {
    const key = el.dataset.optKey;
    const value = el.value;
    if (value !== "" && value != null) values[key] = value;
  });
  return values;
}

/* ---------- Modules ---------- */
/* ---------- Guided form ---------- */
function renderGuideControl(f) {
  const req = f.required ? ' <span class="req">*</span>' : "";
  const label = `<span class="guide-label">${escapeHtml(f.label)}${req}</span>`;
  const key = escapeHtml(f.key);
  const ph = escapeHtml(f.placeholder ?? "");
  let control;
  if (f.type === "select") {
    const opts = (f.choices ?? [])
      .map((c) => `<option value="${escapeHtml(c.value)}">${escapeHtml(c.label ?? c.value)}</option>`)
      .join("");
    control = `<select data-guide-key="${key}">${opts}</select>`;
  } else if (f.type === "textarea") {
    control = `<textarea data-guide-key="${key}" rows="3" maxlength="3000" placeholder="${ph}"></textarea>`;
  } else {
    const type = f.type === "number" ? "number" : "text";
    const cap = type === "text" ? ' maxlength="3000"' : "";
    control = `<input type="${type}" data-guide-key="${key}"${cap} placeholder="${ph}" />`;
  }
  const help = f.help ? `<span class="guide-help">${escapeHtml(f.help)}</span>` : "";
  const hint = f.hint ? `<span class="hint">${escapeHtml(f.hint)}</span>` : "";
  return `<label class="guide-field">${label}${help}${control}${hint}</label>`;
}

function renderGuide(module) {
  const guide = module?.guide ?? [];
  guideFieldsEl.innerHTML = guide.map(renderGuideControl).join("");
}

function gatherGuide() {
  const values = {};
  guideFieldsEl.querySelectorAll("[data-guide-key]").forEach((el) => {
    values[el.dataset.guideKey] = el.value;
  });
  return values;
}

// Compose the request prompt from guide answers + the optional free-text extra.
function composeInput(module, guideValues, extra) {
  const lines = [];
  for (const f of module?.guide ?? []) {
    const v = (guideValues[f.key] ?? "").trim();
    if (v) lines.push(`${f.label.replace(/\s*\(선택\)\s*$/, "")}: ${v}`);
  }
  let text = lines.join("\n");
  if (extra && extra.trim()) text += (text ? "\n\n" : "") + `추가 요청: ${extra.trim()}`;
  return text;
}

// Returns the key of the first missing required guide field, or null if OK.
function firstMissingRequired(module, guideValues) {
  for (const f of module?.guide ?? []) {
    if (f.required && !(guideValues[f.key] ?? "").trim()) return f;
  }
  return null;
}

/* ---------- PPT design recommendation ---------- */
function cssFamily(name) {
  return name.replace(/'/g, "");
}

function loadFont(font) {
  const key = `${font.webFont}:${font.weights.join(",")}`;
  if (fontsLoaded.has(key)) return;
  fontsLoaded.add(key);
  const fam = font.webFont.replace(/ /g, "+");
  const wght = font.weights.join(";");
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${fam}:wght@${wght}&display=swap`;
  document.head.appendChild(link);
}

function cssMiniSlide(p) {
  loadFont(p.heading);
  loadFont(p.body);
  const pal = p.palette;
  return (
    `<div class="slide-mock" style="background:${pal.bg};color:${pal.ink}">` +
    `<div class="slide-bar" style="background:${pal.accent}"></div>` +
    `<div class="slide-title" style="font-family:'${cssFamily(p.heading.webFont)}',sans-serif">제목을 여기에</div>` +
    `<div class="slide-bullet" style="font-family:'${cssFamily(p.body.webFont)}',sans-serif;color:${pal.sub}">핵심 포인트 하나</div>` +
    `<div class="slide-bullet" style="font-family:'${cssFamily(p.body.webFont)}',sans-serif;color:${pal.sub}">핵심 포인트 둘</div>` +
    `</div>`
  );
}

function themeCard(preset, reason) {
  themesById[preset.id] = preset;
  const tags = (preset.tags || preset.moods || []).slice(0, 3).join(" · ");
  // Font-substitution info is kept in designs.json / logs but NOT shown on screen
  // (no red warning). Re-enable as faint gray helper text only if ever needed.
  // Use the rendered thumbnail when present; otherwise a live CSS mini-slide.
  const top = preset.thumbnail
    ? `<img class="theme-thumb" src="${escapeHtml(preset.thumbnail)}" alt="" loading="lazy">`
    : cssMiniSlide(preset);
  return (
    `<button type="button" class="theme-card" data-theme="${escapeHtml(preset.id)}">${top}` +
    `<div class="theme-meta">` +
    `<div class="theme-name">${escapeHtml(preset.name)}</div>` +
    (reason ? `<div class="theme-reason">${escapeHtml(reason)}</div>` : "") +
    `<div class="theme-fontnote">${escapeHtml(tags)}</div>` +
    `</div></button>`
  );
}

function renderThemeCards(items) {
  pptThemesEl.innerHTML = items.map((it) => themeCard(it.preset, it.reason)).join("");
}

function renderLivePreview(theme) {
  loadFont(theme.heading);
  loadFont(theme.body);
  const g = gatherGuide();
  const title = (g.topic || "").trim() || "신제품 발표회";
  const pal = theme.palette;
  pptPreview.hidden = false;
  pptPreview.innerHTML =
    `<span class="ppt-preview-label">선택한 디자인 미리보기</span>` +
    `<div class="slide-mock big" style="background:${pal.bg};color:${pal.ink}">` +
    `<div class="slide-bar" style="background:${pal.accent}"></div>` +
    `<div class="slide-title" style="font-family:'${cssFamily(theme.heading.webFont)}',sans-serif">${escapeHtml(title)}</div>` +
    `<div class="slide-bullet" style="font-family:'${cssFamily(theme.body.webFont)}',sans-serif;color:${pal.sub}">핵심 포인트 하나</div>` +
    `<div class="slide-bullet" style="font-family:'${cssFamily(theme.body.webFont)}',sans-serif;color:${pal.sub}">핵심 포인트 둘</div>` +
    `</div>` +
    `<div class="theme-fontnote">${escapeHtml(theme.name)} · 제목 ${escapeHtml(theme.heading.webFont)} / 본문 ${escapeHtml(theme.body.webFont)}</div>`;
}

function resetPptDesign() {
  themesById = {};
  selectedPptTheme = null;
  pptThemesEl.innerHTML = "";
  pptPreview.hidden = true;
  pptPreview.innerHTML = "";
  pptDesignStatus.textContent = "";
}

async function recommendPptThemes() {
  const g = gatherGuide();
  pptDesignStatus.textContent = "추천 받는 중…";
  try {
    const res = await fetch("/api/ppt/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: g.topic, purpose: g.message, audience: g.audience, mood: g.mood }),
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    renderThemeCards((data.recommendations || []).map((r) => ({ preset: r.preset, reason: r.reason })));
    pptDesignStatus.textContent = "마음에 드는 디자인을 골라보세요";
  } catch {
    pptDesignStatus.textContent = "추천을 불러오지 못했어요";
  }
}

async function showAllThemes() {
  pptDesignStatus.textContent = "전체 불러오는 중…";
  try {
    const res = await fetch("/api/ppt/themes");
    if (!res.ok) throw new Error();
    const data = await res.json();
    renderThemeCards((data.presets || []).map((p) => ({ preset: p })));
    pptDesignStatus.textContent = "전체 디자인에서 골라보세요";
  } catch {
    pptDesignStatus.textContent = "목록을 불러오지 못했어요";
  }
}

/* ---------- Beginner step-by-step wizard ---------- */
function getCurrentModule() {
  return modules.find((m) => m.id === moduleSelect.value);
}

function buildWizardSteps(module) {
  const steps = [];
  for (const f of module.guide ?? []) steps.push({ kind: "guide", ...f });
  for (const o of module.options ?? []) steps.push({ kind: "option", ...o });
  return steps;
}

function stepSkipValue(s) {
  if (s.kind === "guide") return s.skipValue !== undefined ? s.skipValue : "";
  return s.default !== undefined ? s.default : "";
}

function applyInputMode(module) {
  const useWizard = !!(module && module.wizard) && !classicMode;
  wizardEl.hidden = !useWizard;
  toWizardBtn.hidden = !(module && module.wizard && classicMode);
  const disp = useWizard ? "none" : "";
  guideFieldsEl.style.display = disp;
  moduleOptionsEl.style.display = disp;
  extraField.style.display = disp;
  actionsRow.style.display = disp;
  if (useWizard) startWizard(module);
  else wizardEl.innerHTML = "";
}

function startWizard(module) {
  wizardSteps = buildWizardSteps(module);
  wizardIdx = 0;
  wizardValues = {};
  renderWizardStep();
}

function setWizardCurrentValue(val) {
  const s = wizardSteps[wizardIdx];
  if (s) wizardValues[s.key] = val;
}

function renderWizardStep() {
  if (wizardIdx >= wizardSteps.length) {
    renderWizardSummary();
    return;
  }
  const s = wizardSteps[wizardIdx];
  const total = wizardSteps.length;
  const pct = Math.round((wizardIdx / total) * 100);
  const help = s.help ? `<p class="wizard-help">${escapeHtml(s.help)}</p>` : "";
  const cur = wizardValues[s.key] ?? "";

  let control;
  const isChoice = s.type === "select" && (s.choices ?? []).length > 0;
  if (isChoice) {
    control =
      `<div class="wizard-choices">` +
      s.choices
        .map((c) => {
          const ex = c.example ? `<span class="ex">${escapeHtml(c.example)}</span>` : "";
          return `<button type="button" class="wizard-choice" data-choice="${escapeHtml(c.value)}">${escapeHtml(c.label || c.value)}${ex}</button>`;
        })
        .join("") +
      `</div>`;
  } else if (s.type === "textarea") {
    control = `<textarea class="wizard-input" id="wizard-input" maxlength="3000" placeholder="${escapeHtml(s.placeholder || "")}">${escapeHtml(String(cur))}</textarea>`;
  } else {
    const t = s.type === "number" ? "number" : "text";
    const minmax = `${s.min !== undefined ? `min="${s.min}"` : ""} ${s.max !== undefined ? `max="${s.max}"` : ""}`;
    const cap = t === "text" ? ' maxlength="3000"' : "";
    control = `<input class="wizard-input" id="wizard-input" type="${t}"${cap} placeholder="${escapeHtml(s.placeholder || "")}" value="${escapeHtml(String(cur))}" ${minmax}>`;
  }

  wizardEl.innerHTML =
    `<div class="wizard-progress"><span class="wizard-progress-text">${wizardIdx + 1} / ${total}</span><span class="wizard-bar"><i style="width:${pct}%"></i></span></div>` +
    `<h3 class="wizard-q">${escapeHtml(s.question || s.label)}</h3>` +
    help +
    control +
    `<p class="wizard-warn" id="wizard-warn" role="alert"></p>` +
    `<div class="wizard-actions">` +
    (isChoice ? "" : `<button type="button" class="btn-primary" id="wizard-next">다음</button>`) +
    (wizardIdx > 0 ? `<button type="button" class="btn-ghost" id="wizard-prev">이전</button>` : "") +
    `<button type="button" class="wizard-skip" id="wizard-skip">잘 모르겠어요</button>` +
    `</div>` +
    `<button type="button" class="wizard-skip" id="wizard-classic">직접 입력하기</button>`;

  if (isChoice) {
    wizardEl.querySelectorAll("[data-choice]").forEach((b) =>
      b.addEventListener("click", () => {
        setWizardCurrentValue(b.dataset.choice);
        wizardIdx += 1;
        renderWizardStep();
      }),
    );
  } else {
    const inp = document.getElementById("wizard-input");
    inp?.focus();
    document.getElementById("wizard-next").addEventListener("click", () => {
      const val = inp.value.trim();
      if (s.required && !val) {
        document.getElementById("wizard-warn").textContent =
          "이 항목은 꼭 필요해요. 모르시면 아래 '잘 모르겠어요'를 눌러주세요.";
        inp.focus();
        return;
      }
      setWizardCurrentValue(val);
      wizardIdx += 1;
      renderWizardStep();
    });
  }
  document.getElementById("wizard-skip").addEventListener("click", () => {
    setWizardCurrentValue(stepSkipValue(s));
    wizardIdx += 1;
    renderWizardStep();
  });
  document.getElementById("wizard-prev")?.addEventListener("click", () => {
    wizardIdx = Math.max(0, wizardIdx - 1);
    renderWizardStep();
  });
  document.getElementById("wizard-classic").addEventListener("click", () => {
    classicMode = true;
    applyInputMode(getCurrentModule());
  });
}

function renderWizardSummary() {
  const items = wizardSteps
    .map((s) => {
      const v = wizardValues[s.key];
      const empty = v === undefined || v === "" || v === stepSkipValue(s);
      const shown = v === undefined || v === "" ? "기본값으로 진행" : String(v);
      return (
        `<div class="wizard-summary-item">` +
        `<div class="wizard-summary-q">${escapeHtml(s.question || s.label)}</div>` +
        `<div class="wizard-summary-a ${empty ? "default" : ""}">${escapeHtml(shown)}</div></div>`
      );
    })
    .join("");
  wizardEl.innerHTML =
    `<h3 class="wizard-q">이렇게 만들게요</h3>` +
    `<p class="wizard-help">아래 내용으로 만들어요. 고치고 싶으면 '처음부터'를 눌러주세요.</p>` +
    items +
    `<div class="wizard-actions">` +
    `<button type="button" class="btn-primary" id="wizard-make">이대로 만들기</button>` +
    `<button type="button" class="btn-ghost" id="wizard-demo">예시 먼저 보기</button>` +
    `<button type="button" class="btn-ghost" id="wizard-restart">처음부터</button>` +
    `</div>` +
    `<button type="button" class="wizard-skip" id="wizard-classic">직접 입력하기</button>`;
  document.getElementById("wizard-make").addEventListener("click", finishWizard);
  document.getElementById("wizard-demo").addEventListener("click", loadSample);
  document.getElementById("wizard-restart").addEventListener("click", () => {
    wizardIdx = 0;
    renderWizardStep();
  });
  document.getElementById("wizard-classic").addEventListener("click", () => {
    classicMode = true;
    applyInputMode(getCurrentModule());
  });
}

// Write wizard answers into the (hidden) classic inputs, then run normal generate.
function finishWizard() {
  for (const s of wizardSteps) {
    const v = wizardValues[s.key] ?? "";
    const container = s.kind === "guide" ? guideFieldsEl : moduleOptionsEl;
    const attr = s.kind === "guide" ? "data-guide-key" : "data-opt-key";
    const el = container.querySelector(`[${attr}="${s.key}"]`);
    if (el) el.value = v;
  }
  if (typeof form.requestSubmit === "function") form.requestSubmit();
  else generate(new Event("submit"));
}

function updateModuleDesc() {
  const current = modules.find((m) => m.id === moduleSelect.value);
  modulePurpose.textContent = current?.purpose ?? "";
  moduleDesc.textContent = current?.description ?? "";
  renderGuide(current);
  renderOptions(current);

  const isPpt = current?.id === "ppt";
  pptDesign.hidden = !isPpt;
  if (!isPpt) resetPptDesign();

  const hasGuide = (current?.guide ?? []).length > 0;
  inputLabel.textContent = hasGuide ? "추가 요청 (선택)" : "요청 입력";
  inputEl.placeholder = hasGuide
    ? "더 적고 싶은 내용이 있으면 자유롭게 적어주세요 (선택)"
    : current?.inputPlaceholder || defaultInputPlaceholder;

  // Default input mode per guidance: guided → step-by-step wizard, lite → compact form.
  classicMode = guidanceLevel === "lite";
  applyInputMode(current);
}

const CARD_GROUPS = [
  { id: "study", label: "공부·수업" },
  { id: "work", label: "글쓰기·문서" },
];

function cardHtml(m) {
  const theme = THEME[m.id] ?? DEFAULT_THEME;
  const icon = ICONS[m.id] ?? DEFAULT_ICON;
  const tagline = THEME[m.id]?.tagline || m.purpose || m.description || "";
  return (
    `<button type="button" class="card" data-module="${escapeHtml(m.id)}">` +
    `<span class="card-icon" style="background:${theme.tile};color:${theme.accent}">${icon}</span>` +
    `<span class="card-name">${escapeHtml(m.name)}</span>` +
    `<span class="card-desc">${escapeHtml(tagline)}</span>` +
    `</button>`
  );
}

function renderCards() {
  cardsEl.innerHTML = CARD_GROUPS.map((g) => {
    const mods = modules.filter((m) => (m.group || "work") === g.id);
    if (!mods.length) return "";
    return (
      `<div class="card-group">` +
      `<h3 class="card-group-title">${escapeHtml(g.label)}</h3>` +
      `<div class="cards">${mods.map(cardHtml).join("")}</div>` +
      `</div>`
    );
  }).join("");
  cardsStatus.hidden = true;
}

async function loadModules() {
  try {
    const res = await fetch("/api/modules");
    if (!res.ok) throw new Error(`모듈 목록을 불러오지 못했습니다 (HTTP ${res.status})`);
    const data = await res.json();
    modules = data.modules ?? [];

    moduleSelect.innerHTML = "";
    for (const m of modules) {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = m.name;
      moduleSelect.appendChild(opt);
    }
    updateModuleDesc();
    renderCards();
  } catch (err) {
    cardsStatus.textContent = err instanceof Error ? err.message : String(err);
    submitBtn.disabled = true;
  }
}

/* ---------- Generation ---------- */
function setGenerating(isGenerating) {
  submitBtn.disabled = isGenerating;
  moduleSelect.disabled = isGenerating;
  inputEl.disabled = isGenerating;
  guideFieldsEl.querySelectorAll("[data-guide-key]").forEach((el) => {
    el.disabled = isGenerating;
  });
  stopBtn.hidden = !isGenerating;
}

async function readStream(res, onEvent) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const chunk = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const dataLine = chunk.split("\n").find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      try {
        onEvent(JSON.parse(dataLine.slice(5).trim()));
      } catch {
        /* ignore malformed chunk */
      }
    }
  }
}

function revealOutputOnce() {
  if (outputEl.hidden) {
    outputEl.hidden = false;
    loadingEl.hidden = true;
  }
}

async function generate(event) {
  event.preventDefault();
  clearError();
  resetOutput();

  const module = moduleSelect.value;
  const current = modules.find((m) => m.id === module);
  const guideValues = gatherGuide();

  const missing = firstMissingRequired(current, guideValues);
  if (missing) {
    showError(`'${missing.label}'을(를) 입력해 주세요.`);
    const el = guideFieldsEl.querySelector(`[data-guide-key="${missing.key}"]`);
    el?.focus();
    return;
  }

  let input = composeInput(current, guideValues, inputEl.value);
  if (current?.id === "ppt" && selectedPptTheme) {
    const p = selectedPptTheme;
    const pal = p.palette;
    input += `\n\n디자인 테마: ${p.name} — 배경 ${pal.bg}, 잉크 ${pal.ink}, 강조색 ${pal.accent}, 제목 폰트 ${p.heading.webFont}, 본문 폰트 ${p.body.webFont}`;
    if (p.signature) input += ` · 시그니처: ${p.signature}`;
  }
  if (!input.trim()) {
    showError("요청 내용을 입력해 주세요.");
    return;
  }

  setGenerating(true);
  setStatus("생성 중…");
  loadingEl.hidden = false;
  controller = new AbortController();

  try {
    const res = await fetch("/api/generate/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module, input, options: gatherOptions() }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? `요청 실패 (HTTP ${res.status})`);
    }

    let finished = false;
    let hadError = false;
    await readStream(res, (evt) => {
      if (evt.type === "delta") {
        revealOutputOnce();
        raw += evt.text;
        scheduleRender();
      } else if (evt.type === "done") {
        finished = true;
        revealOutputOnce();
        renderNow();
        const { inputTokens, outputTokens } = evt.usage ?? {};
        setStatus(`완료 · ${evt.model} · 입력 ${inputTokens} / 출력 ${outputTokens} 토큰`);
        copyBtn.hidden = raw.length === 0;
      } else if (evt.type === "error") {
        finished = true;
        hadError = true;
        showError(evt.error);
        setStatus("오류");
      }
    });

    if (!finished) {
      revealOutputOnce();
      renderNow();
      loadingEl.hidden = true;
      copyBtn.hidden = raw.length === 0;
    }

    // Build the rich preview (slides for PPT, paginated A4 document otherwise),
    // running the shared layout + QA loop.
    if (!hadError && raw.trim()) {
      const prevStatus = statusEl.textContent;
      setStatus(current?.id === "ppt" ? "슬라이드 구성 중…" : "문서 정리 중…");
      await showPreview(current?.id);
      setStatus(prevStatus);
    }
  } catch (err) {
    if (err.name === "AbortError") {
      revealOutputOnce();
      renderNow();
      loadingEl.hidden = true;
      copyBtn.hidden = raw.length === 0;
      setStatus("중지됨");
    } else {
      showError(err instanceof Error ? err.message : String(err));
      setStatus("오류");
    }
  } finally {
    setGenerating(false);
    controller = null;
  }
}

/* ---------- Demo / preview mode ---------- */
async function loadSample() {
  const id = moduleSelect.value;
  clearError();
  resetOutput();
  setStatus("예시 불러오는 중…");
  try {
    const res = await fetch(`/api/modules/${encodeURIComponent(id)}/sample`);
    if (!res.ok) throw new Error("예시를 불러오지 못했습니다.");
    const data = await res.json();
    raw = data.content || "";
    outputEl.hidden = false;
    renderNow();
    copyBtn.hidden = raw.length === 0;
    setStatus("예시 미리보기 (실제 생성 결과가 아닙니다)");
    if (raw.trim()) {
      await showPreview(id);
    }
  } catch (err) {
    showError(err instanceof Error ? err.message : String(err));
    setStatus("");
  }
}

async function checkHealth() {
  try {
    const res = await fetch("/health");
    const data = await res.json();
    if (data.generation === "disabled") {
      demoBanner.textContent =
        "현재 미리보기 모드예요 — '예시 보기'로 결과 형식을 확인할 수 있어요. (서버에 API 키를 넣으면 실제 생성이 켜집니다.)";
      demoBanner.hidden = false;
    }
  } catch {
    /* ignore */
  }
}

/* ---------- Wiring ---------- */
form.addEventListener("submit", generate);
demoBtn.addEventListener("click", loadSample);
toWizardBtn.addEventListener("click", () => {
  classicMode = false;
  applyInputMode(getCurrentModule());
});
pptRecommendBtn.addEventListener("click", recommendPptThemes);
pptAllBtn.addEventListener("click", showAllThemes);
pptThemesEl.addEventListener("click", (e) => {
  const card = e.target.closest("[data-theme]");
  if (!card) return;
  selectedPptTheme = themesById[card.dataset.theme] || null;
  pptThemesEl.querySelectorAll(".theme-card").forEach((c) => c.classList.toggle("selected", c === card));
  pptDesignStatus.textContent = selectedPptTheme ? `'${selectedPptTheme.name}' 선택됨` : "";
  if (selectedPptTheme) renderLivePreview(selectedPptTheme);
});
moduleSelect.addEventListener("change", updateModuleDesc);
stopBtn.addEventListener("click", () => controller?.abort());

// Hero search bar → carry the prompt into the generator.
heroForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = heroInput.value.trim();
  if (text) inputEl.value = text;
  location.hash = "#generate";
});

cardsEl.addEventListener("click", (e) => {
  const card = e.target.closest("[data-module]");
  if (!card) return;
  moduleSelect.value = card.dataset.module;
  updateModuleDesc();
  location.hash = "#generate";
});

copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(raw);
    copyBtn.textContent = "복사됨";
    setTimeout(() => (copyBtn.textContent = "복사"), 1500);
  } catch {
    /* clipboard may be unavailable; ignore */
  }
});

viewPreviewBtn.addEventListener("click", () => setView("preview"));
viewTextBtn.addEventListener("click", () => setView("text"));

/* ---------- First-visit onboarding survey ---------- */
const ONBOARD_KEY = "aio_onboarded";
const GUIDANCE_KEY = "aio_guidance";
const ONBOARD_QUESTIONS = [
  "AI를 사용해본 경험이 있으신가요?",
  "AI로 직접 무언가를 만들어 본 적이 있으신가요?",
  "본인이 AI를 잘 다룬다고 생각하시나요?",
  "AI한테 뭐라고 입력해야 할지 막막할 때가 있으신가요?",
  "AI를 일·공부에 더 잘 써보고 싶으신가요?",
];
const onboardingEl = document.getElementById("onboarding");
const onboardingQuestionsEl = document.getElementById("onboarding-questions");
const onboardingStartBtn = document.getElementById("onboarding-start");
const onboardingSkipBtn = document.getElementById("onboarding-skip");
const onboardAnswers = new Array(ONBOARD_QUESTIONS.length).fill(null);

function setGuidance(level) {
  guidanceLevel = level;
  localStorage.setItem(GUIDANCE_KEY, level);
  document.body.dataset.guidance = level;
}

function guidanceFromAnswers(a) {
  const score = (a[0] ? 0 : 1) + (a[1] ? 0 : 1) + (a[2] ? 0 : 1) + (a[3] ? 1 : 0);
  return score >= 2 ? "guided" : "lite";
}

function renderOnboarding() {
  onboardingQuestionsEl.innerHTML = ONBOARD_QUESTIONS.map(
    (q, i) =>
      `<div class="oq"><span class="oq-text">${escapeHtml(q)}</span>` +
      `<div class="oq-btns">` +
      `<button type="button" class="oq-btn" data-q="${i}" data-ans="yes">예</button>` +
      `<button type="button" class="oq-btn" data-q="${i}" data-ans="no">아니요</button>` +
      `</div></div>`,
  ).join("");
}

function closeOnboarding() {
  localStorage.setItem(ONBOARD_KEY, "1");
  onboardingEl.hidden = true;
  if (modules.length) updateModuleDesc(); // re-apply input mode under new guidance
}

onboardingQuestionsEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".oq-btn");
  if (!btn) return;
  const i = Number(btn.dataset.q);
  onboardAnswers[i] = btn.dataset.ans === "yes";
  onboardingQuestionsEl
    .querySelectorAll(`.oq-btn[data-q="${i}"]`)
    .forEach((b) => b.classList.toggle("selected", b === btn));
  onboardingStartBtn.disabled = onboardAnswers.some((a) => a === null);
});

onboardingStartBtn.addEventListener("click", () => {
  if (onboardAnswers.some((a) => a === null)) return;
  setGuidance(guidanceFromAnswers(onboardAnswers));
  closeOnboarding();
  fetch("/api/onboarding-survey", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      q1: onboardAnswers[0],
      q2: onboardAnswers[1],
      q3: onboardAnswers[2],
      q4: onboardAnswers[3],
      q5: onboardAnswers[4],
    }),
  }).catch(() => {});
});

onboardingSkipBtn.addEventListener("click", () => {
  setGuidance("guided"); // skip → default to more help
  closeOnboarding();
});

function maybeShowOnboarding() {
  if (localStorage.getItem(ONBOARD_KEY)) return;
  renderOnboarding();
  onboardingEl.hidden = false;
}

applyRoute();
loadModules();
checkHealth();
maybeShowOnboarding();
