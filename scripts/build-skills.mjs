// Generates Claude Code skills from the generation modules in src/modules.ts,
// so every module (시험지, 학습지, 퀴즈, …) becomes a slash command you can run
// INSIDE Claude Code — no external API call, no billing. The model that runs
// the skill (your current session model) does the generation directly.
//
// The slash command name comes from the SKILL DIRECTORY name, so we use clean
// Korean folder names (e.g. .claude/skills/시험지 → /시험지). The module's
// systemPrompt is embedded verbatim so quality matches the original service.
//
// Re-run after editing src/modules.ts:  npm run skills:build
import { mkdir, writeFile, rm, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { listModules } from "../src/modules.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS_DIR = path.join(ROOT, ".claude", "skills");

// Korean directory slug per module id → drives the slash command (/시험지 등).
// Kept free of spaces and punctuation so the command is clean and typeable.
const SLUG = {
  exam: "시험지",
  worksheet: "학습지",
  quiz: "퀴즈",
  vocabulary: "단어장",
  ppt: "PPT",
  "study-notes": "학습노트",
  "lesson-plan": "수업지도안",
  resume: "이력서",
  "cover-letter": "자기소개서",
  "creative-writing": "소설",
  excel: "엑셀",
};

// Extra search keywords appended to the description so the / picker surfaces the
// skill from many phrasings.
const KEYWORDS = {
  exam: "시험, 시험지, 모의고사, 중간고사, 기말고사, 단원평가, 출제, exam, test",
  worksheet: "학습지, 연습지, 워크시트, 숙제, 문제지, worksheet",
  quiz: "퀴즈, 쪽지시험, 미니테스트, 형성평가, quiz",
  vocabulary: "단어장, 영단어, 어휘, 단어 정리, vocabulary, vocab",
  ppt: "PPT, 발표자료, 슬라이드, 프레젠테이션, presentation, slides",
  "study-notes": "학습노트, 정리노트, 요약, 개념정리, 핵심정리, notes",
  "lesson-plan": "수업지도안, 교안, 지도안, 수업계획, lesson plan",
  resume: "이력서, CV, resume",
  "cover-letter": "자기소개서, 자소서, cover letter",
  "creative-writing": "소설, 글쓰기, 이야기, 창작, 동화, story, fiction",
  excel: "엑셀, 구글시트, 스프레드시트, 수식, 함수, 차트, excel, sheets",
};

// Files made + delivered per module by default (besides the .md source).
// Text artifacts → Word + PDF; slides → PowerPoint + PDF. PDF is universally
// viewable (great for interview samples); 한글(.hwpx) stays available on request.
const FORMATS = {
  // 시험지·단어장은 항상 PDF를 먼저(다운로드·인쇄·면접 샘플용), 편집용 워드도 함께.
  exam: "pdf,docx,md",
  vocabulary: "pdf,docx,md",
  ppt: "pptx,pdf,md",
  excel: "docx,pdf,md",
};
const DEFAULT_FORMATS = "docx,pdf,md";
const FORMAT_LABEL = {
  docx: "워드(.docx)",
  pdf: "PDF(.pdf)",
  hwpx: "한글(.hwpx)",
  pptx: "파워포인트(.pptx)",
  md: "마크다운(.md)",
};

// The natural-language router skill (/자료).
const ROUTER_SLUG = "자료";

// A friendly inline example shown as autocomplete after the slash command.
const ARG_HINT = {
  exam: "예) 중2 영어 비교급 단원평가 상 25문항 / 고1 수학 함수 50분",
  worksheet: "예) 중2 영어 비교급 10문항 / 초6 분수 나눗셈",
  quiz: "예) 광합성 5문항 객관식 / 한국사 조선후기 단답형",
  vocabulary: "예) vapor, summit, harbor, occur, coastal  또는  Unit 3 날씨 20개",
  ppt: "예) 신입사원 온보딩 10장 신뢰감 / 광합성 수업 8장",
  "study-notes": "예) 조선 후기 경제 고등 / 세포 호흡 중등",
  "lesson-plan": "예) 중학교 영어 비교급 45분 / 초등 수학 분수 1차시",
  resume: "예) 외식업 매니저 지원, 카페 2년 경력",
  "cover-letter": "예) 요양보호사 지원, 마트 3년 경력, 성실함 강조",
  "creative-writing": "예) 로맨스, 비 오는 날 우산을 나눠 쓴 두 사람, 1500자",
  excel: "예) 매출 표에서 월별 합계와 차트 만들기 (A열 날짜, B열 금액)",
};

const yamlString = (s) => `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

function renderGuide(guide = []) {
  if (!guide.length) return "";
  const lines = guide.map((f) => {
    const req = f.required ? " **(필수)**" : "";
    let detail = f.help || f.question || "";
    if (f.type === "counts" && Array.isArray(f.items)) {
      const items = f.items
        .map((it) => `${it.label} ${it.default ?? 0}`)
        .join(" · ");
      detail = `${detail} (기본값: ${items})`.trim();
    } else if (f.type === "select" && Array.isArray(f.choices)) {
      const opts = f.choices
        .map((c) => (c.label ? `${c.label}(${c.value})` : c.value))
        .join(" / ");
      const def = f.default != null ? ` · 기본 ${f.default}` : "";
      detail = `${detail} [${opts}${def}]`.trim();
    } else if (f.placeholder) {
      const ex = f.placeholder.split("\n")[0].replace(/^예:\s*/, "");
      detail = `${detail}${detail ? " · " : ""}예: ${ex}`;
    }
    return `  - **${f.label}**${req} — ${detail}`;
  });
  return `\n**핵심 입력**\n${lines.join("\n")}`;
}

function renderOptions(options = []) {
  if (!options.length) return "";
  const lines = options.map((o) => {
    let detail = o.help || "";
    if (o.type === "select" && Array.isArray(o.choices)) {
      const opts = o.choices
        .map((c) => (c.label ? `${c.label}(${c.value})` : c.value))
        .join(" / ");
      detail = `${detail}${detail ? " · " : ""}${opts}`;
    }
    const def =
      o.default != null ? ` (기본 ${o.default}${o.unit ?? ""})` : "";
    const range =
      o.min != null && o.max != null ? ` [${o.min}~${o.max}${o.unit ?? ""}]` : "";
    return `  - **${o.label}**${def}${range} — ${detail}`.replace(/ —\s*$/, "");
  });
  return `\n**옵션(조정 가능)**\n${lines.join("\n")}`;
}

function renderSource(source) {
  if (!source || !source.enabled) return "";
  const label = source.label ? ` (${source.label})` : "";
  return `\n**자료 첨부${label}** — 사용자가 교재 사진·본문·파일을 주면 **그 내용 그대로** 출제·정리하고(자료 기반 모드), 없으면 주제만으로 새로 창작하세요(주제 모드). ${source.hint ?? ""}`.trimEnd();
}

// The "출력과 파일" section. 시험지·단어장 have dedicated, design-matched
// renderers (the same look as the reference PDFs); everything else uses the
// generic Markdown→file exporter.
function buildExportBlock(m, outNo) {
  if (m.id === "exam") {
    return `## ${outNo}) 출력과 파일 (전용 시험지 디자인 · 바로 보기)
1. 결과 전체(헤더·배점표·문항·정답표·정밀 해설지)를 깔끔한 마크다운으로 **이 대화에 바로** 출력하세요.
2. 이어서 **전용 시험지 렌더러로 PDF를 만들어 \`SendUserFile\`로 바로 전달**하세요. (사용자가 "화면만"이라고 한 경우만 생략)
   1. 만든 마크다운 전체를 \`outputs/<한글-이름>.md\`로 저장(Write 도구).
   2. 전용 시험지 PDF 생성(프리미엄 표지·네이비 섹션바·문항 배지 — 컬러·흑백 인쇄 모두 고품질):
      \`\`\`bash
      node --import tsx scripts/exam-pdf.mjs --in "outputs/<이름>.md" --out "outputs/<이름>.pdf" --title "<시험 제목>" --difficulty "<하|중|상>" --scope "<출제 범위>" --time <시험시간(분)> --subtitle "<예: 중간·기말 대비 모의고사>"
      \`\`\`
      - **기본은 중립적·범용 표지**입니다. 디자인 자체가 고급스러우니 특정 학교·기관 색을 넣지 마세요. \`--subtitle\`은 일반적인 문구만 쓰세요.
      - \`--brand\`(상단 브랜드명)·\`--motto\`(표지 문구)·\`--title-latin\`(영문 부제)는 **사용자가 직접 요청한 경우에만** 추가하세요. 요청이 없으면 임의의 학교명·기관명·문구를 절대 넣지 마세요.
   3. 생성된 \`outputs/<이름>.pdf\`를 **\`SendUserFile\`로 바로 전달**하세요(경로만 알려주지 말 것).
   - 이 렌더러는 Python+WeasyPrint를 쓰며 없으면 자동 설치합니다. 모듈 오류가 나면 먼저 \`npm install\`.
3. 편집본(워드)이 필요하면: \`node scripts/export.mjs --in "outputs/<이름>.md" --format docx --out "outputs/<이름>"\`.`;
  }
  if (m.id === "vocabulary") {
    return `## ${outNo}) 출력과 파일 (전용 단어장 디자인 · 바로 보기)
1. 결과 전체를 깔끔한 마크다운으로 **이 대화에 바로** 출력하세요. (한 항목 = \`**N · word** [발음] · 품사 — 뜻\` / 영어 예문 / 한국어 해석)
2. 이어서 **전용 단어장 렌더러로 PDF를 만들어 \`SendUserFile\`로 바로 전달**하세요.
   1. 만든 마크다운 전체를 \`outputs/<한글-이름>.md\`로 저장(Write 도구).
   2. 전용 단어장 PDF 생성(마룬 헤더·품사 배지·네이비 섹션바 디자인 — 컬러·흑백 모두 고품질):
      \`\`\`bash
      node scripts/vocab-pdf.mjs --in "outputs/<이름>.md" --out "outputs/<이름>.pdf" --title "<단어장 제목>"
      \`\`\`
      - **기본은 중립적·범용**입니다. \`--brand\`(상단 라벨)·\`--subtitle\`는 사용자가 직접 요청한 경우에만 추가하고, 임의의 학교·기관명은 넣지 마세요.
   3. 생성된 \`outputs/<이름>.pdf\`를 **\`SendUserFile\`로 바로 전달**하세요.
   - 오류가 나면 먼저 \`npm install\` 후 다시 시도하세요.
3. 편집본(워드)이 필요하면: \`node scripts/export.mjs --in "outputs/<이름>.md" --format docx --out "outputs/<이름>"\`.`;
  }
  const fmts = FORMATS[m.id] || DEFAULT_FORMATS;
  const humanList = fmts.split(",").map((f) => FORMAT_LABEL[f]).join(" · ");
  const primary = fmts.split(",").filter((f) => f !== "md").join(",") || "md";
  return `## ${outNo}) 출력과 파일 (바로 보기)
1. 결과 전체를 깔끔한 마크다운으로 **이 대화에 바로** 출력하세요.
2. 이어서 **자동으로 파일을 만들어 사용자에게 바로 전달**하세요. (사용자가 "파일은 됐어 / 화면만 보여줘"라고 한 경우에만 생략) — 면접 샘플처럼 즉시 열어볼 수 있어야 하니까요.
   1. 방금 만든 마크다운 전체를 \`outputs/<알맞은-한글-이름>.md\`로 저장하세요(Write 도구, 폴더 없으면 생성).
   2. 아래 명령으로 문서 파일을 만드세요(저장소 루트에서 실행):
      \`\`\`bash
      node scripts/export.mjs --in "outputs/<이름>.md" --format ${primary} --out "outputs/<이름>" --title "<이름>"
      \`\`\`
   3. 생성된 파일(${humanList})을 **\`SendUserFile\` 도구로 사용자에게 바로 전달**하세요. 경로만 알려주지 말고 파일 자체를 보내야 사용자가 바로 열어볼 수 있습니다.
3. 형식 조정: 한글(.hwpx)이 필요하면 \`--format\`에 \`hwpx\`를 더하고, 사용자가 한 형식만 원하면 그 형식만 만드세요.
   - \`Cannot find module\` 류 오류가 나면 먼저 \`npm install\`을 한 번 실행한 뒤 다시 시도하세요(PDF는 Chromium·번들 한글 폰트를 사용합니다).`;
}

