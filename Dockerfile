# syntax=docker/dockerfile:1
# Node app + Python/WeasyPrint in one image, so the 시험지 module's polished A4
# PDF (scripts/exam_pdf.py) renders in production. Render builds this via
# `runtime: docker` in render.yaml. Everything else (the web app, generation,
# .docx/.hwpx export) is unchanged — this just adds the PDF toolchain.
FROM node:20-bookworm-slim

# --- System libraries WeasyPrint needs (Pango / Cairo / FFI / JPEG / fonts) ---
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 python3-venv python3-pip \
      libpango-1.0-0 libpangocairo-1.0-0 libcairo2 \
      libgdk-pixbuf-2.0-0 libffi8 libjpeg62-turbo \
      fontconfig shared-mime-info fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# --- WeasyPrint in an isolated venv (Debian bookworm is PEP-668 managed) ---
# Cached unless requirements.txt changes.
COPY requirements.txt ./
RUN python3 -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir --upgrade pip \
    && /opt/venv/bin/pip install --no-cache-dir -r requirements.txt
# The exam PDF route prefers $PYTHON_BIN — point it at the venv interpreter.
ENV PYTHON_BIN=/opt/venv/bin/python3

# --- Node deps (cached unless package*.json changes) ---
# --include=dev keeps TypeScript/tsx available for the build step.
COPY package*.json ./
RUN npm ci --include=dev

# --- App source + build ---
COPY . .
RUN npm run build

ENV NODE_ENV=production
# Render injects PORT; the app reads process.env.PORT (default 3000).
EXPOSE 3000
CMD ["npm", "start"]
