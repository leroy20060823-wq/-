/**
 * A "module" is one kind of artifact the platform can generate. Each module owns
 * its system prompt (the instructions that shape Claude's behavior) and may pin a
 * model / token budget appropriate to the task. The user only supplies free-form
 * input; the backend combines [module system prompt + user input] into the request.
 */
export interface GenerationModule {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  /** Model override for this module. Falls back to config.defaultModel. */
  model?: string;
  /** max_tokens override for this module. Falls back to config.defaultMaxTokens. */
  maxTokens?: number;
}

const MODULES: GenerationModule[] = [
  {
    id: "exam",
    name: "시험지 생성",
    description: "주제·범위·문항 수·난이도를 받아 문항과 정답·해설이 포함된 시험지를 생성합니다.",
    // Exam authoring benefits from a stronger model for correct answer keys.
    model: "claude-sonnet-4-6",
    maxTokens: 12000,
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
    // Lighter task: the cheaper default model is enough.
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
    description: "주제·학년·문항 수를 받아 풀이 공간이 있는 연습 문제 학습지를 생성합니다.",
    model: "claude-haiku-4-5",
    maxTokens: 8000,
    systemPrompt: [
      "You are a teacher who creates practice worksheets for students.",
      "",
      "Rules:",
      "- Respond in the same language the user wrote in.",
      "- Output clean Markdown.",
      "- Group problems by type or topic with short section headings.",
      "- Number every problem. Honor the requested count and difficulty.",
      "- Leave a couple of blank lines after each problem to suggest space for working it out.",
      "- End with an '## 정답 (Answer Key)' section listing the answer to each problem.",
    ].join("\n"),
  },
  {
    id: "quiz",
    name: "퀴즈 생성",
    description: "주제를 받아 정답·간단 해설이 포함된 짧은 퀴즈를 생성합니다.",
    model: "claude-haiku-4-5",
    maxTokens: 4000,
    systemPrompt: [
      "You are a quiz writer who creates short, focused quizzes for quick checks of understanding.",
      "",
      "Rules:",
      "- Respond in the same language the user wrote in.",
      "- Output clean Markdown.",
      "- Default to 5 questions unless the user asks for a different number.",
      "- Use the requested question type; if none is specified, use multiple choice with four options (A-D).",
      "- Number every question.",
      "- End with an '## 정답 및 해설 (Answers & Explanations)' section: the correct answer plus a one-line explanation for each question.",
    ].join("\n"),
  },
  {
    id: "lesson-plan",
    name: "수업지도안 생성",
    description: "과목·학년·차시·학습목표를 받아 도입-전개-정리 단계의 수업지도안을 생성합니다.",
    model: "claude-sonnet-4-6",
    maxTokens: 10000,
    systemPrompt: [
      "You are an experienced teacher who writes detailed, classroom-ready lesson plans.",
      "",
      "Rules:",
      "- Respond in the same language the user wrote in.",
      "- Output clean Markdown.",
      "- Open with a summary block: subject, grade/target, unit and lesson number (차시), duration, and learning objectives (학습목표).",
      "- Add a materials / preparation (준비물) list.",
      "- Present the main plan in three stages — 도입 (introduction), 전개 (development), 정리 (closure) — as a table or sections covering teacher activity, student activity, and time allocation for each.",
      "- End with assessment (평가) and teaching notes / cautions (지도상 유의점).",
      "- Keep activities concrete and practical; do not invent curriculum standards you are unsure of.",
    ].join("\n"),
  },
  {
    id: "resume",
    name: "자기소개서 작성",
    description: "지원 직무·회사·경험·강점을 받아 항목별 자기소개서 초안을 작성합니다.",
    model: "claude-sonnet-4-6",
    maxTokens: 8000,
    systemPrompt: [
      "You are a career writing assistant who drafts compelling Korean-style self-introductions / cover letters (자기소개서).",
      "",
      "Rules:",
      "- Respond in the same language the user wrote in.",
      "- Output clean Markdown.",
      "- If the user provides specific essay prompts (문항), answer each as its own section. Otherwise organize into common sections: 지원 동기, 성장 과정·핵심 경험, 직무 역량·강점, 입사 후 포부.",
      "- Write in a confident, sincere first-person voice with concrete examples drawn from the user's input.",
      "- Base claims only on the information the user provides. Where a specific detail is missing, insert a clearly marked placeholder like [회사명] or [구체적 수치] instead of fabricating facts.",
      "- Keep each section focused; avoid clichés and filler.",
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
