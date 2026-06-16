import { marked } from "./vendor/marked.esm.js";
import DOMPurify from "./vendor/purify.es.mjs";

marked.use({ gfm: true, breaks: false });

const viewHome = document.getElementById("view-home");
const viewApp = document.getElementById("view-app");
const navLinks = document.querySelectorAll(".nav a[data-nav]");

const cardsEl = document.getElementById("module-cards");
const cardsStatus = document.getElementById("cards-status");

const form = document.getElementById("form");
const moduleSelect = document.getElementById("module");
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

// Streaming render state: `raw` is accumulated Markdown source, re-rendered to
// HTML at most once per animation frame for smoothness.
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
  navLinks.forEach((a) => {
    const isAppLink = a.getAttribute("data-nav") === "app";
    a.classList.toggle("active", isAppLink === isApp);
  });
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

/* ---------- Modules ---------- */

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

function updateModuleDesc() {
  const current = modules.find((m) => m.id === moduleSelect.value);
  moduleDesc.textContent = current?.description ?? "";
  renderOptions(current);
}

function renderCards() {
  cardsEl.innerHTML = modules
    .map(
      (m) =>
        `<button type="button" class="card" data-module="${escapeHtml(m.id)}">` +
        `<span class="card-name">${escapeHtml(m.name)}</span>` +
        `<span class="card-desc">${escapeHtml(m.description)}</span></button>`,
    )
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

// Parse the SSE-style POST stream: events separated by a blank line, payload on
// a `data: ` line as JSON.
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

    // Validation failures come back as a normal JSON error, not a stream.
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
      // Stream ended without a done/error event (e.g. aborted mid-stream).
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

cardsEl.addEventListener("click", (e) => {
  const card = e.target.closest("[data-module]");
  if (!card) return;
  moduleSelect.value = card.dataset.module;
  updateModuleDesc();
  location.hash = "#generate";
});

copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(raw); // copy the Markdown source
    copyBtn.textContent = "복사됨";
    setTimeout(() => (copyBtn.textContent = "복사"), 1500);
  } catch {
    /* clipboard may be unavailable; ignore */
  }
});

applyRoute();
loadModules();
