import { marked } from "./vendor/marked.esm.js";
import DOMPurify from "./vendor/purify.es.mjs";
import { parseDeck, renderDeck, capDeck } from "./slides.js";
import { renderPagedDocument, resolveColors, bestText, blend } from "./docqa.js";
import { createSourceInput } from "./attachments.js";
import { exportPptx } from "./pptx.js";
import { exportDocx } from "./docx.js";
import { exportHwpx } from "./hwpx.js";

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
const viewHelp = document.getElementById("view-help");

const heroForm = document.getElementById("hero-form");
const heroInput = document.getElementById("hero-input");

const cardsEl = document.getElementById("module-cards");
const cardsStatus = document.getElementById("cards-status");

const form = document.getElementById("form");
const moduleSelect = document.getElementById("module");
const modulePurpose = document.getElementById("module-purpose");
const moduleDesc = document.getElementById("module-desc");
const moduleIntro = document.getElementById("module-intro");
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
const designModal = document.getElementById("design-modal");
const designModalBody = document.getElementById("design-modal-body");
const designModalTitle = document.getElementById("design-modal-title");
const designModalClose = document.getElementById("design-modal-close");
const designModalPick = document.getElementById("design-modal-pick");
const designModalPptxBtn = document.getElementById("design-modal-pptx");
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
const examPdfBar = document.getElementById("exam-pdf");
const examBrandEl = document.getElementById("exam-brand");
const examMottoEl = document.getElementById("exam-motto");
const examPdfBtn = document.getElementById("exam-pdf-btn");
const examPdfStatus = document.getElementById("exam-pdf-status");
const examVariantChips = document.getElementById("exam-variant");
let examVariant = "teacher";
const examReviewBar = document.getElementById("exam-review");
const examReviewBtn = document.getElementById("exam-review-btn");
const examReviewStatus = document.getElementById("exam-review-status");
const examReviewPanel = document.getElementById("exam-review-panel");
const examReviewBadges = document.getElementById("exam-review-badges");
const examReviewActions = document.getElementById("exam-review-actions");
const examReviewApply = document.getElementById("exam-review-apply");
const examReviewText = document.getElementById("exam-review-text");
let lastFixedMarkdown = null;
// Modules that expose the AI review action (mirror of src/services/review.ts REVIEWABLE).
const REVIEWABLE = new Set(["exam", "vocabulary", "worksheet", "quiz", "ppt", "excel"]);
const docExport = document.getElementById("doc-export");
const paperChips = document.getElementById("paper-chips");
const downloadDocxBtn = document.getElementById("download-docx");
const downloadHwpxBtn = document.getElementById("download-hwpx");
const downloadDocPdfBtn = document.getElementById("download-docpdf");
const downloadDesignPdfBtn = document.getElementById("download-designpdf");
const downloadXlsxBtn = document.getElementById("download-xlsx");
const docExportNote = document.getElementById("doc-export-note");
const docExportStatus = document.getElementById("doc-export-status");
let docPaper = "a4"; // A4 | letter | b5
// Modules whose output is a document (everything except slides). PPT → .pptx.
function isDocModule(id) {
  return !!id && id !== "ppt";
}
// Convenience pass (A1–A4)
const loadingMsg = document.getElementById("loading-msg");
const loadingSub = document.getElementById("loading-sub");
const resultActions = document.getElementById("result-actions");
const downloadTextBtn = document.getElementById("download-text");
const downloadPptxBtn = document.getElementById("download-pptx");
const pptxHint = document.getElementById("pptx-hint");
const tweakBtn = document.getElementById("tweak-btn");
const draftNote = document.getElementById("draft-note");
const draftNewBtn = document.getElementById("draft-new");
const samplePreview = document.getElementById("sample-preview");
const sampleSnippet = document.getElementById("sample-snippet");
const sampleExpandBtn = document.getElementById("sample-expand");
const sampleModal = document.getElementById("sample-modal");
const sampleModalBody = document.getElementById("sample-modal-body");
const sampleModalClose = document.getElementById("sample-modal-close");
const sampleModalMake = document.getElementById("sample-modal-make");
const sampleModalTitle = document.getElementById("sample-modal-title");

// Fallback design theme for the slide renderer when the user hasn't picked one.
const DEFAULT_DECK_THEME = {
  name: "기본",
  palette: { bg: "#FFFFFF", surface: "#EEF3F9", ink: "#16203A", sub: "#5B6B82", accent: "#2F6DB5" },
  heading: { webFont: "Noto Sans KR", weights: [700] },
  body: { webFont: "Noto Sans KR", weights: [400] },
};
const wizardEl = document.getElementById("wizard");
const toWizardBtn = document.getElementById("to-wizard");
const sourceSection = document.getElementById("source-section");
const sourceLabel = document.getElementById("source-label");
const sourceHint = document.getElementById("source-hint");
const sourceMount = document.getElementById("source-mount");
const sourceNote = document.getElementById("source-note");

// Topic-mode reminder shown under the source input.
const SOURCE_TOPIC_NOTE =
  "본문·사진 없이 주제만 넣으면 AI가 비슷한 내용을 새로 만들어요. 실제 교재 그대로 내려면 본문이나 사진을 올려주세요.";
const SOURCE_GROUNDED_NOTE = "✓ 올려주신 자료를 바탕으로 만들어요.";

// One reusable source-material input (photo / paste / file), shared across modules.
const sourceInput = createSourceInput({
  onChange: () => {
    updateSourceNote();
    scheduleSaveDraft();
  },
});

function mountSourceTo(container) {
  if (container && sourceInput.el.parentNode !== container) container.appendChild(sourceInput.el);
}
function updateSourceNote() {
  const grounded = !sourceInput.isEmpty();
  for (const el of [sourceNote, document.getElementById("wizard-source-note")]) {
    if (!el) continue;
    el.textContent = grounded ? SOURCE_GROUNDED_NOTE : SOURCE_TOPIC_NOTE;
    el.classList.toggle("grounded", grounded);
  }
}
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

/* ---------- Korean particle (josa) helper ---------- */
// Pick the right particle for a dynamic word from its final sound (받침 유무),
// so the UI never shows the dual "을(를)" form.
const LATIN_FINAL_CONSONANT = new Set(["l", "m", "n"]); // 엘/엠/엔 read with a 받침
const DIGIT_FINAL = {
  "0": { c: true, r: false }, // 영(ㅇ)
  "1": { c: true, r: true }, // 일(ㄹ)
  "2": { c: false, r: false }, // 이
  "3": { c: true, r: false }, // 삼(ㅁ)
  "4": { c: false, r: false }, // 사
  "5": { c: false, r: false }, // 오
  "6": { c: true, r: false }, // 육(ㄱ)
  "7": { c: true, r: true }, // 칠(ㄹ)
  "8": { c: true, r: true }, // 팔(ㄹ)
  "9": { c: false, r: false }, // 구
};
function finalInfo(word) {
  const w = String(word || "")
    .trim()
    .replace(/['")\]}》」』.\s]+$/, ""); // ignore trailing quotes/brackets/space
  const ch = w.slice(-1);
  if (!ch) return { hasFinal: false, isRieul: false };
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    const f = (code - 0xac00) % 28;
    return { hasFinal: f !== 0, isRieul: f === 8 };
  }
  if (ch >= "0" && ch <= "9") return { hasFinal: DIGIT_FINAL[ch].c, isRieul: DIGIT_FINAL[ch].r };
  const lower = ch.toLowerCase();
  if (lower >= "a" && lower <= "z") return { hasFinal: LATIN_FINAL_CONSONANT.has(lower), isRieul: lower === "l" };
  return { hasFinal: false, isRieul: false }; // symbols/unknown → treat as vowel
}
function particleOf(word, type) {
  const { hasFinal, isRieul } = finalInfo(word);
  switch (type) {
    case "을/를":
      return hasFinal ? "을" : "를";
    case "이/가":
      return hasFinal ? "이" : "가";
    case "은/는":
      return hasFinal ? "은" : "는";
    case "와/과":
      return hasFinal ? "과" : "와";
    case "로":
    case "으로":
      return !hasFinal || isRieul ? "로" : "으로";
    default:
      return "";
  }
}
function josa(word, type) {
  return `${word}${particleOf(word, type)}`;
}

/* ---------- View routing (hash-based) ---------- */
const PAGE_TITLES = {
  home: "올인원 AI — 질문에 답만 하면 완성",
  app: "작업실 — 올인원 AI",
  help: "도움말 — 올인원 AI",
  terms: "이용약관 — 올인원 AI",
  privacy: "개인정보처리방침 — 올인원 AI",
};
function applyRoute() {
  const h = location.hash;
  const route =
    h === "#generate"
      ? "app"
      : h === "#help"
        ? "help"
        : h === "#terms"
          ? "terms"
          : h === "#privacy"
            ? "privacy"
            : "home";
  viewHome.hidden = route !== "home";
  viewApp.hidden = route !== "app";
  viewTerms.hidden = route !== "terms";
  viewPrivacy.hidden = route !== "privacy";
  if (viewHelp) viewHelp.hidden = route !== "help";
  document.title = PAGE_TITLES[route] || PAGE_TITLES.home;
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
  examPdfBar.hidden = true;
  if (examPdfStatus) examPdfStatus.textContent = "";
  if (examReviewBar) examReviewBar.hidden = true;
  resetExamReview();
  if (resultActions) resultActions.hidden = true;
  if (docExport) docExport.hidden = true;
  if (docExportStatus) docExportStatus.textContent = "";
  clearLoadingTimers();
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
      page: docPaper,
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
  // The exam module also offers a polished A4 PDF (server-side WeasyPrint) and
  // an independent QA review pass.
  examPdfBar.hidden = moduleId !== "exam";
  examReviewBar.hidden = !REVIEWABLE.has(moduleId);
  resetExamReview();
  if (moduleId === "ppt") {
    await showDeck(raw, selectedPptTheme || DEFAULT_DECK_THEME);
  } else {
    await showDoc(moduleId);
  }
}

// Exam → polished A4 PDF download. Brand/motto are optional (neutral defaults).
async function downloadExamPdf() {
  if (!raw.trim()) return;
  const guide = gatherGuide();
  const opts = gatherOptions();
  examPdfStatus.textContent = "PDF 만드는 중…";
  examPdfBtn.disabled = true;
  try {
    const res = await fetch("/api/exam/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        markdown: raw,
        subject: guide.subject || "",
        scope: guide.scope || "",
        difficulty: opts.difficulty || "",
        brand: examBrandEl.value.trim(),
        motto: examMottoEl.value.trim(),
        variant: examVariant,
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      examPdfStatus.textContent = d.error || "PDF 생성에 실패했어요.";
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const variantSuffix = examVariant === "student" ? "_학생용" : examVariant === "key" ? "_정답지" : "";
    const a = document.createElement("a");
    a.href = url;
    a.download = ((guide.subject || "시험지").trim() || "시험지") + variantSuffix + ".pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    examPdfStatus.textContent = "내려받기 완료";
    setTimeout(() => (examPdfStatus.textContent = ""), 2500);
  } catch {
    examPdfStatus.textContent = "PDF 생성에 실패했어요.";
  } finally {
    examPdfBtn.disabled = false;
  }
}

/* ---------- Exam QA: independent 4-stage adversarial review (+ optional fix) ---------- */

function resetExamReview() {
  if (!examReviewPanel) return;
  examReviewPanel.hidden = true;
  examReviewActions.hidden = true;
  examReviewBadges.innerHTML = "";
  examReviewText.innerHTML = "";
  examReviewStatus.textContent = "";
  lastFixedMarkdown = null;
}

function renderExamReview(data) {
  const s = data.severity || { critical: 0, major: 0, minor: 0 };
  const total = (s.critical || 0) + (s.major || 0) + (s.minor || 0);
  const badge = (label, n, cls) =>
    `<span class="rv-badge ${cls}${n ? "" : " zero"}">${label} ${n || 0}</span>`;
  examReviewBadges.innerHTML =
    (total === 0 ? `<span class="rv-clean">✅ 큰 문제를 찾지 못했어요</span>` : "") +
    badge("치명", s.critical, "rv-critical") +
    badge("중대", s.major, "rv-major") +
    badge("경미", s.minor, "rv-minor");
  examReviewText.innerHTML = DOMPurify.sanitize(marked.parse(data.reviewText || "검토 결과가 비어 있어요."));
  lastFixedMarkdown = data.changed ? data.fixedMarkdown : null;
  examReviewActions.hidden = !lastFixedMarkdown;
  examReviewPanel.hidden = false;
}

async function runReview() {
  if (!raw.trim()) return;
  const moduleId = getCurrentModule()?.id;
  if (!moduleId || !REVIEWABLE.has(moduleId)) return;
  examReviewBtn.disabled = true;
  examReviewStatus.textContent = "검토 중… 다시 꼼꼼히 살펴보는 중이라 시간이 좀 걸려요";
  try {
    const res = await fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module: moduleId, markdown: raw }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      examReviewStatus.textContent = data.error || "검토에 실패했어요. 잠시 후 다시 시도해 주세요.";
      return;
    }
    renderExamReview(data);
    examReviewStatus.textContent = "";
  } catch {
    examReviewStatus.textContent = "검토에 실패했어요. 잠시 후 다시 시도해 주세요.";
  } finally {
    examReviewBtn.disabled = false;
  }
}

