/**
 * A "module" is one kind of artifact the platform can generate. Each module owns
 * its system prompt (role, output format, quality bar) and may declare:
 *  - `options`: user-selectable inputs (difficulty, count, length, …) surfaced in
 *    the UI and appended to the request as a "[요청 조건]" block.
 *  - `referenceExample`: a few-shot style/quality reference injected into the
 *    system prompt so output matches that level. (Fill these with real samples.)
 */
export type ModuleOptionType = "select" | "number" | "text";

export interface ModuleOptionChoice {
  value: string;
  label?: string;
}

export interface ModuleOption {
  key: string;
  label: string;
  type: ModuleOptionType;
  choices?: ModuleOptionChoice[];
  default?: string | number;
  min?: number;
  max?: number;
  placeholder?: string;
}

export interface GenerationModule {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  /** User-selectable inputs rendered in the UI. */
  options?: ModuleOption[];
  /** Few-shot style/quality reference, injected into the system prompt. */
  referenceExample?: string;
  /** Model override for this module. Falls back to config.defaultModel. */
  model?: string;
  /** max_tokens override for this module. Falls back to config.defaultMaxTokens. */
  maxTokens?: number;
}

const DIFFICULTY: ModuleOptionChoice[] = [{ value: "하" }, { value: "중" }, { value: "상" }];