function buildBody(m) {
  const slug = SLUG[m.id];
  const inputs = [renderGuide(m.guide), renderOptions(m.options), renderSource(m.source)]
    .filter(Boolean)
    .join("\n");

  const ref = m.referenceExample
    ? `\n\n## 3) 참고 예시 — 스타일·품질 기준 (내용은 절대 복사하지 말 것)\n아래는 **형식과 품질의 기준**일 뿐입니다. 짜임새·난이도·해설 어투만 맞추고, 내용·문장·예문은 매번 새로 만드세요.\n\n\`\`\`markdown\n${m.referenceExample}\n\`\`\``
    : "";

  const outNo = m.referenceExample ? 4 : 3;
  const exportBlock = buildExportBlock(m, outNo);

  return `# ${m.name}

${m.description}

> 이 스킬은 프로젝트 \`src/modules.ts\`의 **${m.id}** 모듈에서 자동 생성됐어요. 외부 사이트·API 호출 없이, 지금 이 클로드가 아래 지침대로 직접 만들어 줍니다. (수정은 \`src/modules.ts\` 후 \`npm run skills:build\`)

## 1) 입력 정리
사용자가 \`/${slug}\` 뒤에 적은 내용은 \`$ARGUMENTS\`로 들어옵니다. 거기서 아래 항목을 최대한 파악하세요.
- 빠진 **필수** 항목만 한 번에 모아 짧게 물어보고, 나머지는 합리적 기본값으로 바로 진행하세요.
- 질문은 최소화하세요. 사용자가 "알아서"라고 하면 모두 기본값으로 생성합니다.
${inputs}

## 2) 생성 지침 — 아래 규칙을 그대로 따르세요
${m.systemPrompt}

**[요청 조건] 적용:** 1)에서 받은 값(난이도·문항 수·길이·도구 등)을 위 지침이 말하는 '[요청 조건]'으로 간주해 정확히 반영하세요. 사용자가 쓴 언어(보통 한국어)로 출력합니다.${ref}

${exportBlock}
`;
}

