const form = document.getElementById("form");
const moduleSelect = document.getElementById("module");
const moduleDesc = document.getElementById("module-desc");
const inputEl = document.getElementById("input");
const submitBtn = document.getElementById("submit");
const stopBtn = document.getElementById("stop");
const statusEl = document.getElementById("status");
const outputEl = document.getElementById("output");
const errorEl = document.getElementById("error");
const copyBtn = document.getElementById("copy");

let modules = [];
let controller = null;

function setStatus(text) {
  statusEl.textContent = text ?? "";
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function clearError() {
  errorEl.textContent = "";
  errorEl.hidden = true;
}

function updateModuleDesc() {
  const current = modules.find((m) => m.id === moduleSelect.value);
  moduleDesc.textContent = current?.description ?? "";
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
  } catch (err) {
    showError(err instanceof Error ? err.message : String(err));
    submitBtn.disabled = true;
  }
}

function setGenerating(isGenerating) {
  submitBtn.disabled = isGenerating;
  moduleSelect.disabled = isGenerating;
  inputEl.disabled = isGenerating;
  stopBtn.hidden = !isGenerating;
}

// Parse the SSE-style POST stream: events are separated by a blank line, and the
// payload sits on a `data: ` line as JSON. Returns when the stream ends.
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

async function generate(event) {
  event.preventDefault();
  clearError();
  outputEl.textContent = "";
  copyBtn.hidden = true;

  const module = moduleSelect.value;
  const input = inputEl.value.trim();
  if (!input) {
    showError("요청 입력을 작성해 주세요.");
    return;
  }

  setGenerating(true);
  setStatus("생성 중…");
  controller = new AbortController();

  try {
    const res = await fetch("/api/generate/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module, input }),
      signal: controller.signal,
    });

    // Validation failures come back as a normal JSON error, not a stream.
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? `요청 실패 (HTTP ${res.status})`);
    }

    await readStream(res, (evt) => {
      if (evt.type === "delta") {
        outputEl.textContent += evt.text;
        outputEl.scrollTop = outputEl.scrollHeight;
      } else if (evt.type === "done") {
        const { inputTokens, outputTokens } = evt.usage ?? {};
        setStatus(`완료 · ${evt.model} · 입력 ${inputTokens} / 출력 ${outputTokens} 토큰`);
        copyBtn.hidden = outputEl.textContent.length === 0;
      } else if (evt.type === "error") {
        showError(evt.error);
        setStatus("오류");
      }
    });

    if (!statusEl.textContent || statusEl.textContent === "생성 중…") {
      setStatus("완료");
      copyBtn.hidden = outputEl.textContent.length === 0;
    }
  } catch (err) {
    if (err.name === "AbortError") {
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

form.addEventListener("submit", generate);
moduleSelect.addEventListener("change", updateModuleDesc);
stopBtn.addEventListener("click", () => controller?.abort());
copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(outputEl.textContent);
    copyBtn.textContent = "복사됨";
    setTimeout(() => (copyBtn.textContent = "복사"), 1500);
  } catch {
    /* clipboard may be unavailable; ignore */
  }
});

loadModules();