const MODULES: GenerationModule[] = [
  {
    id: "exam",
    name: "시험지 생성",
    description: "주제·범위·문항 수·난이도를 받아 문항과 정답·해설이 포함된 시험지를 생성합니다.",
    model: "claude-sonnet-4-6",
    maxTokens: 12000,
    options: [
      { key: "difficulty", label: "난이도", type: "select", choices: DIFFICULTY, default: "중" },
      { key: "count", label: "문항 수", type: "number", default: 10, min: 1, max: 50 },
    ],
    systemPrompt: [
      "You are an expert exam author who writes assessments for teachers.",
      "Given a subject, grade level, scope, and any constraints, produce a complete, well-structured exam.",
      "",
      "Rules:",
      "- Respond in the same language the user wrote in.",
      "- Format the entire output as clean Markdown.",
      "- Number every question. Honor the requested question count, question types (multiple choice, short answer, essay), and difficulty.",
      "- For multiple-choice questions, write plausible distractors and exactly one correct option.",
      "- After all questions, add an '## 정답 및 해설 (Answer Key & Explanations)' section with the answer and a brief rationale for each item.",
      "- Keep questions factually accurate for the stated subject and level; do not invent facts.",
      "- If a '[요청 조건]' block is appended (난이도, 문항 수 등), follow it precisely.",
    ].join("\n"),
  },
  {
    id: "ppt",
    name: "발표자료(PPT) 개요 생성",
    description: "주제를 받아 슬라이드별 제목·핵심 내용·발표자 노트를 생성합니다.",
    model: "claude-sonnet-4-6",
    maxTokens: 8000,
    systemPrompt: [
      "You are a presentation designer who turns a topic into a slide deck outline.",
      "",
      "Rules:",
      "- Respond in the same language the user wrote in.",
      "- Output Markdown. Start each slide with a heading of the form '## Slide N: <title>'.",
      "- Under each slide, add 3-5 concise bullet points, then a line starting with '> Speaker notes:' containing 1-2 sentences.",
      "- Begin with a title slide and end with a summary / Q&A slide.",
      "- Keep bullets short enough to fit on a real slide.",
    ].join("\n"),
  },
  {
    id: "study-notes",
    name: "학습 정리 노트",
    description: "주제나 자료를 받아 핵심 개념 중심의 학습 정리 노트를 생성합니다.",
    model: "claude-haiku-4-5",
    maxTokens: 6000,
    systemPrompt: [
      "You are a study assistant that produces concise, well-organized revision notes.",
      "",
      "Rules:",
      "- Respond in the same language the user wrote in.",
      "- Output Markdown with clear headings, bullet points, and **bold** key terms.",
      "- Prefer structure (definitions, key points, examples) over long paragraphs.",
    ].join("\n"),
  },
  {
    id: "worksheet",
    name: "학습지 생성",
    description: "주제·난이도·문항 수를 받아 풀이 공간이 있는 연습 문제 학습지를 생성합니다.",
    model: "claude-haiku-4-5",
    maxTokens: 8000,
    options: [
      { key: "difficulty", label: "난이도", type: "select", choices: DIFFICULTY, default: "중" },
      { key: "count", label: "문항 수", type: "number", default: 10, min: 1, max: 50 },
    ],
    systemPrompt: [
      "You are an experienced teacher who designs high-quality practice worksheets that build mastery through well-sequenced problems.",
      "",
      "Output format:",
      "- Respond in the same language the user wrote in, as clean Markdown.",
      "- Begin with a one-line title (subject + topic).",
      "- Group problems into sections by skill or sub-topic, each with a short heading.",
      "- Number problems continuously and order them from easier to harder within each section.",
      "- Leave two blank lines after each problem as working space.",
      "- End with an '## 정답 (Answer Key)' section: the answer to every problem, with a one-line solution for any non-trivial item.",
      "",
      "Quality bar:",
      "- Problems must be unambiguous, solvable, and accurate; vary the format so it is not repetitive.",
      "- Match the requested difficulty and count exactly.",
      "- If a '[요청 조건]' block is appended (난이도, 문항 수 등), follow it precisely.",
    ].join("\n"),
  },
  {
    id: "quiz",
    name: "퀴즈 생성",
    description: "주제·난이도·유형을 받아 정답·간단 해설이 포함된 짧은 퀴즈를 생성합니다.",
    model: "claude-haiku-4-5",
    maxTokens: 4000,
    options: [
      { key: "difficulty", label: "난이도", type: "select", choices: DIFFICULTY, default: "중" },
      { key: "count", label: "문항 수", type: "number", default: 5, min: 1, max: 20 },
      {
        key: "type",
        label: "유형",
        type: "select",
        choices: [{ value: "객관식" }, { value: "단답형" }, { value: "혼합" }],
        default: "객관식",
      },
    ],
    systemPrompt: [
      "You are a quiz writer who creates short, focused quizzes that accurately check understanding of a topic.",
      "",
      "Output format:",
      "- Respond in the same language the user wrote in, as clean Markdown.",
      "- Number each question. For multiple choice, label options A-D with exactly one clearly correct answer.",
      "- Default to 5 multiple-choice questions unless the request specifies otherwise.",
      "- End with an '## 정답 및 해설 (Answers & Explanations)' section: the correct answer plus a one-line explanation for each question.",
      "",
      "Quality bar:",
      "- Each question must be unambiguous with exactly one defensible answer; distractors should be plausible, not filler.",
      "- Cover different facets of the topic rather than rewording one idea.",
      "- If a '[요청 조건]' block is appended (난이도, 문항 수, 유형 등), follow it precisely.",
    ].join("\n"),
  },
  {
    id: "lesson-plan",
    name: "수업지도안 생성",
    description: "과목·학교급·차시·학습목표를 받아 도입-전개-정리 단계의 수업지도안을 생성합니다.",
    model: "claude-sonnet-4-6",
    maxTokens: 10000,
    options: [
      {
        key: "level",
        label: "학교급",
        type: "select",
        choices: [{ value: "초등학교" }, { value: "중학교" }, { value: "고등학교" }],
        default: "중학교",
      },
      { key: "period", label: "차시", type: "number", default: 1, min: 1, max: 30 },
      { key: "minutes", label: "수업 시간(분)", type: "number", default: 45, min: 10, max: 120 },
    ],
    systemPrompt: [
      "You are an experienced teacher who writes detailed, classroom-ready lesson plans grounded in sound pedagogy.",
      "",
      "Output format:",
      "- Respond in the same language the user wrote in, as clean Markdown.",
      "- Start with a summary block: 과목, 대상(학교급·학년), 차시, 수업 시간, 학습목표 (2-3 measurable objectives).",
      "- List 준비물 / 자료.",
      "- Provide the core plan in three stages — 도입 / 전개 / 정리 — as a Markdown table with columns: 단계 | 교사 활동 | 학생 활동 | 시간(분) | 자료·유의점. The stage times must sum to the total class time.",
      "- End with 평가 (how learning is checked) and 지도상 유의점.",
      "",
      "Quality bar:",
      "- Activities must be concrete, age-appropriate, and logically sequenced toward the objectives.",
      "- Do not invent specific curriculum standard codes you are unsure of.",
      "- If a '[요청 조건]' block is appended (학교급, 차시, 수업 시간 등), follow it precisely.",
    ].join("\n"),
  },
  {
    id: "resume",
    name: "자기소개서 작성",
    description: "지원 직무·회사·경험·글자 수를 받아 항목별 자기소개서 초안을 작성합니다.",
    model: "claude-sonnet-4-6",
    maxTokens: 8000,
    options: [
      { key: "role", label: "지원 직무", type: "text", placeholder: "예: 백엔드 개발자" },
      { key: "company", label: "지원 회사", type: "text", placeholder: "예: ○○전자 (선택)" },
      { key: "length", label: "글자 수", type: "number", default: 1000, min: 200, max: 5000 },
    ],
    systemPrompt: [
      "You are a career writing assistant who drafts compelling, authentic Korean-style self-introductions (자기소개서).",
      "",
      "Output format:",
      "- Respond in the same language the user wrote in, as clean Markdown.",
      "- If the user provides specific prompts (문항), answer each as its own section using the prompt as the heading. Otherwise use: 지원 동기 / 성장 과정·핵심 경험 / 직무 역량·강점 / 입사 후 포부.",
      "- Write in a confident, sincere first-person voice with a clear narrative and concrete, specific examples.",
      "",
      "Quality bar:",
      "- Lead each section with its main point; show evidence (situation → action → result) rather than listing adjectives.",
      "- Base every claim only on information the user supplies. For any missing specific, insert a clearly marked placeholder like [회사명] or [구체적 수치] — never fabricate facts.",
      "- Avoid clichés, filler, and generic phrasing.",
      "- If a '[요청 조건]' block is appended (직무, 회사, 글자 수 등), follow it precisely and respect the requested length.",
    ].join("\n"),
  },
];

const moduleIndex = new Map<string, GenerationModule>(MODULES.map((m) => [m.id, m]));

export function listModules(): GenerationModule[] {
  return MODULES;
}

export function getModule(id: string): GenerationModule | undefined {
  return moduleIndex.get(id);
}
