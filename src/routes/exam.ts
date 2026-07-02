import { Router, type Request, type Response, type NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildExamModel, type ExamMetaInput } from "../exam/parseExam.js";

export const examRouter = Router();

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");
const scriptPath = join(projectRoot, "scripts", "exam_pdf.py");

// Light limit — PDF rendering is CPU-heavy but isn't a paid LLM call.
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

// Render the exam model to a PDF: pipe the JSON model to the WeasyPrint script's
// stdin, have it write the PDF to a temp file (--out), and read it back. stdout
// carries the one-line QA log. Resolves `unavailable` when the toolchain is missing.
function renderPdf(
  modelJson: string,
  variant: "student" | "teacher" | "key" = "teacher",
): Promise<{ pdf: Buffer; log: string } | { unavailable: true } | { error: string }> {
  return new Promise((resolve) => {
    if (!existsSync(scriptPath)) {
      resolve({ unavailable: true });
      return;
    }
    const bins = pythonCandidates();
    const outPath = join(tmpdir(), `exam-${randomUUID()}.pdf`);

    const finish = async (
      result: { pdf: Buffer; log: string } | { unavailable: true } | { error: string },
    ) => {
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
        proc = spawn(bin, [scriptPath, "--out", outPath, "--variant", variant], { stdio: ["pipe", "pipe", "pipe"] });
      } catch {
        tryBin(idx + 1);
        return;
      }
      const out: Buffer[] = [];
      const err: Buffer[] = [];
      let spawnFailed = false;
      proc.on("error", () => {
        spawnFailed = true;
        tryBin(idx + 1); // e.g. ENOENT for this candidate
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
      proc.stdin.write(modelJson);
      proc.stdin.end();
    };
    tryBin(0);
  });
}

examRouter.post(
  "/exam/pdf",
  pdfLimiter,
  asyncHandler(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" ? v : undefined);
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

    const markdown = str(body.markdown) ?? str(body.content) ?? "";
    if (!markdown.trim()) {
      res.status(400).json({ error: "시험지 내용이 비어 있어요." });
      return;
    }
    if (markdown.length > 200_000) {
      res.status(400).json({ error: "내용이 너무 길어요." });
      return;
    }

    const input: ExamMetaInput = {
      title: str(body.title),
      subject: str(body.subject),
      scope: str(body.scope),
      timeMinutes: num(body.timeMinutes),
      difficulty: str(body.difficulty),
      brand: str(body.brand),
      motto: str(body.motto),
      subtitle: str(body.subtitle),
      notice: str(body.notice),
    };

    const variant = ((v) => (v === "student" || v === "key" ? v : "teacher"))(str(body.variant)) as
      | "student"
      | "teacher"
      | "key";

    const model = buildExamModel(markdown, input);
    const result = await renderPdf(JSON.stringify(model), variant);

    if ("unavailable" in result) {
      res.status(501).json({
        error: "PDF 생성 도구가 이 서버에 설치되어 있지 않아요. (관리자: Python + WeasyPrint 필요)",
      });
      return;
    }
    if ("error" in result) {
      console.error("[exam/pdf] render error:", result.error);
      res.status(500).json({ error: "PDF를 만드는 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요." });
      return;
    }

    const variantSuffix = variant === "student" ? "_학생용" : variant === "key" ? "_정답지" : "";
    const filename = encodeURIComponent(
      ((input.title || model.title || "exam").replace(/[^\w가-힣 .-]/g, "").trim() || "exam") + variantSuffix,
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="exam.pdf"; filename*=UTF-8''${filename}.pdf`);
    if (result.log) res.setHeader("X-Exam-QA", encodeURIComponent(result.log).slice(0, 400));
    res.send(result.pdf);
  }),
);
