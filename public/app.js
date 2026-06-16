import { marked } from "./vendor/marked.esm.js";
import DOMPurify from "./vendor/purify.es.mjs";

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
};
const DEFAULT_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9.94 14.06a4 4 0 1 1 5.66-5.66"/><path d="m12 2 1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5z"/></svg>';

// tile = pastel background, accent = icon/clay color, tagline = card copy.
const THEME = {
  exam: { tile: "#FBEDE4", accent: "#C2613A", tagline: "자료 올리면 문제 자동 생성" },
  ppt: { tile: "#FBF1DD", accent: "#C0913C", tagline: "주제만 입력하면 슬라이드로" },
  vocabulary: { tile: "#EAF1F8", accent: "#6F8FB8", tagline: "모르는 단어, 쉽게 풀이" },
  "lesson-plan": { tile: "#E6F0E2", accent: "#5F8B4A", tagline: "수업 흐름 자동 구성" },
  resume: { tile: "#E8F0FA", accent: "#5E86C0", tagline: "면접관이 읽고 싶은 글로" },
  "cover-letter": { tile: "#E8F0FA", accent: "#5E86C0", tagline: "면접관이 읽고 싶은 글로" },
  worksheet: { tile: "#EAF2E1", accent: "#6E9B52", tagline: "" },
  quiz: { tile: "#F7E9E5", accent: "#B56A4E", tagline: "" },
  "study-notes": { tile: "#FBF1DD", accent: "#C0913C", tagline: "" },
};
const DEFAULT_THEME = { tile: "#EFEADD", accent: "#C2613A" };

/* ---------- Elements ---------- */
const viewHome = document.getElementById("view-home");
const viewApp = document.getElementById("view-app");

const heroForm = document.getElementById("hero-form");
const heroInput = document.getElementById("hero-input");

const cardsEl = document.getElementById("module-cards");
const cardsStatus = document.getElementById("cards-status");

const form = document.getElementById("form");
const moduleSelect = document.getElementById("module");
const modulePurpose = document.getElementById("module-purpose");
const moduleDesc = document.getElementById("module-desc");
const moduleOptionsEl = document.getElementById("module-options");
const inputEl = document.getElementById("input");
const submitBtn = document.getElementById("submit");
const stopBtn = document.getElementById("stop");
const statusEl = document.getElementById("status");
const loadingEl = document.getElementById("loading");
const outputEl = document.getElementById("output");
const errorEl = document.getElementById("error");
const copyBtn = document.getElementById("copy");

let modules = [];
let controller = null;
const defaultInputPlaceholder = inputEl.getAttribute("placeholder") ?? "";

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
  const isApp = location.hash === "#generate";
  viewHome.hidden = isApp;
  viewApp.hidden = !isApp;
  window.scrollTo(0, 0);
  if (isApp) inputEl.focus();
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
  copyBtn.hidden = true;
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
function updateModuleDesc() {
  const current = modules.find((m) => m.id === moduleSelect.value);
  modulePurpose.textContent = current?.purpose ?? "";
  moduleDesc.textContent = current?.description ?? "";
  inputEl.placeholder = current?.inputPlaceholder || defaultInputPlaceholder;
  renderOptions(current);
}

function renderCards() {
  cardsEl.innerHTML = modules
    .map((m) => {
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
    })
    .join("");
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
  const input = inputEl.value.trim();
  if (!input) {
    showError("요청 입력을 작성해 주세요.");
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

/* ---------- Wiring ---------- */
form.addEventListener("submit", generate);
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

applyRoute();
loadModules();