function buildRouter(modules) {
  const rows = modules
    .map((m) => `| \`/${SLUG[m.id]}\` | ${m.purpose} | ${(KEYWORDS[m.id] || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 4).join(", ")} |`)
    .join("\n");
  const desc =
    "무엇을 만들지 자연어로 적으면 알맞은 생성기로 안내·실행합니다(시험지·학습지·퀴즈·단어장·PPT·학습노트·수업지도안·이력서·자기소개서·소설·엑셀). 어떤 명령을 쓸지 모를 때 시작점. 키워드: 자료, 만들기, 생성, 도움, 추천, 라우터, router";
  const front = [
    "---",
    `name: ${ROUTER_SLUG}`,
    `description: ${yamlString(desc)}`,
    `argument-hint: ${yamlString("예) 중2 영어 비교급 시험지 만들어줘 / 신입사원 발표 자료 / 자소서 도와줘")}`,
    "---",
    "",
  ].join("\n");
  return `${front}# 자료 — 무엇이든 만들기 (라우터)

무엇을 만들지 자연어로 적으면, 가장 알맞은 생성기를 골라 **그 자리에서** 만들어 줘요. 어떤 \`/명령\`을 써야 할지 모를 때 여기서 시작하세요.

## 동작 방식
1. \`$ARGUMENTS\`(사용자가 원하는 결과물)를 읽고, 아래 표에서 **가장 잘 맞는 모듈 하나**를 고르세요. (용도·키워드 참고)
2. 고른 모듈의 스킬 파일 \`.claude/skills/<명령이름>/SKILL.md\`을 **Read 도구로 읽고**, 그 "생성 지침"을 그대로 따라 결과를 만드세요. 사용자의 입력을 그 스킬의 입력으로 사용합니다.
3. 어떤 모듈인지 애매하면(후보가 둘 이상이면), 후보 2개만 제시하고 **한 번만** 물어본 뒤 진행하세요.
4. 다 만든 뒤에는 그 스킬과 동일하게 **파일 내보내기**(워드·한글·PPT)를 제안하세요.
5. 사용자가 이미 \`/시험지\`처럼 정확한 명령을 알고 있으면 그 명령을 직접 쓰는 게 더 빠르다고 한 줄로 알려 주세요.

## 라우팅 표

| 명령 | 용도 | 대표 키워드 |
|---|---|---|
${rows}

> 표에 없는 요청(예: 번역, 단순 질문)은 굳이 한 모듈로 욱여넣지 말고, 일반 대화로 도와주세요.
`;
}