async function applyReviewFix() {
  if (!lastFixedMarkdown) return;
  const moduleId = getCurrentModule()?.id;
  raw = lastFixedMarkdown;
  lastFixedMarkdown = null;
  renderNow();
  updateActiveHistoryContent(raw); // keep the sidebar entry in sync with the fix
  try {
    // Rebuild the right preview from the corrected markdown.
    if (moduleId === "ppt") await showDeck(raw, selectedPptTheme || DEFAULT_DECK_THEME);
    else await showDoc(moduleId);
  } catch {
    /* preview is best-effort; the raw text + exports already use the fix */
  }
  examReviewActions.hidden = true;
  examReviewStatus.textContent = "✅ 수정본을 적용했어요. 미리보기·내려받기에 반영됐어요.";
}

/* ---------- Shared structured controls (chips / stepper / counts) ---------- */
// Reusable builders so every module's bounded inputs look & behave the same.
// Each exposes a single value-bearing element carrying the gather attribute
// (data-guide-key / data-opt-key) so gatherGuide/gatherOptions stay unchanged.

function choiceChips(keyAttr, key, choices, def) {
  const value = def != null ? def : choices[0]?.value ?? "";
  const chips = choices
    .map((c) => {
      const v = c.value;
      const lab = c.label ?? c.value;
      const ex = c.example ? `<span class="chip-ex">${escapeHtml(c.example)}</span>` : "";
      return `<button type="button" class="chip${v === value ? " active" : ""}" data-chip="${escapeHtml(v)}">${escapeHtml(lab)}${ex}</button>`;
    })
    .join("");
  return (
    `<div class="chips" role="group">${chips}</div>` +
    `<input type="hidden" ${keyAttr}="${escapeHtml(key)}" value="${escapeHtml(value)}">`
  );
}

function numberStepper(keyAttr, key, opt, id) {
  const min = opt.min ?? 0;
  const max = opt.max ?? 9999;
  const step = opt.step ?? 1;
  const def = opt.default ?? min;
  const unit = opt.unit ? `<span class="stepper-unit">${escapeHtml(opt.unit)}</span>` : "";
  const idAttr = id ? ` id="${id}"` : "";
  const presets =
    Array.isArray(opt.presets) && opt.presets.length
      ? `<div class="presets">` +
        opt.presets.map((p) => `<button type="button" class="preset" data-preset="${escapeHtml(String(p))}">${escapeHtml(String(p))}</button>`).join("") +
        `</div>`
      : "";
  return (
    `<div class="stepper" data-min="${min}" data-max="${max}" data-step="${step}">` +
    `<button type="button" class="step-btn" data-step-dir="-1" aria-label="줄이기">−</button>` +
    `<input type="number" class="step-input"${idAttr} ${keyAttr}="${escapeHtml(key)}" value="${escapeHtml(String(def))}" min="${min}" max="${max}" step="${step}" inputmode="numeric">` +
    `<button type="button" class="step-btn" data-step-dir="1" aria-label="늘리기">+</button>` +
    unit +
    `</div>` +
    presets
  );
}

function countsControl(keyAttr, key, field, id) {
  const items = field.items ?? [];
  const unit = field.unit ?? "개";
  const rows = items
    .map((it) => {
      const def = it.default ?? 0;
      return (
        `<div class="count-row">` +
        `<span class="count-label">${escapeHtml(it.label)}</span>` +
        `<div class="stepper" data-min="${it.min ?? 0}" data-max="${it.max ?? 999}" data-step="1">` +
        `<button type="button" class="step-btn" data-step-dir="-1" aria-label="줄이기">−</button>` +
        `<input type="number" class="step-input count-item" data-count-item="${escapeHtml(it.key)}" data-count-label="${escapeHtml(it.label)}" value="${def}" min="${it.min ?? 0}" max="${it.max ?? 999}" inputmode="numeric">` +
        `<button type="button" class="step-btn" data-step-dir="1" aria-label="늘리기">+</button>` +
        `<span class="stepper-unit">${escapeHtml(unit)}</span>` +
        `</div></div>`
      );
    })
    .join("");
  const idAttr = id ? ` id="${id}"` : "";
  return (
    `<div class="counts" data-unit="${escapeHtml(unit)}">` +
    rows +
    `<div class="count-total"><span class="count-total-text"></span></div>` +
    `<input type="hidden"${idAttr} ${keyAttr}="${escapeHtml(key)}" value="">` +
    `</div>`
  );
}

// Recompute a counts control's live total + the hidden composed value it submits.
function refreshCounts(countsEl) {
  if (!countsEl) return;
  const unit = countsEl.dataset.unit || "개";
  const parts = [];
  let total = 0;
  countsEl.querySelectorAll(".count-item").forEach((inp) => {
    const n = Math.max(0, parseInt(inp.value, 10) || 0);
    total += n;
    if (n > 0) parts.push(`${inp.dataset.countLabel} ${n}${unit}`);
  });
  const totalText = countsEl.querySelector(".count-total-text");
  if (totalText) totalText.textContent = `총 ${total}${unit}`;
  const hidden = countsEl.querySelector("input[type='hidden']");
  if (hidden) hidden.value = parts.length ? `${parts.join(", ")} (총 ${total}${unit})` : "";
}

function refreshAllCounts(scope) {
  (scope || form).querySelectorAll(".counts").forEach(refreshCounts);
}

function clampStepInput(inp) {
  const wrap = inp.closest(".stepper");
  const min = wrap ? Number(wrap.dataset.min ?? 0) : 0;
  const max = wrap ? Number(wrap.dataset.max ?? 9999) : 9999;
  let n = parseInt(inp.value, 10);
  if (!Number.isFinite(n)) n = min;
  n = Math.max(min, Math.min(max, n));
  inp.value = String(n);
  return n;
}

// One delegated handler for all structured controls inside the form (classic + wizard).
form.addEventListener("click", (e) => {
  const chip = e.target.closest(".chip[data-chip]");
  if (chip) {
    const group = chip.closest(".chips");
    group?.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c === chip));
    const hidden = group?.parentElement.querySelector("input[type='hidden']");
    if (hidden) hidden.value = chip.dataset.chip;
    return;
  }
  const stepBtn = e.target.closest(".step-btn[data-step-dir]");
  if (stepBtn) {
    const wrap = stepBtn.closest(".stepper");
    const inp = wrap?.querySelector(".step-input");
    if (inp) {
      const step = Number(wrap.dataset.step ?? 1);
      inp.value = String((parseInt(inp.value, 10) || 0) + step * Number(stepBtn.dataset.stepDir));
      clampStepInput(inp);
      if (inp.classList.contains("count-item")) refreshCounts(inp.closest(".counts"));
    }
    return;
  }
  const preset = e.target.closest(".preset[data-preset]");
  if (preset) {
    const inp = preset.closest(".presets")?.previousElementSibling?.querySelector?.(".step-input");
    if (inp) {
      inp.value = preset.dataset.preset;
      clampStepInput(inp);
    }
  }
});

