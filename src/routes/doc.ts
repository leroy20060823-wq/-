import { Router, type Request, type Response, type NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const docRouter = Router();

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");
const scriptPath = join(projectRoot, "scripts", "doc_pdf.py");

// Which renderer template each module uses. (자소서/이력서 stay Word/한글 — no PDF here;
// exam has its own B4 renderer; ppt exports .pptx.)
const MODULE_DOC_TYPE: Record<string, string> = {
  vocabulary: "vocab",
  "study-notes": "notes",
  quiz: "quiz",
  worksheet: "worksheet",
  "lesson-plan": "doc",
  "creative-writing": "doc",
  // excel은 PDF가 아니라 진짜 .xlsx로 내보냄 (클라이언트 public/xlsx.js).
};

const pdfLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "잠시 후 다시 시도해 주세요." },
});

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

function pythonCandidates(): string[] {
  return [process.env.PYTHON_BIN, "python3", "python"].filter((v): v is string => !!v);
}

function renderPdf(docJson: string): Promise<{ pdf: Buffer; log: string } | { unavailable: true } | { error: string }> {
  return new Promise((resolve) => {
    if (!existsSync(scriptPath)) {
      resolve({ unavailable: true });
      return;
    }
    const bins = pythonCandidates();
    const outPath = join(tmpdir(), `doc-${randomUUID()}.pdf`);
    const finish = async (result: { pdf: Buffer; log: string } | { unavailable: true } | { error: string }) => {
      await unlink(outPath).catch(() => {});
      resolve(result);
    };
    const tryBin = (idx: number): void => {
      const bin = bins[idx];
      if (!bin) {
        resolve({ unavailable: true });
        return;
      }
      let proc;
      try {
        proc = spawn(bin, [scriptPath, "--out", outPath], { stdio: ["pipe", "pipe", "pipe"] });
      } catch {
        tryBin(idx + 1);
        return;
      }
      const out: Buffer[] = [];
      const err: Buffer[] = [];
      let spawnFailed = false;
      proc.on("error", () => {
        spawnFailed = true;
        tryBin(idx + 1);
      });
      proc.stdout.on("data", (d) => out.push(d));
      proc.stderr.on("data", (d) => err.push(d));
      proc.on("close", (code) => {
        if (spawnFailed) return;
        const stderr = Buffer.concat(err).toString("utf8");
        const stdout = Buffer.concat(out).toString("utf8");
        const log = stdout.split("\n").filter(Boolean).slice(-1)[0] ?? "";
        if (code === 0) {
          readFile(outPath).then(
            (pdf) => finish({ pdf, log }),
            (e) => finish({ error: `read output failed: ${String(e)}` }),
          );
        } else if (/ModuleNotFoundError|No module named ['"]?weasyprint/.test(stderr + stdout)) {
          finish({ unavailable: true });
        } else {
          finish({ error: (stderr || stdout).slice(-500) });
        }
      });
      proc.stdin.write(docJson);
      proc.stdin.end();
    };
    tryBin(0);
  });
}

// Designed document PDF (단어장·학습노트·퀴즈·학습지·지도안·소설·엑셀).
docRouter.post(
  "/doc/pdf",
  pdfLimiter,
  asyncHandler(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" ? v : undefined);

    const moduleId = str(body.module) ?? "";
    const type = MODULE_DOC_TYPE[moduleId];
    if (!type) {
      res.status(400).json({ error: "이 종류는 PDF 내려받기를 지원하지 않아요." });
      return;
    }
    const markdown = str(body.markdown) ?? "";
    if (!markdown.trim()) {
      res.status(400).json({ error: "내용이 비어 있어요." });
      return;
    }
    if (markdown.length > 200_000) {
      res.status(400).json({ error: "내용이 너무 깁니다." });
      return;
    }

    const doc = {
      type,
      title: str(body.title) ?? "",
      subtitle: str(body.subtitle) ?? "",
      brand: str(body.brand) ?? "",
      theme: str(body.theme) ?? "",
      markdown,
    };
    const result = await renderPdf(JSON.stringify(doc));
    if ("unavailable" in result) {
      res.status(501).json({ error: "PDF 생성 도구가 이 서버에 설치되어 있지 않아요." });
      return;
    }
    if ("error" in result) {
      console.error("[doc/pdf] render error:", result.error);
      res.status(500).json({ error: "PDF를 만드는 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요." });
      return;
    }
    const filename = encodeURIComponent(((doc.title || "문서").replace(/[^\w가-힣 .-]/g, "").trim() || "문서"));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="document.pdf"; filename*=UTF-8''${filename}.pdf`);
    if (result.log) res.setHeader("X-Doc-QA", encodeURIComponent(result.log).slice(0, 300));
    res.send(result.pdf);
  }),
);