function buildSkill(m) {
  const desc = `${m.description} 용도: ${m.purpose}. 키워드: ${KEYWORDS[m.id] ?? ""}`;
  const front = [
    "---",
    `name: ${SLUG[m.id]}`,
    `description: ${yamlString(desc)}`,
    `argument-hint: ${yamlString(ARG_HINT[m.id] ?? "")}`,
    "---",
    "",
  ].join("\n");
  return front + buildBody(m);
}

function buildReadme(modules) {
  const rows = modules
    .map((m) => `| \`/${SLUG[m.id]}\` | ${m.name} | ${m.purpose} |`)
    .join("\n");
  return `# 클로드 코드 스킬 (자동 생성)

\`src/modules.ts\`의 생성 모듈을 **슬래시 명령**으로 변환한 것입니다. 외부 배포
사이트의 유료 API 대신, 지금 사용하는 클로드 세션이 직접 자료를 만들어 줘요
(추가 API 결제 없음). 학원 수업·과제 준비에 바로 쓰세요.

## 쓰는 법
\`/\` 를 누르면 아래 명령이 보입니다. 명령 뒤에 바로 조건을 적어도 됩니다.

\`\`\`
/시험지 중2 영어 비교급 단원평가 상 25문항
/학습지 중2 영어 비교급 10문항
/단어장 vapor, summit, harbor, occur, coastal
\`\`\`

어떤 명령을 쓸지 모르겠으면 **\`/자료\`** 에 그냥 자연어로 적으세요(예: \`/자료
중2 영어 비교급 시험지 만들어줘\`). 알맞은 생성기로 안내·실행해 줍니다.

빠진 정보가 있으면 클로드가 꼭 필요한 것만 짧게 물어보고, 나머지는 합리적
기본값으로 진행합니다. "알아서"라고 하면 전부 기본값으로 만들어요.

## 파일로 바로 보기 (인쇄·면접 샘플용)
자료를 만들면 **자동으로 파일을 만들어 바로 전달**합니다. 화면만 보고 싶으면
"파일은 됐어"라고 하면 돼요. **한글(.hwpx)** 이 필요하면 "한글로 줘"처럼 말하세요.

- **\`/시험지\`** → 전용 시험지 PDF(\`scripts/exam-pdf.mjs\` → \`exam_pdf.py\`, WeasyPrint):
  브랜드 표지·유의사항·응시표·네이비 섹션바·문항 배지·정답표·해설까지 완성형.
- **\`/단어장\`** → 전용 단어장 PDF(\`scripts/vocab-pdf.mjs\`): 마룬 헤더·품사 배지·
  네이비 섹션바·번호·IPA·예문·해석.
- 그 밖의 모듈 → **워드(.docx)+PDF**(발표는 PPT+PDF). \`scripts/export.mjs\`(Node
  변환기)가 \`outputs/\`에 만듭니다. PDF는 Chromium + 번들 한글 폰트로 렌더링해
  한글·발음기호도 안 깨져요.

\`\`\`bash
# 스킬이 자동으로 호출하지만, 직접 쓸 수도 있어요:
node scripts/export.mjs --in "outputs/시험지.md" --format docx,pdf --out "outputs/시험지" --title "시험지"
node scripts/export.mjs --in "outputs/발표.md"   --format pptx,pdf --out "outputs/발표"
\`\`\`

> 처음 한 번은 \`npm install\` 이 필요합니다(변환에 \`docx\`·\`hwpx-js\`·\`pptxgenjs\`·\`playwright\` 사용).

## 명령 목록

| 명령 | 이름 | 용도 |
|---|---|---|
| \`/자료\` | 라우터 | 자연어로 적으면 알맞은 생성기로 안내·실행 |
${rows}

## 다시 생성하기
모듈(시스템 프롬프트·옵션 등)을 \`src/modules.ts\`에서 고친 뒤 다시 만들면 됩니다.

\`\`\`bash
npm run skills:build
\`\`\`

> 이 폴더의 \`*/SKILL.md\` 파일은 위 명령으로 생성됩니다. 손으로 고치지 말고
> \`src/modules.ts\`를 고친 뒤 재생성하세요. (이 README는 생성기가 함께 갱신합니다.)
`;
}