// Clamp + recompute on manual typing.
form.addEventListener("input", (e) => {
  const inp = e.target.closest(".step-input");
  if (!inp) return;
  if (inp.classList.contains("count-item")) refreshCounts(inp.closest(".counts"));
});
form.addEventListener("change", (e) => {
  const inp = e.target.closest(".step-input");
  if (inp) {
    clampStepInput(inp);
    if (inp.classList.contains("count-item")) refreshCounts(inp.closest(".counts"));
  }
});

/* ---------- Options ---------- */
function renderOptionControl(opt) {
  const label = `<span class="opt-label">${escapeHtml(opt.label)}</span>`;
  const help = opt.help ? `<span class="guide-help">${escapeHtml(opt.help)}</span>` : "";
  let control;
  if (opt.type === "select") {
    control = choiceChips("data-opt-key", opt.key, opt.choices ?? [], opt.default);
  } else if (opt.type === "number") {
    control = numberStepper("data-opt-key", opt.key, opt);
  } else {
    const ph = opt.placeholder ? `placeholder="${escapeHtml(opt.placeholder)}"` : "";
    control = `<input type="text" data-opt-key="${escapeHtml(opt.key)}" maxlength="1000" ${ph} ${opt.default !== undefined ? `value="${escapeHtml(String(opt.default))}"` : ""}/>`;
  }
  return `<div class="opt">${label}${help}${control}</div>`;
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
  const help = f.help ? `<span class="guide-help">${escapeHtml(f.help)}</span>` : "";
  const hint = f.hint ? `<span class="hint">${escapeHtml(f.hint)}</span>` : "";
  let control;
  let tag = "label"; // text/textarea focus nicely inside a <label>
  if (f.type === "select") {
    control = choiceChips("data-guide-key", f.key, f.choices ?? [], f.default);
    tag = "div"; // interactive buttons shouldn't sit inside a <label>
  } else if (f.type === "number") {
    control = numberStepper("data-guide-key", f.key, f);
    tag = "div";
  } else if (f.type === "counts") {
    control = countsControl("data-guide-key", f.key, f);
    tag = "div";
  } else if (f.type === "textarea") {
    control = `<textarea data-guide-key="${key}" rows="3" maxlength="3000" placeholder="${ph}"></textarea>`;
  } else {
    control = `<input type="text" data-guide-key="${key}" maxlength="3000" placeholder="${ph}" />`;
  }
  return `<${tag} class="guide-field">${label}${help}${control}${hint}</${tag}>`;
}

function renderGuide(module) {
  const guide = module?.guide ?? [];
  guideFieldsEl.innerHTML = guide.map(renderGuideControl).join("");
  refreshAllCounts(guideFieldsEl);
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

// Contrast-safe colors for a design (so text is readable on ANY palette,
// including dark designs) + the design's fonts.
function designColors(theme) {
  return resolveColors((theme && theme.palette) || {});
}

// Render one sample slide using the design's tokens + the user's content.
function designSlide(theme, data) {
  const c = designColors(theme);
  const titleFont = cssFamily(theme.heading?.webFont || "Noto Sans KR");
  const bodyFont = cssFamily(theme.body?.webFont || "Noto Sans KR");
  const big = data.kind === "title";
  const sub = data.subtitle
    ? `<div class="slide-sub" style="font-family:'${bodyFont}',sans-serif;color:${c.sub}">${escapeHtml(data.subtitle)}</div>`
    : "";
  const bullets = (data.bullets || [])
    .map(
      (b) =>
        `<div class="slide-bullet" style="font-family:'${bodyFont}',sans-serif;color:${c.sub}">${escapeHtml(b)}</div>`,
    )
    .join("");
  return (
    `<div class="slide-mock${big ? " big" : ""}" style="background:${c.bg};color:${c.ink}">` +
    `<div class="slide-bar" style="background:${c.accent}"></div>` +
    `<div class="slide-title" style="font-family:'${titleFont}','Noto Sans KR',sans-serif;color:${c.ink}">${escapeHtml(data.title || "")}</div>` +
    sub +
    bullets +
    `</div>`
  );
}

// Tiny generic mini-slide for cards without a rendered thumbnail (fallback presets).
function cssMiniSlide(p) {
  loadFont(p.heading);
  loadFont(p.body);
  return designSlide(p, { kind: "content", title: "제목을 여기에", bullets: ["핵심 포인트 하나", "핵심 포인트 둘"] });
}

// Build content-aware sample slides from the user's current PPT input.
function pptContentSlides(theme) {
  const g = gatherGuide();
  const topic = (g.topic || "").trim() || "발표 제목을 입력해 보세요";
  const audience = (g.audience || "").trim();
  const message = (g.message || "").trim();
  const titleSlide = {
    kind: "title",
    title: topic,
    subtitle: audience ? `${audience} 대상` : message || "부제목이 여기에 들어가요",
  };
  const bullets = [];
  if (message) bullets.push(message);
  bullets.push("핵심 내용 예시 ①");
  bullets.push("핵심 내용 예시 ②");
  if (bullets.length < 3) bullets.push("핵심 내용 예시 ③");
  const contentSlide = { kind: "content", title: topic, bullets: bullets.slice(0, 3) };
  return { titleSlide, contentSlide };
}

function renderLivePreview(theme) {
  if (!theme) return;
  loadFont(theme.heading);
  loadFont(theme.body);
  const { titleSlide } = pptContentSlides(theme);
  pptPreview.hidden = false;
  pptPreview.innerHTML =
    `<span class="ppt-preview-label">선택한 디자인 미리보기 — 입력하신 내용이 이 디자인에 들어간 모습이에요</span>` +
    designSlide(theme, titleSlide) +
    `<div class="theme-fontnote">${escapeHtml(theme.name)} · 제목 ${escapeHtml(theme.heading.webFont)} / 본문 ${escapeHtml(theme.body.webFont)}</div>`;
}

// Fixed, realistic Korean sample content — identical across all designs so the
// only thing that changes is the design itself (fair comparison, no lorem ipsum).
const SHOWCASE = {
  eyebrow: "PRODUCT LAUNCH",
  title: "푸른들 정수기 2026",
  subtitle: "물, 그 이상의 깨끗함",
  contentTitle: "이번 시즌 핵심",
  bullets: ["3단계 미네랄 정수 시스템", "전력 사용 30% 절감", "월 구독형 자동 필터 관리"],
  compareTitle: "한눈에 비교",
  compareLeft: { h: "기존 제품", items: ["느린 정수 속도", "필터 수동 교체", "높은 전력 사용"] },
  compareRight: { h: "푸른들 2026", items: ["2배 빠른 정수", "교체 시기 자동 알림", "전력 30% 절감"] },
  sectionNo: "02",
  sectionName: "시장 기회",
  statNum: "+38%",
  statLabel: "전년 대비 친환경 가전 수요 성장",
  bars: [42, 58, 71, 100],
  quote: "좋은 물은 가장 단순한 사치입니다.",
  quoteBy: "— 브랜드 디렉터, 김하늘",
};

function designTokens(theme) {
  const c = resolveColors((theme && theme.palette) || {});
  return { ...c, panel: blend(c.bg, c.ink, 0.07), onAccent: bestText(c.accent) };
}

// Deck model for the .pptx export — the SAME fixed sample content as the HTML
// showcase, so the downloaded presentation matches the preview. Uses all six
// archetypes. (AI content flows through deckModelFromMarkdown into the same export.)
function sampleDeckModel() {
  const S = SHOWCASE;
  return {
    title: S.title,
    slides: [
      { layout: "cover", eyebrow: S.eyebrow, title: S.title, subtitle: S.subtitle },
      { layout: "bullets", title: S.contentTitle, bullets: S.bullets },
      { layout: "twocol", title: S.compareTitle, left: S.compareLeft, right: S.compareRight },
      { layout: "section", no: S.sectionNo, name: S.sectionName },
      { layout: "stat", num: S.statNum, label: S.statLabel, bars: S.bars },
      { layout: "quote", quote: S.quote, by: S.quoteBy },
    ],
  };
}

// Map a generated PPT outline (Markdown) → the same deck model the exporter uses.
// First slide → cover; the rest → bullets. Capped per slide (overflow flows onto
// a new slide) so text never overflows. Returns null when there's nothing to map.
function deckModelFromMarkdown(raw) {
  const deck = parseDeck(raw);
  if (!deck) return null;
  const capped = capDeck(deck);
  const slides = capped.map((s, i) =>
    i === 0 && s.kind === "title"
      ? { layout: "cover", eyebrow: "", title: s.title, subtitle: s.subtitle || "" }
      : { layout: "bullets", title: s.title, bullets: s.bullets || [] },
  );
  return { title: capped[0]?.title || "발표", slides };
}

// Six distinct slide archetypes, each re-skinned from the design's tokens, so a
// design's character is obvious at a glance. Uses container-query units (cqw) so
// proportions stay consistent and text never overflows regardless of size.
function showcaseSlides(theme) {
  const t = designTokens(theme);
  const tf = `'${cssFamily(theme.heading?.webFont || "Noto Sans KR")}','Noto Sans KR',sans-serif`;
  const bf = `'${cssFamily(theme.body?.webFont || "Noto Sans KR")}','Noto Sans KR',sans-serif`;
  const S = SHOWCASE;
  const esc = escapeHtml;

  // 1) Cover / title
  const cover =
    `<div class="dslide ds-cover" style="background:${t.bg};color:${t.ink}">` +
    `<span class="ds-eyebrow" style="color:${t.accent}">${esc(S.eyebrow)}</span>` +
    `<span class="ds-bar" style="background:${t.accent}"></span>` +
    `<div class="ds-title" style="font-family:${tf}">${esc(S.title)}</div>` +
    `<div class="ds-sub" style="font-family:${bf};color:${t.sub}">${esc(S.subtitle)}</div>` +
    `</div>`;

  // 2) Content with bullets
  const content =
    `<div class="dslide ds-content" style="background:${t.bg};color:${t.ink}">` +
    `<div class="ds-h" style="font-family:${tf}"><span class="ds-h-bar" style="background:${t.accent}"></span>${esc(S.contentTitle)}</div>` +
    `<ul class="ds-bullets" style="font-family:${bf}">` +
    S.bullets.map((b) => `<li><span class="ds-dot" style="background:${t.accent}"></span><span style="color:${t.ink}">${esc(b)}</span></li>`).join("") +
    `</ul></div>`;

  // 3) Two-column comparison
  const col = (data, accent) =>
    `<div class="ds-col" style="background:${accent ? t.accent : t.panel};color:${accent ? t.onAccent : t.ink}">` +
    `<div class="ds-col-h" style="font-family:${bf}">${esc(data.h)}</div>` +
    data.items.map((it) => `<div class="ds-col-item" style="font-family:${bf}">${esc(it)}</div>`).join("") +
    `</div>`;
  const compare =
    `<div class="dslide ds-cols" style="background:${t.bg};color:${t.ink}">` +
    `<div class="ds-h" style="font-family:${tf}"><span class="ds-h-bar" style="background:${t.accent}"></span>${esc(S.compareTitle)}</div>` +
    `<div class="ds-cols-grid">${col(S.compareLeft, false)}${col(S.compareRight, true)}</div>` +
    `</div>`;

  // 4) Section divider (accent color block)
  const divider =
    `<div class="dslide ds-divider" style="background:${t.accent};color:${t.onAccent}">` +
    `<div class="ds-div-num" style="font-family:${tf}">${esc(S.sectionNo)}</div>` +
    `<div class="ds-div-name" style="font-family:${tf}">${esc(S.sectionName)}</div>` +
    `</div>`;

  // 5) Data / stat (big number + simple bar chart)
  const stat =
    `<div class="dslide ds-stat" style="background:${t.bg};color:${t.ink}">` +
    `<div class="ds-stat-left">` +
    `<div class="ds-stat-num" style="font-family:${tf};color:${t.accent}">${esc(S.statNum)}</div>` +
    `<div class="ds-stat-label" style="font-family:${bf};color:${t.sub}">${esc(S.statLabel)}</div>` +
    `</div>` +
    `<div class="ds-bars">` +
    S.bars.map((h, i) => `<span class="ds-bar-col" style="height:${h}%;background:${i === S.bars.length - 1 ? t.accent : blend(t.bg, t.ink, 0.22)}"></span>`).join("") +
    `</div></div>`;

  // 6) Quote
  const quote =
    `<div class="dslide ds-quote" style="background:${t.panel};color:${t.ink}">` +
    `<span class="ds-quote-mark" style="font-family:${tf};color:${t.accent}">“</span>` +
    `<div class="ds-quote-text" style="font-family:${tf}">${esc(S.quote)}</div>` +
    `<div class="ds-quote-by" style="font-family:${bf};color:${t.sub}">${esc(S.quoteBy)}</div>` +
    `</div>`;

  return [cover, content, compare, divider, stat, quote];
}

function setupCarousel(scope, count) {
  const track = scope.querySelector(".dshow-track");
  const counter = scope.querySelector(".dshow-count");
  const dots = [...scope.querySelectorAll(".dshow-dot")];
  let i = 0;
  const go = (n) => {
    i = Math.max(0, Math.min(count - 1, n));
    track.style.transform = `translateX(-${i * 100}%)`;
    counter.textContent = `${i + 1} / ${count}`;
    dots.forEach((d, di) => d.classList.toggle("on", di === i));
  };
  scope.querySelector(".dshow-prev").onclick = () => go(i - 1);
  scope.querySelector(".dshow-next").onclick = () => go(i + 1);
  dots.forEach((d) => (d.onclick = () => go(Number(d.dataset.i))));
  go(0);
}

// Reliable per-design example modal: a flip-through showcase of 6 slide archetypes,
// re-skinned from the design's tokens (CSS-rendered, never depends on a PNG).
function openDesignModal(themeId) {
  const theme = themesById[themeId];
  if (!theme || !designModal) return;
  loadFont(theme.heading);
  loadFont(theme.body);
  const slides = showcaseSlides(theme);
  if (designModalTitle) designModalTitle.textContent = `${theme.name} — 예시`;
  designModalBody.innerHTML =
    `<div class="dshow">` +
    `<div class="dshow-viewport"><div class="dshow-track">` +
    slides.map((s) => `<div class="dshow-slide">${s}</div>`).join("") +
    `</div></div>` +
    `<div class="dshow-nav">` +
    `<button type="button" class="dshow-prev" aria-label="이전 슬라이드">‹</button>` +
    `<span class="dshow-count">1 / ${slides.length}</span>` +
    `<button type="button" class="dshow-next" aria-label="다음 슬라이드">›</button>` +
    `</div>` +
    `<div class="dshow-dots">` +
    slides.map((_, n) => `<button type="button" class="dshow-dot${n === 0 ? " on" : ""}" data-i="${n}" aria-label="${n + 1}번째 슬라이드"></button>`).join("") +
    `</div></div>`;
  designModal.dataset.theme = themeId;
  designModal.hidden = false;
  setupCarousel(designModalBody, slides.length);
}
function closeDesignModal() {
  if (designModal) designModal.hidden = true;
}
function selectPptTheme(themeId) {
  selectedPptTheme = themesById[themeId] || null;
  pptThemesEl.querySelectorAll(".theme-card").forEach((c) => c.classList.toggle("selected", c.dataset.theme === themeId));
  pptDesignStatus.textContent = selectedPptTheme ? `'${selectedPptTheme.name}' 선택됨` : "";
  if (selectedPptTheme) renderLivePreview(selectedPptTheme);
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
    `<div class="theme-card-wrap">` +
    `<button type="button" class="theme-card" data-theme="${escapeHtml(preset.id)}">${top}` +
    `<div class="theme-meta">` +
    `<div class="theme-name">${escapeHtml(preset.name)}</div>` +
    (reason ? `<div class="theme-reason">${escapeHtml(reason)}</div>` : "") +
    `<div class="theme-fontnote">${escapeHtml(tags)}</div>` +
    `</div></button>` +
    `<button type="button" class="theme-sample" data-sample-theme="${escapeHtml(preset.id)}">예시 보기</button>` +
    `</div>`
  );
}

