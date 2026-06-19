/**
 * Reusable "source material" input: photo upload (multiple, with thumbnails +
 * remove/reorder), paste-text, and file (PDF/image) upload. Images are downscaled
 * client-side before upload to keep token cost and request size down.
 *
 * Not tied to any module — any content-dependent module can mount one:
 *   const src = createSourceInput({ onChange });
 *   host.appendChild(src.el);
 *   src.getAttachments(); src.getSourceText(); src.isEmpty(); src.reset();
 */

const MAX_DIM = 1568; // Anthropic's recommended max image edge
const JPEG_QUALITY = 0.82;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function base64FromBuffer(buf) {
  let bin = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

async function loadBitmap(file) {
  if (window.createImageBitmap) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* fall through to <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("이미지를 읽지 못했어요."));
      img.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

// Downscale + re-encode an image file to a JPEG base64 attachment.
async function fileToImageAttachment(file) {
  const bmp = await loadBitmap(file);
  const w = bmp.width || bmp.naturalWidth;
  const h = bmp.height || bmp.naturalHeight;
  if (!w || !h) throw new Error("이미지를 읽지 못했어요.");
  const scale = Math.min(1, MAX_DIM / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; // flatten transparency (textbook scans)
  ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(bmp, 0, 0, cw, ch);
  if (bmp.close) bmp.close();
  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  const data = dataUrl.split(",")[1] || "";
  if (!data) throw new Error("이미지를 변환하지 못했어요.");
  return { kind: "image", mediaType: "image/jpeg", name: file.name || "photo.jpg", data, thumb: dataUrl };
}

async function fileToPdfAttachment(file, maxPdfBytes) {
  if (file.size > maxPdfBytes) throw new Error("PDF 파일이 너무 커요. (최대 10MB)");
  const buf = await file.arrayBuffer();
  return { kind: "pdf", mediaType: "application/pdf", name: file.name || "file.pdf", data: base64FromBuffer(buf), thumb: null };
}

export function createSourceInput(opts = {}) {
  const onChange = opts.onChange || (() => {});
  const maxFiles = opts.maxFiles || 10;
  const maxPdfBytes = opts.maxPdfBytes || 10 * 1024 * 1024;
  const items = [];

  const root = document.createElement("div");
  root.className = "source-input";
  root.innerHTML =
    `<div class="source-buttons">` +
    `<button type="button" class="source-btn primary" data-act="photo">` +
    `<span class="source-ico" aria-hidden="true">📷</span> 사진 찍기 / 올리기</button>` +
    `<button type="button" class="source-btn" data-act="file">` +
    `<span class="source-ico" aria-hidden="true">📄</span> 파일 올리기 (PDF·이미지)</button>` +
    `</div>` +
    `<input type="file" class="source-file-photo" accept="image/*" capture="environment" multiple hidden>` +
    `<input type="file" class="source-file-any" accept="image/*,application/pdf,.pdf" multiple hidden>` +
    `<div class="source-thumbs"></div>` +
    `<details class="source-paste"><summary>또는 본문 붙여넣기</summary>` +
    `<textarea class="source-text" rows="4" maxlength="20000" placeholder="교재 본문이나 지문을 여기에 붙여넣어도 돼요"></textarea>` +
    `</details>` +
    `<p class="source-status" role="status" aria-live="polite"></p>`;

  const thumbsEl = root.querySelector(".source-thumbs");
  const statusEl = root.querySelector(".source-status");
  const textEl = root.querySelector(".source-text");
  const photoInput = root.querySelector(".source-file-photo");
  const anyInput = root.querySelector(".source-file-any");

  const setStatus = (t) => {
    statusEl.textContent = t || "";
  };

  function render() {
    thumbsEl.innerHTML = items
      .map((it, i) => {
        const media =
          it.kind === "image"
            ? `<img src="${it.thumb}" alt="">`
            : `<span class="thumb-doc" aria-hidden="true">PDF</span>`;
        return (
          `<div class="thumb">${media}` +
          `<span class="thumb-name" title="${escapeHtml(it.name)}">${escapeHtml(it.name)}</span>` +
          `<div class="thumb-actions">` +
          (i > 0 ? `<button type="button" data-mv="${i}:-1" aria-label="앞으로">◀</button>` : "") +
          (i < items.length - 1 ? `<button type="button" data-mv="${i}:1" aria-label="뒤로">▶</button>` : "") +
          `<button type="button" class="thumb-rm" data-rm="${i}" aria-label="삭제">✕</button>` +
          `</div></div>`
        );
      })
      .join("");
    thumbsEl.querySelectorAll("[data-rm]").forEach((b) => {
      b.onclick = () => {
        items.splice(Number(b.dataset.rm), 1);
        render();
        onChange();
      };
    });
    thumbsEl.querySelectorAll("[data-mv]").forEach((b) => {
      b.onclick = () => {
        const [i, d] = b.dataset.mv.split(":").map(Number);
        const j = i + d;
        if (j < 0 || j >= items.length) return;
        [items[i], items[j]] = [items[j], items[i]];
        render();
        onChange();
      };
    });
    if (items.length) setStatus(`${items.length}개 첨부됨 (최대 ${maxFiles}개)`);
    else setStatus("");
  }

  async function addFiles(fileList) {
    const files = [...fileList];
    photoInput.value = "";
    anyInput.value = "";
    let added = 0;
    for (const f of files) {
      if (items.length >= maxFiles) {
        setStatus(`사진·파일은 최대 ${maxFiles}개까지 올릴 수 있어요.`);
        break;
      }
      try {
        if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) {
          items.push(await fileToPdfAttachment(f, maxPdfBytes));
          added++;
        } else if (f.type.startsWith("image/") || /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(f.name)) {
          items.push(await fileToImageAttachment(f));
          added++;
        } else {
          setStatus("이미지(JPG·PNG·WEBP) 또는 PDF만 올릴 수 있어요.");
        }
      } catch (err) {
        setStatus((err && err.message) || "파일을 읽지 못했어요. 다른 파일로 시도해 주세요.");
      }
    }
    render();
    if (added) onChange();
  }

  root.querySelector('[data-act="photo"]').addEventListener("click", () => photoInput.click());
  root.querySelector('[data-act="file"]').addEventListener("click", () => anyInput.click());
  photoInput.addEventListener("change", (e) => addFiles(e.target.files));
  anyInput.addEventListener("change", (e) => addFiles(e.target.files));
  textEl.addEventListener("input", () => onChange());

  return {
    el: root,
    getAttachments: () => items.map(({ kind, mediaType, data }) => ({ kind, mediaType, data })),
    getSourceText: () => textEl.value.trim(),
    count: () => items.length,
    hasText: () => !!textEl.value.trim(),
    setSourceText: (t) => {
      textEl.value = t || "";
    },
    isEmpty: () => items.length === 0 && !textEl.value.trim(),
    reset: () => {
      items.length = 0;
      textEl.value = "";
      render();
      setStatus("");
    },
  };
}