// --- run -------------------------------------------------------------------
const modules = listModules();
await mkdir(SKILLS_DIR, { recursive: true });

// Remove previously generated skill folders (those whose slug we own), so
// renamed/removed modules don't leave stale commands behind.
const owned = new Set([...Object.values(SLUG), ROUTER_SLUG]);
if (existsSync(SKILLS_DIR)) {
  for (const entry of await readdir(SKILLS_DIR, { withFileTypes: true })) {
    if (entry.isDirectory() && owned.has(entry.name)) {
      await rm(path.join(SKILLS_DIR, entry.name), { recursive: true, force: true });
    }
  }
}

let count = 0;
for (const m of modules) {
  const slug = SLUG[m.id];
  if (!slug) {
    console.warn(`! no slug for module "${m.id}" — skipped`);
    continue;
  }
  const dir = path.join(SKILLS_DIR, slug);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "SKILL.md"), buildSkill(m), "utf8");
  console.log(`skill  /${slug}  ←  ${m.id}`);
  count += 1;
}

// Natural-language router skill (/자료).
const routerDir = path.join(SKILLS_DIR, ROUTER_SLUG);
await mkdir(routerDir, { recursive: true });
await writeFile(path.join(routerDir, "SKILL.md"), buildRouter(modules), "utf8");
console.log(`skill  /${ROUTER_SLUG}  ←  (router)`);
count += 1;

await writeFile(path.join(SKILLS_DIR, "README.md"), buildReadme(modules), "utf8");
console.log(`\n${count} skills written to .claude/skills/`);