function renderThemeCards(items) {
  pptThemesEl.innerHTML = items.map((it) => themeCard(it.preset, it.reason)).join("");
}

function resetPptDesign() {
  themesById = {};
  selectedPptTheme = null;
  pptThemesEl.innerHTML = "";
  pptPreview.hidden = true;
  pptPreview.innerHTML = "";
  pptDesignStatus.textContent = "";
  closeDesignModal();
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
  // Step ①: upload source material (for content-dependent modules).
  if (module.source && module.source.enabled) {
    steps.push({
      kind: "source",
      key: "__source__",
      question: module.source.label ? `${module.source.label} 올리기` : "자료 올리기",
      help: module.source.hint || "",
    });
  }
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

  // The source input lives in the classic form OR (during the wizard) inside its
  // first step — show the section only in classic mode and keep the element there.
  const srcEnabled = !!(module && module.source && module.source.enabled);
  sourceSection.hidden = !srcEnabled || useWizard;
  if (srcEnabled && !useWizard) mountSourceTo(sourceMount);

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

  // Special step: upload source material (photo / paste / file).
  if (s.kind === "source") {
    wizardEl.innerHTML =
      `<div class="wizard-progress"><span class="wizard-progress-text">${wizardIdx + 1} / ${total}</span><span class="wizard-bar"><i style="width:${pct}%"></i></span></div>` +
      `<h3 class="wizard-q">${escapeHtml(s.question)}</h3>` +
      help +
      `<div id="wizard-source-mount"></div>` +
      `<p class="source-note" id="wizard-source-note"></p>` +
      `<div class="wizard-actions">` +
      `<button type="button" class="btn-primary" id="wizard-next">다음</button>` +
      (wizardIdx > 0 ? `<button type="button" class="btn-ghost" id="wizard-prev">이전</button>` : "") +
      `<button type="button" class="wizard-skip" id="wizard-skip">사진·본문 없이 진행</button>` +
      `</div>` +
      `<button type="button" class="wizard-skip" id="wizard-classic">직접 입력하기</button>`;
    mountSourceTo(document.getElementById("wizard-source-mount"));
    updateSourceNote();
    document.getElementById("wizard-next").addEventListener("click", () => {
      wizardIdx += 1;
      renderWizardStep();
    });
    document.getElementById("wizard-skip").addEventListener("click", () => {
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
    return;
  }

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
  } else if (s.type === "number") {
    control = numberStepper("data-wiz", s.key, { ...s, default: cur !== "" ? cur : s.default }, "wizard-input");
  } else if (s.type === "counts") {
    control = countsControl("data-wiz", s.key, s, "wizard-input");
  } else if (s.type === "textarea") {
    control = `<textarea class="wizard-input" id="wizard-input" maxlength="3000" placeholder="${escapeHtml(s.placeholder || "")}">${escapeHtml(String(cur))}</textarea>`;
  } else {
    control = `<input class="wizard-input" id="wizard-input" type="text" maxlength="3000" placeholder="${escapeHtml(s.placeholder || "")}" value="${escapeHtml(String(cur))}">`;
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

  refreshAllCounts(wizardEl);

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
    if (inp && inp.type !== "hidden") inp.focus();
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
      let shown;
      let empty;
      if (s.kind === "source") {
        const n = sourceInput.count();
        const hasTxt = sourceInput.hasText();
        empty = !n && !hasTxt;
        shown = empty
          ? "없음 (주제 기반으로 생성)"
          : [n ? `사진·파일 ${n}개` : "", hasTxt ? "본문 붙여넣음" : ""].filter(Boolean).join(" + ");
      } else {
        const v = wizardValues[s.key];
        empty = v === undefined || v === "" || v === stepSkipValue(s);
        shown = v === undefined || v === "" ? "기본값으로 진행" : String(v);
      }
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
    if (s.kind === "source") continue; // material is read straight from the component
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
  // Switching tools clears the previous tool's result (and its format-specific
  // export bars) so nothing stale lingers across modules.
  resetOutput();
  if (moduleIntro) moduleIntro.textContent = current ? `이 도구로 ${josa(current.name, "을/를")} 만들어 드려요.` : "";
  modulePurpose.textContent = current?.purpose ?? "";
  moduleDesc.textContent = current?.description ?? "";
  renderGuide(current);
  renderOptions(current);

  // Source-material input (reusable across content-dependent modules).
  const src = current?.source;
  if (src?.enabled) {
    sourceLabel.textContent = src.label || "자료";
    sourceHint.textContent = src.hint || "";
    sourceInput.reset();
    mountSourceTo(sourceMount);
    updateSourceNote();
  } else {
    sourceInput.reset();
  }

  const isPpt = current?.id === "ppt";
  pptDesign.hidden = !isPpt;
  if (!isPpt) resetPptDesign();

  const hasGuide = (current?.guide ?? []).length > 0;
  inputLabel.textContent = hasGuide ? "더 부탁할 내용 (선택)" : "무엇을 만들까요?";
  inputEl.placeholder = hasGuide
    ? "예: 비교급 문법을 강조해 주세요 (없으면 비워 두셔도 돼요)"
    : current?.inputPlaceholder || defaultInputPlaceholder;

  // Plain-language action button: "시험지 만들기", "단어장 만들기" …
  if (submitBtn) submitBtn.textContent = current ? `${current.name} 만들기` : "만들기";

  // PPT has its own per-design "예시 보기" in the 디자인 고르기 section, so the
  // generic bottom "예시 보기" (the static-sample deck, which renders poorly for
  // PPT) is removed here. Other modules keep it.
  if (demoBtn) demoBtn.hidden = current?.id === "ppt";

  // Default input mode per guidance: guided → step-by-step wizard, lite → compact form.
  classicMode = guidanceLevel === "lite";
  applyInputMode(current);

  // A1 sample preview + A2 restore any autosaved draft for this module.
  if (current) {
    updateSamplePreview(current.id);
    restoreDraft(current.id);
  } else {
    samplePreview.hidden = true;
    draftNote.hidden = true;
  }
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
    `<span class="card-sample" data-sample="${escapeHtml(m.id)}" role="button" tabindex="0">이런 게 나와요</span>` +
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
    cardsStatus.textContent = "목록을 불러오지 못했어요. 잠시 후 새로고침해 주세요.";
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
    clearLoadingTimers();
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
    showError(`'${missing.label}'${particleOf(missing.label, "을/를")} 입력해 주세요.`);
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

  // Source material (photo / paste / file) for content-dependent modules.
  const srcEnabled = !!current?.source?.enabled;
  const attachments = srcEnabled ? sourceInput.getAttachments() : [];
  const sourceText = srcEnabled ? sourceInput.getSourceText() : "";
  const hasMaterial = attachments.length > 0 || !!sourceText;

  if (!input.trim() && !hasMaterial) {
    showError("요청 내용을 입력하거나 자료(사진·본문)를 올려주세요.");
    return;
  }

  setGenerating(true);
  setStatus("만드는 중…");
  // Match the loading note to the task weight (same rules the server routes by).
  const weight = taskWeight(module, gatherOptions().difficulty, input.length + sourceText.length);
  startLoading(weight);
  controller = new AbortController();

  try {
    const body = { module, input, options: gatherOptions() };
    if (sourceText) body.sourceText = sourceText;
    if (attachments.length) body.attachments = attachments;
    const res = await fetch("/api/generate/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "잠시 문제가 생겼어요. 잠시 후 다시 시도해 주세요.");
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
        setStatus("다 만들었어요 ✓");
        copyBtn.hidden = raw.length === 0;
        clearDraft(module); // saved successfully — drop the autosaved draft
      } else if (evt.type === "error") {
        finished = true;
        hadError = true;
        showError(evt.error);
        setStatus("문제가 생겼어요");
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
      showResultActions(current?.id);
      showDocControls(current?.id);
      maybeAutoFeedback(current?.id);
      saveHistoryEntry(current, raw); // add to the left history sidebar
    }
  } catch (err) {
    if (err.name === "AbortError") {
      revealOutputOnce();
      renderNow();
      copyBtn.hidden = raw.length === 0;
      setStatus("멈췄어요");
      showResultActions(current?.id);
      showDocControls(current?.id);
      if (raw.trim()) saveHistoryEntry(current, raw); // keep the partial result
    } else {
      showError("연결이 고르지 않아요. 인터넷 상태를 확인하고 다시 시도해 주세요.");
      setStatus("문제가 생겼어요");
    }
  } finally {
    stopLoading();
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
    if (!res.ok) throw new Error("예시를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    const data = await res.json();
    raw = data.content || "";
    outputEl.hidden = false;
    renderNow();
    copyBtn.hidden = raw.length === 0;
    setStatus("예시 미리보기 (실제 생성 결과가 아닙니다)");
    if (raw.trim()) {
      await showPreview(id);
      showDocControls(id); // sample is exportable to .docx now (no API key needed)
    }
  } catch (err) {
    showError("예시를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    setStatus("");
  }
}

async function checkHealth() {
  try {
    const res = await fetch("/health");
    const data = await res.json();
    if (data.generation === "disabled") {
      demoBanner.textContent =
        "지금은 둘러보기 모드예요. '예시 보기'를 누르면 어떤 결과가 나오는지 미리 볼 수 있어요.";
      demoBanner.hidden = false;
    }
  } catch {
    /* ignore */
  }
}

/* ---------- C10: text-size toggle (가− / 가＋) ---------- */
const TEXT_KEY = "aio_textsize";
const TEXT_LEVELS = [100, 113, 128]; // root font-size %
const textSmallerBtn = document.getElementById("text-smaller");
const textLargerBtn = document.getElementById("text-larger");
let textLevel = 0;
function applyTextSize(level) {
  textLevel = Math.max(0, Math.min(TEXT_LEVELS.length - 1, level));
  document.documentElement.style.fontSize = TEXT_LEVELS[textLevel] + "%";
  try {
    localStorage.setItem(TEXT_KEY, String(textLevel));
  } catch {
    /* ignore */
  }
  if (textSmallerBtn) textSmallerBtn.disabled = textLevel === 0;
  if (textLargerBtn) textLargerBtn.disabled = textLevel === TEXT_LEVELS.length - 1;
}
function initTextSize() {
  let saved = 0;
  try {
    saved = Number(localStorage.getItem(TEXT_KEY)) || 0;
  } catch {
    saved = 0;
  }
  applyTextSize(saved);
}
textSmallerBtn?.addEventListener("click", () => applyTextSize(textLevel - 1));
textLargerBtn?.addEventListener("click", () => applyTextSize(textLevel + 1));

/* ---------- A4: friendly "generating" state ---------- */
let loadingTimers = [];
function clearLoadingTimers() {
  loadingTimers.forEach(clearTimeout);
  loadingTimers = [];
}
function startLoading(weight) {
  resultActions.hidden = true;
  loadingEl.hidden = false;
  // Heavier (Opus) tasks set the expectation that they take a bit longer.
  const heavy = weight === "heavy";
  loadingMsg.textContent = heavy ? "더 꼼꼼하게 만드는 중이라 조금 더 걸려요" : "만들고 있어요…";
  loadingSub.textContent = heavy ? "정확도를 위해 더 좋은 AI가 만들고 있어요" : "보통 30초쯤 걸려요";
  clearLoadingTimers();
  // Cold start (Render free tier spins down) → reassure if nothing has come back yet.
  loadingTimers.push(
    setTimeout(() => {
      loadingSub.textContent = "처음이라 조금 더 걸릴 수 있어요. 잠시만요!";
    }, 8000),
  );
  loadingTimers.push(
    setTimeout(() => {
      loadingMsg.textContent = "거의 다 됐어요…";
      loadingSub.textContent = "내용이 길면 시간이 더 걸려요. 조금만 기다려 주세요.";
    }, 22000),
  );
}

// Mirror of src/routing.ts taskWeight (module base tier + 난이도 + input size) —
// only used to choose the loading note. The model itself is chosen server-side.
function taskWeight(moduleId, difficulty, inputLen) {
  const m = modules.find((x) => x.id === moduleId);
  let tier = (m && m.tier) || "standard";
  if (difficulty === "상") tier = "heavy";
  else if (difficulty === "하") tier = tier === "heavy" ? "standard" : tier;
  if ((inputLen || 0) > 12000 && tier !== "heavy") tier = "heavy";
  return tier === "heavy" ? "heavy" : "light";
}
function stopLoading() {
  clearLoadingTimers();
  loadingEl.hidden = true;
}

/* ---------- A3: result actions (download / tweak) ---------- */
function showResultActions(moduleId) {
  if (!raw.trim()) {
    resultActions.hidden = true;
    return;
  }
  // PPT → editable .pptx. Document modules → .docx (its own bar, see showDocControls).
  // The plain .txt download is gone entirely.
  const isPpt = moduleId === "ppt";
  if (downloadPptxBtn) downloadPptxBtn.hidden = !isPpt;
  if (pptxHint) pptxHint.hidden = !isPpt;
  if (downloadTextBtn) downloadTextBtn.hidden = true;
  resultActions.hidden = false;
}

// Document export controls (paper size + .docx / PDF). Shown for every document
// module (not PPT) whenever there's content — including the static sample, so it
// is fully testable without an API key.
// Format policy: 자소서·이력서 → 편집용 Word/한글(.docx/.hwpx). 엑셀 → 진짜 .xlsx.
// 그 외 문서 모듈 → 디자인된 PDF(서버 렌더). 시험지는 전용 B4 PDF 바, PPT는 .pptx.
const WORD_MODULES = new Set(["resume", "cover-letter"]);
const XLSX_MODULES = new Set(["excel"]);
const PDF_DOC_MODULES = new Set(["vocabulary", "study-notes", "quiz", "worksheet", "lesson-plan", "creative-writing"]);
function showDocControls(moduleId) {
  if (!docExport) return;
  const show = isDocModule(moduleId) && raw.trim();
  docExport.hidden = !show;
  if (!show) return;
  const isWord = WORD_MODULES.has(moduleId);
  const isXlsx = XLSX_MODULES.has(moduleId);
  const isPdfDoc = PDF_DOC_MODULES.has(moduleId);
  if (downloadDesignPdfBtn) downloadDesignPdfBtn.hidden = !isPdfDoc;
  if (downloadXlsxBtn) downloadXlsxBtn.hidden = !isXlsx;
  if (downloadDocxBtn) downloadDocxBtn.hidden = !isWord;
  if (downloadHwpxBtn) downloadHwpxBtn.hidden = !isWord;
  if (downloadDocPdfBtn) downloadDocPdfBtn.hidden = !isWord; // browser-print stays a word-doc extra
  const paperRow = paperChips?.closest(".doc-paper");
  if (paperRow) paperRow.hidden = !isWord;
  if (docExportNote)
    docExportNote.textContent = isWord
      ? "둘 다 편집할 수 있어요 — .docx는 Word·구글 문서에서, .hwpx는 한글(HWP)에서 열립니다."
      : isXlsx
        ? "예시 데이터와 살아있는 수식이 들어간 진짜 엑셀 파일이에요 — 엑셀·구글 시트에서 바로 열립니다."
        : "주제에 어울리는 디자인으로 인쇄용 PDF를 만들어 드려요. (컬러·흑백 모두 선명)";
}

function sanitizeFilename(s) {
  return (
    String(s || "")
      .replace(/[^\w가-힣 .-]/g, "")
      .trim()
      .slice(0, 40) || "결과"
  );
}
function downloadResultText() {
  if (!raw.trim()) return;
  const g = gatherGuide();
  const current = getCurrentModule();
  const base = sanitizeFilename(g.subject || g.topic || current?.name || "결과");
  const blob = new Blob([raw], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${base}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function tweakAndRetry() {
  location.hash = "#generate";
  form.scrollIntoView({ behavior: "smooth", block: "start" });
  setStatus("설정을 조금 바꾼 뒤 '만들기'를 다시 눌러 주세요.");
}

/* ---------- A2: auto-save form input ---------- */
const DRAFT_PREFIX = "aio_draft_";
let draftTimer = 0;
function moduleHasSource() {
  const m = getCurrentModule();
  return !!(m && m.source && m.source.enabled);
}
function collectFormState() {
  const counts = {};
  guideFieldsEl.querySelectorAll(".counts").forEach((c) => {
    const hidden = c.querySelector("input[type='hidden'][data-guide-key]");
    if (!hidden) return;
    const items = {};
    c.querySelectorAll(".count-item").forEach((inp) => {
      items[inp.dataset.countItem] = inp.value;
    });
    counts[hidden.getAttribute("data-guide-key")] = items;
  });
  return {
    v: 1,
    guide: gatherGuide(),
    options: gatherOptions(),
    counts,
    extra: inputEl.value,
    sourceText: moduleHasSource() ? sourceInput.getSourceText() : "",
    ts: Date.now(),
  };
}
function scheduleSaveDraft() {
  const id = moduleSelect.value;
  if (!id) return;
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    try {
      localStorage.setItem(DRAFT_PREFIX + id, JSON.stringify(collectFormState()));
    } catch {
      /* storage may be full/blocked; ignore */
    }
  }, 400);
}
function clearDraft(id) {
  try {
    localStorage.removeItem(DRAFT_PREFIX + id);
  } catch {
    /* ignore */
  }
  draftNote.hidden = true;
}
function setKeyedValue(scope, attr, key, value) {
  const el = scope.querySelector(`[${attr}="${key}"]`);
  if (!el) return;
  el.value = value;
  const chips = el.parentElement && el.parentElement.querySelector(".chips");
  if (chips) chips.querySelectorAll(".chip").forEach((b) => b.classList.toggle("active", b.dataset.chip === String(value)));
}
function applyFormState(state) {
  if (!state) return;
  for (const [k, v] of Object.entries(state.guide || {})) setKeyedValue(guideFieldsEl, "data-guide-key", k, v);
  for (const [k, v] of Object.entries(state.options || {})) setKeyedValue(moduleOptionsEl, "data-opt-key", k, v);
  for (const [fk, items] of Object.entries(state.counts || {})) {
    const hidden = guideFieldsEl.querySelector(`.counts input[type='hidden'][data-guide-key="${fk}"]`);
    const c = hidden && hidden.closest(".counts");
    if (!c) continue;
    for (const [ik, val] of Object.entries(items)) {
      const inp = c.querySelector(`.count-item[data-count-item="${ik}"]`);
      if (inp) inp.value = val;
    }
    refreshCounts(c);
  }
  if (typeof state.extra === "string") inputEl.value = state.extra;
}
function restoreDraft(id) {
  let saved = null;
  try {
    saved = localStorage.getItem(DRAFT_PREFIX + id);
  } catch {
    saved = null;
  }
  if (!saved) {
    draftNote.hidden = true;
    return;
  }
  let state;
  try {
    state = JSON.parse(saved);
  } catch {
    draftNote.hidden = true;
    return;
  }
  applyFormState(state);
  if (state.sourceText && moduleHasSource()) {
    sourceInput.setSourceText(state.sourceText);
    updateSourceNote();
  }
  const meaningful =
    Object.values(state.guide || {}).some((v) => String(v).trim()) ||
    String(state.extra || "").trim() ||
    String(state.sourceText || "").trim();
  draftNote.hidden = !meaningful;
}

/* ---------- Left history sidebar (client-side, localStorage) ---------- */
// Claude/Gemini-style history. No login here, so entries live in this browser.
const HISTORY_KEY = "aio_history_v1";
const HISTORY_MAX = 40;
const sidebarToggle = document.getElementById("sidebar-toggle");
const sidebarBackdrop = document.getElementById("sidebar-backdrop");
const sidebarNewBtn = document.getElementById("sidebar-new");
const historyListEl = document.getElementById("history-list");
const historyEmptyEl = document.getElementById("history-empty");
const mqMobile = window.matchMedia("(max-width: 860px)");
let activeHistoryId = null;

function loadHistory() {
  try {
    const a = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}
function persistHistory(list) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
    return true;
  } catch {
    // Quota exceeded → drop oldest entries until it fits.
    let trimmed = list.slice();
    while (trimmed.length > 1) {
      trimmed = trimmed.slice(0, trimmed.length - 1);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
        return true;
      } catch {
        /* keep trimming */
      }
    }
    return false;
  }
}
function uid() {
  return "h" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function historyTitleFrom(state, content, fallback) {
  const g = (state && state.guide) || {};
  const cand =
    g.subject || g.topic || g.title || g.goal || g.scope || g.words || (state && state.extra) || "";
  let t = String(cand).split("\n")[0].trim();
  if (!t) {
    const m = (content || "").match(/^#{1,3}\s+(.+)$/m);
    t = m ? m[1].trim() : "";
  }
  t = t.replace(/[*#`>_]/g, "").trim().slice(0, 60);
  return t || fallback || "결과";
}
function saveHistoryEntry(moduleObj, content) {
  if (!moduleObj || !content || !content.trim()) return;
  const state = collectFormState();
  const item = {
    id: uid(),
    ts: Date.now(),
    module: moduleObj.id,
    moduleName: moduleObj.name,
    title: historyTitleFrom(state, content, moduleObj.name),
    content,
    state: {
      guide: state.guide,
      options: state.options,
      counts: state.counts,
      extra: state.extra,
      sourceText: state.sourceText,
    },
    docPaper,
  };
  let list = loadHistory();
  list.unshift(item);
  if (list.length > HISTORY_MAX) list = list.slice(0, HISTORY_MAX);
  persistHistory(list);
  activeHistoryId = item.id;
  renderHistory();
}
function updateActiveHistoryContent(content) {
  if (!activeHistoryId || !content) return;
  const list = loadHistory();
  const it = list.find((x) => x.id === activeHistoryId);
  if (!it) return;
  it.content = content;
  persistHistory(list);
}
function relTime(ts) {
  const min = Math.floor((Date.now() - ts) / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const dt = new Date(ts);
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
}
function dayStart(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function groupLabel(ts) {
  const diff = Math.round((dayStart(Date.now()) - dayStart(ts)) / 86400000);
  if (diff <= 0) return "오늘";
  if (diff === 1) return "어제";
  if (diff <= 7) return "지난 7일";
  if (diff <= 30) return "지난 30일";
  return "이전";
}
function renderHistory() {
  if (!historyListEl) return;
  const list = loadHistory();
  historyListEl.innerHTML = "";
  if (historyEmptyEl) historyEmptyEl.hidden = list.length > 0;
  let lastLabel = null;
  for (const it of list) {
    const label = groupLabel(it.ts);
    if (label !== lastLabel) {
      const h = document.createElement("div");
      h.className = "history-group-label";
      h.textContent = label;
      historyListEl.appendChild(h);
      lastLabel = label;
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "history-item" + (it.id === activeHistoryId ? " active" : "");
    btn.dataset.id = it.id;
    const title = document.createElement("span");
    title.className = "hi-title";
    title.textContent = it.title;
    const meta = document.createElement("span");
    meta.className = "hi-meta";
    meta.textContent = `${it.moduleName} · ${relTime(it.ts)}`;
    const actions = document.createElement("span");
    actions.className = "hi-actions";
    const ren = document.createElement("button");
    ren.type = "button";
    ren.className = "hi-act";
    ren.dataset.act = "rename";
    ren.title = "이름 바꾸기";
    ren.textContent = "✎";
    const del = document.createElement("button");
    del.type = "button";
    del.className = "hi-act";
    del.dataset.act = "delete";
    del.title = "삭제";
    del.textContent = "🗑";
    actions.append(ren, del);
    btn.append(title, meta, actions);
    historyListEl.appendChild(btn);
  }
}
function renameHistory(id) {
  const list = loadHistory();
  const it = list.find((x) => x.id === id);
  if (!it) return;
  const next = window.prompt("이름 바꾸기", it.title);
  if (next == null) return;
  it.title = next.trim().slice(0, 80) || it.title;
  persistHistory(list);
  renderHistory();
}
function deleteHistory(id) {
  const list = loadHistory();
  const it = list.find((x) => x.id === id);
  if (it && !window.confirm(`'${it.title}' 기록을 삭제할까요?`)) return;
  persistHistory(list.filter((x) => x.id !== id));
  if (activeHistoryId === id) activeHistoryId = null;
  renderHistory();
}
function restoreHistoryItem(id) {
  const item = loadHistory().find((x) => x.id === id);
  if (!item) return;
  if (!modules.find((x) => x.id === item.module)) {
    showError("이 기록의 도구를 찾을 수 없어요.");
    return;
  }
  location.hash = "#generate";
  moduleSelect.value = item.module;
  updateModuleDesc(); // rebuild guide/options fields for this module
  applyFormState(item.state); // override with the saved inputs
  if (item.state && item.state.sourceText && moduleHasSource()) {
    sourceInput.setSourceText(item.state.sourceText);
    updateSourceNote();
  }
  draftNote.hidden = true;
  if (item.docPaper) {
    docPaper = item.docPaper;
    paperChips?.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c.dataset.paper === docPaper));
  }
  clearError();
  raw = item.content || "";
  revealOutputOnce();
  renderNow();
  copyBtn.hidden = raw.length === 0;
  setStatus("이전 기록을 불러왔어요");
  activeHistoryId = id;
  renderHistory();
  showPreview(item.module).then(() => {
    showResultActions(item.module);
    showDocControls(item.module);
  });
  if (mqMobile.matches) closeSidebarMobile();
}
historyListEl?.addEventListener("click", (e) => {
  const actBtn = e.target.closest(".hi-act");
  const item = e.target.closest(".history-item");
  if (!item) return;
  const id = item.dataset.id;
  if (actBtn) {
    e.stopPropagation();
    if (actBtn.dataset.act === "rename") renameHistory(id);
    else if (actBtn.dataset.act === "delete") deleteHistory(id);
    return;
  }
  restoreHistoryItem(id);
});

/* sidebar open / close */
function openSidebarMobile() {
  document.body.classList.add("sidebar-open");
  if (sidebarBackdrop) sidebarBackdrop.hidden = false;
}
function closeSidebarMobile() {
  document.body.classList.remove("sidebar-open");
  if (sidebarBackdrop) sidebarBackdrop.hidden = true;
}
function toggleSidebar() {
  if (mqMobile.matches) {
    if (document.body.classList.contains("sidebar-open")) closeSidebarMobile();
    else openSidebarMobile();
  } else {
    const collapsed = document.body.classList.toggle("sidebar-collapsed");
    try {
      localStorage.setItem("aio_sidebar_collapsed", collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }
}
sidebarToggle?.addEventListener("click", toggleSidebar);
sidebarBackdrop?.addEventListener("click", closeSidebarMobile);
sidebarNewBtn?.addEventListener("click", () => {
  activeHistoryId = null;
  resetOutput();
  setStatus("");
  clearError();
  location.hash = "#generate";
  renderHistory();
  if (mqMobile.matches) closeSidebarMobile();
  else inputEl?.focus();
});
// Desktop: restore the collapsed preference. (Mobile drawer always starts closed.)
if (!mqMobile.matches && localStorage.getItem("aio_sidebar_collapsed") === "1") {
  document.body.classList.add("sidebar-collapsed");
}
renderHistory();

/* ---------- A1: sample preview ("이런 게 나와요") ---------- */
const sampleCache = new Map();
async function fetchSample(id) {
  if (sampleCache.has(id)) return sampleCache.get(id);
  let content = "";
  try {
    const res = await fetch(`/api/modules/${encodeURIComponent(id)}/sample`);
    if (res.ok) content = (await res.json()).content || "";
  } catch {
    content = "";
  }
  sampleCache.set(id, content);
  return content;
}
async function updateSamplePreview(id) {
  const content = await fetchSample(id);
  if (moduleSelect.value !== id) return; // module changed while fetching
  if (!content.trim()) {
    samplePreview.hidden = true;
    return;
  }
  const snippet = content.split("\n").slice(0, 8).join("\n").slice(0, 600);
  sampleSnippet.innerHTML = DOMPurify.sanitize(marked.parse(snippet));
  samplePreview.hidden = false;
}
async function openSampleModal(id) {
  const m = modules.find((x) => x.id === id);
  sampleModalTitle.textContent = m ? `${m.name} — 이런 게 나와요` : "이런 게 나와요";
  sampleModalBody.innerHTML = "<p class='hint'>예시를 불러오는 중…</p>";
  sampleModal.dataset.module = id;
  sampleModal.hidden = false;
  const content = await fetchSample(id);
  sampleModalBody.innerHTML = content.trim()
    ? DOMPurify.sanitize(marked.parse(content))
    : "<p class='hint'>이 도구의 예시는 곧 추가돼요.</p>";
}
function closeSampleModal() {
  sampleModal.hidden = true;
}

/* ---------- Wiring ---------- */
form.addEventListener("submit", generate);
form.addEventListener("input", scheduleSaveDraft);
form.addEventListener("change", scheduleSaveDraft);
downloadTextBtn?.addEventListener("click", downloadResultText);
tweakBtn.addEventListener("click", tweakAndRetry);

// Editable .pptx export (client-side). Reuses the chosen design + the same
// builder for sample and AI content.
async function runPptxExport(btn, deckModel, theme, filename) {
  if (!deckModel || !deckModel.slides || !deckModel.slides.length) {
    showError("내보낼 슬라이드가 없어요. 먼저 발표를 만들어 주세요.");
    return;
  }
  const label = btn ? btn.textContent : "";
  if (btn) {
    btn.disabled = true;
    btn.textContent = "PPT 파일 만드는 중…";
  }
  try {
    await exportPptx(deckModel, theme || DEFAULT_DECK_THEME, filename);
  } catch (err) {
    console.error("[pptx] export failed:", err);
    showError("PPT 파일을 만들지 못했어요. 잠시 후 다시 시도해 주세요.");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = label;
    }
  }
}
downloadPptxBtn?.addEventListener("click", () => {
  const model = deckModelFromMarkdown(raw) || sampleDeckModel();
  runPptxExport(downloadPptxBtn, model, selectedPptTheme || DEFAULT_DECK_THEME, model.title);
});

/* ---------- Document export (.docx / PDF) ---------- */
// Render the current result Markdown to a detached, sanitized DOM the exporters
// walk — independent of the on-screen view state.
function renderedDocEl() {
  const el = document.createElement("div");
  el.innerHTML = DOMPurify.sanitize(marked.parse(raw || ""));
  return el;
}
function docTitleFromRaw() {
  const el = renderedDocEl();
  const h = el.querySelector("h1, h2, h3");
  const g = gatherGuide();
  return (
    (h && h.textContent.trim()) ||
    (g.subject || g.topic || getCurrentModule()?.name || "문서").toString().trim() ||
    "문서"
  );
}
// Paper-size chips → update state + (if the doc preview is showing) re-render it
// at the new page size so preview and export stay in sync.
paperChips?.addEventListener("click", (e) => {
  const chip = e.target.closest(".chip[data-paper]");
  if (!chip) return;
  docPaper = chip.dataset.paper;
  paperChips.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c === chip));
  if (previewKind === "doc") showDoc(getCurrentModule()?.id);
});
// Exam PDF variant: 교사용(full) / 학생용(questions only) / 정답지(OMR).
examVariantChips?.addEventListener("click", (e) => {
  const chip = e.target.closest(".chip[data-variant]");
  if (!chip) return;
  examVariant = chip.dataset.variant;
  examVariantChips.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c === chip));
});
// Shared runner for document exports (.docx / .hwpx) — same content source +
// paper size, so the two formats come out equivalent.
async function runDocExport(btn, fn, kind) {
  if (!raw.trim()) {
    showError("내려받을 내용이 없어요. 먼저 만들어 주세요.");
    return;
  }
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = `${kind} 파일 만드는 중…`;
  if (docExportStatus) docExportStatus.textContent = "";
  try {
    await fn(renderedDocEl(), { paper: docPaper, title: docTitleFromRaw() });
  } catch (err) {
    console.error(`[${kind}] export failed:`, err);
    if (docExportStatus) docExportStatus.textContent = `${kind} 파일을 만들지 못했어요. 잠시 후 다시 시도해 주세요.`;
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
}
downloadDocxBtn?.addEventListener("click", () => runDocExport(downloadDocxBtn, exportDocx, "Word"));
downloadHwpxBtn?.addEventListener("click", () => runDocExport(downloadHwpxBtn, exportHwpx, "한글"));
// 진짜 엑셀 파일(.xlsx) — 예시 데이터 + 살아있는 수식 (클라이언트 네이티브 빌드).
downloadXlsxBtn?.addEventListener("click", async () => {
  if (!raw.trim()) return;
  const label = downloadXlsxBtn.textContent;
  downloadXlsxBtn.disabled = true;
  docExportStatus.textContent = "엑셀 파일 만드는 중…";
  try {
    const { exportXlsx } = await import("./xlsx.js");
    const title = docTitleFromRaw();
    await exportXlsx(raw, title, sanitizeFilename(title));
    docExportStatus.textContent = "내려받기 완료";
    setTimeout(() => (docExportStatus.textContent = ""), 2500);
  } catch (err) {
    console.error("[xlsx] export failed:", err);
    docExportStatus.textContent = "엑셀 파일을 만들지 못했어요. 잠시 후 다시 시도해 주세요.";
  } finally {
    downloadXlsxBtn.disabled = false;
    downloadXlsxBtn.textContent = label;
  }
});
// Designed PDF (server WeasyPrint) — 단어장·학습노트·퀴즈·학습지·지도안·소설.
downloadDesignPdfBtn?.addEventListener("click", async () => {
  if (!raw.trim()) return;
  const moduleId = getCurrentModule()?.id;
  const label = downloadDesignPdfBtn.textContent;
  downloadDesignPdfBtn.disabled = true;
  docExportStatus.textContent = "PDF 만드는 중…";
  try {
    const title = docTitleFromRaw();
    const g = gatherGuide();
    const subtitle = [g.subject, g.topic, g.unit].filter(Boolean).join(" · ");
    const res = await fetch("/api/doc/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module: moduleId, markdown: raw, title, subtitle }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      docExportStatus.textContent = d.error || "PDF 생성에 실패했어요.";
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = sanitizeFilename(title) + ".pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    docExportStatus.textContent = "내려받기 완료";
    setTimeout(() => (docExportStatus.textContent = ""), 2500);
  } catch {
    docExportStatus.textContent = "PDF 생성에 실패했어요.";
  } finally {
    downloadDesignPdfBtn.disabled = false;
    downloadDesignPdfBtn.textContent = label;
  }
});
// "PDF로 저장" — browser print of a clean, paper-sized copy (no Python). The user
// chooses "PDF로 저장" in the print dialog.
downloadDocPdfBtn?.addEventListener("click", () => {
  if (!raw.trim()) return;
  const sizeCss = docPaper === "letter" ? "letter" : docPaper === "b5" ? "B5" : "A4";
  const title = docTitleFromRaw();
  const win = window.open("", "_blank");
  if (!win) {
    if (docExportStatus) docExportStatus.textContent = "팝업이 차단됐어요. 팝업을 허용한 뒤 다시 시도해 주세요.";
    return;
  }
  const body = DOMPurify.sanitize(marked.parse(raw || ""));
  win.document.write(
    `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${title.replace(/[<>]/g, "")}</title>` +
      `<style>@page{size:${sizeCss};margin:18mm}` +
      `body{font-family:'맑은 고딕','Malgun Gothic','Apple SD Gothic Neo',sans-serif;color:#22252b;line-height:1.7;font-size:11pt}` +
      `h1{color:#192744;font-size:18pt;margin:0 0 .4em}h2{color:#192744;font-size:14pt;margin:1em 0 .35em}h3{color:#192744;font-size:12pt;margin:.9em 0 .3em}` +
      `table{border-collapse:collapse;width:100%;margin:.6em 0}th,td{border:1px solid #d8d2c4;padding:6px 9px;text-align:left;vertical-align:top}` +
      `thead th{background:#192744;color:#fff}ul,ol{padding-left:1.3em}li{margin:.2em 0}blockquote{margin:.5em 0;padding:.4em .9em;border-left:3px solid #a8894e;background:#f3ecdc}` +
      `</style></head><body>${body}</body></html>`,
  );
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
});
draftNewBtn.addEventListener("click", () => {
  clearDraft(moduleSelect.value);
  updateModuleDesc(); // re-render with defaults (no draft to restore)
});
sampleExpandBtn.addEventListener("click", () => {
  loadSample();
  document.querySelector(".output-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
});
sampleModalClose.addEventListener("click", closeSampleModal);
sampleModal.addEventListener("click", (e) => {
  if (e.target === sampleModal) closeSampleModal();
});
sampleModalMake.addEventListener("click", () => {
  const id = sampleModal.dataset.module;
  if (id) {
    moduleSelect.value = id;
    updateModuleDesc();
  }
  closeSampleModal();
  location.hash = "#generate";
});
demoBtn.addEventListener("click", loadSample);
toWizardBtn.addEventListener("click", () => {
  classicMode = false;
  applyInputMode(getCurrentModule());
});
pptRecommendBtn.addEventListener("click", recommendPptThemes);
pptAllBtn.addEventListener("click", showAllThemes);
pptThemesEl.addEventListener("click", (e) => {
  const sample = e.target.closest("[data-sample-theme]");
  if (sample) {
    openDesignModal(sample.dataset.sampleTheme);
    return;
  }
  const card = e.target.closest("[data-theme]");
  if (!card) return;
  selectPptTheme(card.dataset.theme);
});
// Design example modal wiring
designModalClose?.addEventListener("click", closeDesignModal);
designModal?.addEventListener("click", (e) => {
  if (e.target === designModal) closeDesignModal();
});
designModalPick?.addEventListener("click", () => {
  const id = designModal.dataset.theme;
  if (id) selectPptTheme(id);
  closeDesignModal();
});
designModalPptxBtn?.addEventListener("click", () => {
  const theme = themesById[designModal.dataset.theme] || DEFAULT_DECK_THEME;
  runPptxExport(designModalPptxBtn, sampleDeckModel(), theme, "샘플 발표");
});
// Arrow keys page the showcase carousel while the modal is open.
document.addEventListener("keydown", (e) => {
  if (!designModal || designModal.hidden) return;
  if (e.key === "ArrowLeft") designModalBody.querySelector(".dshow-prev")?.click();
  else if (e.key === "ArrowRight") designModalBody.querySelector(".dshow-next")?.click();
  else if (e.key === "Escape") closeDesignModal();
});
// Live-update the inline preview as the user edits the PPT topic/message/audience.
form.addEventListener("input", (e) => {
  if (getCurrentModule()?.id === "ppt" && selectedPptTheme && e.target.closest("#guide-fields")) {
    renderLivePreview(selectedPptTheme);
  }
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
  const sample = e.target.closest("[data-sample]");
  if (sample) {
    e.preventDefault();
    openSampleModal(sample.dataset.sample);
    return;
  }
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
examPdfBtn.addEventListener("click", downloadExamPdf);
examReviewBtn.addEventListener("click", runReview);
examReviewApply.addEventListener("click", applyReviewFix);

/* ---------- D15: post-use feedback survey ---------- */
const feedbackModal = document.getElementById("feedback-modal");
const feedbackClose = document.getElementById("feedback-close");
const feedbackSubmit = document.getElementById("feedback-submit");
const feedbackStatus = document.getElementById("feedback-status");
const feedbackOpenBtn = document.getElementById("feedback-open");
const fbStars = document.getElementById("fb-stars");
const fbComment = document.getElementById("fb-comment");
const feedbackNudge = document.getElementById("feedback-nudge");
const fbNudgeOpen = document.getElementById("fb-nudge-open");
const fbNudgeLater = document.getElementById("fb-nudge-later");
const fbNudgeClose = document.getElementById("fb-nudge-close");
let fbState = { rating: null, usable: null, easyForm: null, reuse: null };

function resetFeedback() {
  fbState = { rating: null, usable: null, easyForm: null, reuse: null };
  fbStars.querySelectorAll(".fb-star").forEach((b) => b.classList.remove("on"));
  feedbackModal.querySelectorAll(".fb-choices .chip").forEach((c) => c.classList.remove("active"));
  if (fbComment) fbComment.value = "";
  feedbackStatus.textContent = "";
}
function openFeedback(moduleId) {
  resetFeedback();
  feedbackModal.dataset.module = moduleId || getCurrentModule()?.id || "";
  feedbackModal.hidden = false;
}
function closeFeedback() {
  feedbackModal.hidden = true;
}
function hideNudge() {
  if (feedbackNudge) feedbackNudge.hidden = true;
}
function dismissNudge() {
  hideNudge();
  try {
    sessionStorage.setItem("aio_fb_done", "1"); // dismissed → don't nag again this session
  } catch {
    /* ignore */
  }
}
// After a real result, show a small NON-blocking nudge (never covers the result),
// slightly delayed, at most once per session, easily dismissed.
function maybeAutoFeedback(moduleId) {
  if (!feedbackNudge) return;
  try {
    if (sessionStorage.getItem("aio_fb_shown") || sessionStorage.getItem("aio_fb_done")) return;
    sessionStorage.setItem("aio_fb_shown", "1");
  } catch {
    return;
  }
  setTimeout(() => {
    if (sessionStorage.getItem("aio_fb_done")) return;
    feedbackNudge.dataset.module = moduleId || "";
    feedbackNudge.hidden = false;
  }, 2500);
}

fbStars.addEventListener("click", (e) => {
  const b = e.target.closest(".fb-star");
  if (!b) return;
  const n = Number(b.dataset.star);
  fbState.rating = n;
  fbStars.querySelectorAll(".fb-star").forEach((s) => s.classList.toggle("on", Number(s.dataset.star) <= n));
});
feedbackModal.addEventListener("click", (e) => {
  if (e.target === feedbackModal) {
    closeFeedback();
    return;
  }
  const chip = e.target.closest(".fb-choices .chip");
  if (chip) {
    const group = chip.closest(".fb-choices").dataset.fb;
    fbState[group] = chip.dataset.val;
    chip.parentElement.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c === chip));
  }
});
feedbackClose.addEventListener("click", closeFeedback);
feedbackOpenBtn.addEventListener("click", () => openFeedback());
fbNudgeOpen?.addEventListener("click", () => {
  const id = feedbackNudge?.dataset.module || "";
  hideNudge();
  openFeedback(id);
});
fbNudgeLater?.addEventListener("click", dismissNudge);
fbNudgeClose?.addEventListener("click", dismissNudge);
feedbackSubmit.addEventListener("click", async () => {
  const payload = { ...fbState, comment: fbComment.value.trim(), module: feedbackModal.dataset.module || "" };
  const hasAny = payload.rating !== null || payload.usable || payload.easyForm || payload.reuse || payload.comment;
  if (!hasAny) {
    feedbackStatus.textContent = "원하는 항목을 하나만 골라 주셔도 돼요.";
    return;
  }
  feedbackSubmit.disabled = true;
  feedbackStatus.textContent = "보내는 중…";
  try {
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error();
    feedbackStatus.textContent = "고맙습니다! 큰 도움이 됐어요 😊";
    try {
      sessionStorage.setItem("aio_fb_done", "1");
    } catch {
      /* ignore */
    }
    setTimeout(closeFeedback, 1200);
  } catch {
    feedbackStatus.textContent = "지금은 보내지 못했어요. 잠시 후 다시 시도해 주세요.";
  } finally {
    feedbackSubmit.disabled = false;
  }
});

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

initTextSize();
applyRoute();
loadModules();
checkHealth();
maybeShowOnboarding();
