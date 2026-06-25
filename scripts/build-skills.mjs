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

function buildBody(m) {
  const slug = SLUG[m.id];
  const inputs = [renderGuide(m.guide), renderOptions(m.options), renderSource(m.source)]
    .filter(Boolean)
    .join("\n");

  const ref = m.referenceExample
    ? `\n\n## 3) 참고 예시 — 스타일·품질 기준 (내용은 절대 복사하지 말 것)\n아래는 **형식과 품질의 기준**일 뿐입니다. 짜임새·난이도·해설 어투만 맞추고, 내용·문장·예문은 매번 새로 만드세요.\n\n\`\`\`markdown\n${m.referenceExample}\n\`\`\``
    : "";

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

## ${m.referenceExample ? "4" : "3"}) 출력
- 결과 전체를 깔끔한 마크다운으로 **이 대화에 바로** 출력하세요.
- 다 만든 뒤 한 줄로 제안하세요: \`파일로 저장(.md)하거나, 특정 부분을 고칠까요?\`
- 사용자가 저장을 원하면 \`outputs/\` 폴더에 \`.md\` 파일로 저장하세요(폴더가 없으면 만들기).
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

빠진 정보가 있으면 클로드가 꼭 필요한 것만 짧게 물어보고, 나머지는 합리적
기본값으로 진행합니다. "알아서"라고 하면 전부 기본값으로 만들어요.

## 명령 목록

| 명령 | 이름 | 용도 |
|---|---|---|
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
const owned = new Set(Object.values(SLUG));
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

await writeFile(path.join(SKILLS_DIR, "README.md"), buildReadme(modules), "utf8");
console.log(`\n${count} skills written to .claude/skills/`);
