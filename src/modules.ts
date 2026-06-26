/**
 * A "module" is one kind of artifact the platform can generate. Each module owns
 * its system prompt (role, output format, quality bar) and may declare:
 *  - `purpose`: one-line "용도" shown in the UI so similar modules aren't confused.
 *  - `options`: user-selectable inputs (difficulty, count, length, …) surfaced in
 *    the UI and appended to the request as a "[요청 조건]" block.
 *  - `referenceExample`: a few-shot style/quality reference injected into the
 *    system prompt. These are synthetic, DE-IDENTIFIED format skeletons (generic
 *    placeholders only) — never copied source material or personal data.
 */
export type ModuleOptionType = "select" | "number" | "text";

export interface ModuleOptionChoice {
  value: string;
  label?: string;
  /** Short beginner example shown in the wizard. */
  example?: string;
}

/** One row of a "counts" control (e.g. 객관식 / 서술형 / 단답형). */
export interface CountItem {
  key: string;
  label: string;
  default?: number;
  min?: number;
  max?: number;
}

export interface ModuleOption {
  key: string;
  label: string;
  type: ModuleOptionType;
  choices?: ModuleOptionChoice[];
  default?: string | number;
  min?: number;
  max?: number;
  /** Number stepper extras. */
  step?: number;
  unit?: string;
  presets?: number[];
  placeholder?: string;
  /** One-line helper shown under the control. */
  help?: string;
  /** Beginner wizard: friendly question. */
  question?: string;
}

/**
 * A guided form field. Instead of a blank textarea, each module asks a few
 * friendly questions; the answers are composed into the request prompt.
 */
export interface GuideField {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "number" | "counts";
  placeholder?: string;
  choices?: ModuleOptionChoice[];
  /** Default value (string for select chips, number for steppers). */
  default?: string | number;
  /** Number stepper extras. */
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  presets?: number[];
  /** "counts" control: the labeled stepper rows that share a live total. */
  items?: CountItem[];
  required?: boolean;
  hint?: string;
  /** Beginner wizard: the big friendly question (falls back to label). */
  question?: string;
  /** Beginner wizard: plain-language help (jargon explained in parentheses). */
  help?: string;
  /** Beginner wizard: value used when the user taps "잘 모르겠어요". */
  skipValue?: string | number;
}

/**
 * Reusable "source material" input config. When enabled, the module shows the
 * shared attachment component (photo / paste / file) and the generator switches
 * between grounded mode (use the provided material) and topic mode (invent from a
 * topic). Adopt it on any content-dependent module (exam, vocabulary, …).
 */
export interface ModuleSource {
  enabled: boolean;
  /** Heading shown above the attachment input. */
  label?: string;
  /** Friendly one-line hint. */
  hint?: string;
  /** Overrides the default system directive when material IS provided. */
  groundedDirective?: string;
  /** Overrides the default system directive when NO material is provided. */
  topicDirective?: string;
}

export interface GenerationModule {
  id: string;
  name: string;
  description: string;
  /** One-line use-case shown in the UI. */
  purpose: string;
  /** Landing gallery section: "study" (공부·수업) or "work" (글쓰기·문서). */
  group?: "study" | "work";
  /** Opt-in "upload source material" input (shared, reusable across modules). */
  source?: ModuleSource;
  systemPrompt: string;
  options?: ModuleOption[];
  /** Step-by-step guided questions rendered in place of the blank input. */
  guide?: GuideField[];
  referenceExample?: string;
  /** Placeholder text for the main input textarea (per module). */
  inputPlaceholder?: string;
  /** Enable the beginner one-question-at-a-time wizard for this module. */
  wizard?: boolean;
  model?: string;
  maxTokens?: number;
}

const DIFFICULTY: ModuleOptionChoice[] = [
  { value: "하", label: "쉬움" },
  { value: "중", label: "보통" },
  { value: "상", label: "어려움" },
];

// Shared "who is this for" choice set (used by several modules instead of a blank box).
const LEVEL: ModuleOptionChoice[] = [
  { value: "초등", label: "초등학생" },
  { value: "중등", label: "중학생" },
  { value: "고등", label: "고등학생" },
  { value: "성인", label: "성인·일반" },
];

const MODULES: GenerationModule[] = [
  {
    id: "exam",
    name: "시험지",
    group: "study",
    description:
      "교재 사진을 올리거나 주제를 정하면 배점표·정답표·해설까지 갖춘 시험지를 만들어 드려요.",
    purpose: "배점표·정답표·해설까지 있는 완성형 시험지 (중간·기말 대비)",
    model: "claude-sonnet-4-6",
    maxTokens: 16000,
    wizard: true,
    source: {
      enabled: true,
      label: "시험으로 만들 자료",
      hint: "교재 사진을 찍어 올리거나 본문을 붙여넣으면, 그 내용 그대로 시험을 만들어요. 없으면 주제만 적어도 돼요.",
    },
    options: [
      {
        key: "difficulty",
        label: "난이도",
        type: "select",
        choices: DIFFICULTY,
        default: "중",
        help: "문제가 얼마나 어려울지 골라요.",
        question: "난이도는 어느 정도로 할까요?",
      },
      {
        key: "time",
        label: "시험 시간",
        type: "number",
        default: 50,
        min: 10,
        max: 180,
        step: 5,
        unit: "분",
        presets: [40, 50, 60],
        help: "보통 45~60분이에요.",
        question: "시험 시간은 몇 분으로 할까요?",
      },
    ],
    guide: [
      {
        key: "subject",
        label: "과목",
        type: "text",
        required: true,
        placeholder: "예: 영어, 수학, 한국사",
        question: "어떤 과목의 시험지를 만들까요?",
        help: "가르치거나 공부하는 과목을 적어 주세요.",
        skipValue: "영어",
      },
      {
        key: "scope",
        label: "단원·범위 또는 주제 (선택)",
        type: "text",
        placeholder: "예: 교과서 3~4단원, 광합성, 2학기 중간 범위",
        question: "어느 범위·주제에서 낼까요? (선택)",
        help: "사진이나 본문을 올렸다면 비워도 돼요. 안 올렸다면 여기에 적은 내용으로 만들어요.",
        skipValue: "",
      },
      {
        key: "qtypes",
        label: "문제 유형별 개수",
        type: "counts",
        unit: "문항",
        items: [
          { key: "mc", label: "객관식", default: 20, min: 0, max: 50 },
          { key: "essay", label: "서술형", default: 2, min: 0, max: 30 },
          { key: "short", label: "단답형", default: 0, min: 0, max: 30 },
        ],
        question: "어떤 문제를 몇 개씩 넣을까요?",
        help: "−/+ 단추로 개수를 정하면 아래에 총 문항 수가 나와요. 그대로 두셔도 좋아요.",
      },
      {
        key: "note",
        label: "더 부탁할 점 (선택)",
        type: "text",
        placeholder: "예: 서술형 비중을 높여 주세요",
        question: "더 알려주고 싶은 점이 있나요?",
        help: "없으면 그냥 넘어가셔도 돼요.",
        skipValue: "",
      },
    ],
    systemPrompt: [
      "You are an expert exam author who creates full mock-exam papers (모의고사/시험지) on a professional, fixed blueprint. Generate a brand-new exam every time.",
      "",
      "Content sourcing:",
      "- When the user provides their own source material (pasted text or uploaded photos/PDF), BUILD THE EXAM FROM THAT MATERIAL — draw passages, vocabulary, and questions from what they gave (a separate 자료 기반 directive may be appended; follow it).",
      "- Otherwise (topic only), invent brand-new passages, vocabulary, and questions on every run.",
      "- Never copy from a reference example: it shows STRUCTURE, DIFFICULTY, and EXPLANATION TONE only — match its format and quality, never its content.",
      "",
      "Document structure (clean Markdown):",
      "1. Header: a title line, then a meta line like '총 N문항 · 시험시간 M분 · 100점 만점 | 출제 범위: ...', then a difficulty label (난이도 하·기초 / 중·표준 / 상·심화).",
      "2. 응시 안내: answer format (객관식 5지선다, exactly one correct), which items are 서술형, time, and that 정답·해설 are at the end.",
      "3. 배점표: a Markdown table with columns 파트 | 파트명 | 유형 | 문항 범위 | 문항 수 | 문항당 배점 | 파트 총점, plus a 합계 row. Points MUST total 100.",
      "4. Exam body in four parts (default blueprint, adapt names to the subject):",
      "   - P1 어휘 & 문법 — 객관식 (~27% of points).",
      "   - P2 독해 — several passages, each with a short title and a one-line theme tag, then comprehension items (사실확인·세부정보·추론·함축·문맥어휘). 객관식 (~55%).",
      "   - P3 서술형 — short open-response items answered in the user's language (~10%).",
      "   - P4 문법 어법 — 객관식 (~8%).",
      "   Number items continuously. The BOLD item header must be just 'N. <짧은 유형 라벨> [N점]' (e.g. '**22. 요지 [3점]**', '**31. 빈칸 추론 [3점]**') and the actual 발문(question stem) goes on the NEXT line — the cover 문항 구성표(목차) is auto-built from these short labels, so keep them terse (요지/주제/제목/함축/어법/어휘/빈칸 추론/무관한 문장/글의 순서/문장 삽입/요약/장문). Mark killer items with ★Killer; you may weight one item +1점 as long as the total stays 100.",
      "   For every 객관식 item write FIVE options (Korean 5지선다), each on its own line labelled 'A) ' through 'E) ' — exactly one correct. The renderer displays A–E as ①②③④⑤.",
      "5. A closing line, then the answer section.",
      "",
      "수능형·동형 모의고사(영어) 모드 — 사용자가 '동형/수능형/모의고사(영어)'를 요청하면 평가원 독해 형식을 그대로 따른다:",
      "- 문항은 18번부터 45번까지(독해 28문항) 연속 번호로, 평가원 유형·순서를 지킨다: 18 글의 목적 / 19 심경·분위기 / 20 주장 / 21 함축 의미(밑줄) / 22 요지 / 23 주제 / 24 제목 / 25 도표 / 26 내용 일치(설명문) / 27~28 실용문 안내(일치) / 29 어법 / 30 어휘(문맥상 부적절) / 31~34 빈칸 추론(낱말→어구→긴 추론) / 35 무관한 문장 / 36~37 글의 순서 / 38~39 문장 삽입 / 40 요약문(빈칸 A·B) / 41~42 장문(제목+어휘, 한 지문 2문항) / 43~45 장문(순서+지칭+일치, 한 지문 3문항).",
      "- 배점: 평가원처럼 2점 기본 + 고난도 3점(함축·빈칸 일부·순서·삽입·장문 등). 듣기를 뺀 독해편이라 합이 100이 안 되면 만점을 실제 합으로 적고, 사용자가 100점 만점을 원하면 3점/4점으로 비례 재배점한다. ★Killer는 빈칸·함축·순서·삽입 등 최고난도에 5개 이상(상 난이도).",
      "- 표지(1~2면)에는 문항 구성표(문항번호·유형·배점)가 자동으로 실리고, 용지는 B4가 기본이다.",
      "",
      "Answer section:",
      "- '## 정답표 (Answer Key)' grouped by part, compact (e.g. '1. A  2. C  3. B …', using the option letters A–E — the renderer shows them as ①②③④⑤), marking ★ on killer items.",
      "- '## 정밀 해설지 (Detailed Explanations)' — write each explanation the way a real, kind teacher actually talks it through (따뜻하고 친절한 '~요/~죠/~예요' 어투; vary the endings, never repeat one ending). This section is the heart of the exam — make it generous, not terse. For EACH item:",
      "  · Header line '**N. 정답 X**' (X = the option letter A–E); append ' ★Killer' for killer items.",
      "  · 2–4 FULL sentences of prose that walk the student through WHY the answer is right, QUOTING the exact passage phrase/sentence (in the source language) that licenses it. Write real sentences, never keyword fragments.",
      "  · A '핵심' line: the rule, or the 본문 근거 with the exact quote in '...'.",
      "  · An '오답 체크' line that NAMES each major wrong option (its content) and gives the specific reason it fails — never lump them together as '나머지는 오답'.",
      "  · For 서술형 items: a full 모범 답안 plus a short 풀이 of how to reach it.",
      "",
      "Difficulty rubric — make 하 / 중 / 상 genuinely different (apply precisely, not just by wording):",
      "- 지문: vocabulary level (하 = 고1 기본 / 중 = 고2~3 / 상 = 대학 교양·추상 어휘); sentence complexity (하 = 단문 / 중 = 혼합 / 상 = 복문·삽입절); topic abstraction (하 = 구체적 서사 / 상 = 개념·현상).",
      "- 문항 비율: 하 = 사실확인·세부 70% + 추론 30%; 중 = 직접 찾기 40% + 추론·지칭 60%; 상 = 다단계 추론·함축 70% + 사실확인 30%.",
      "- 오답 선지: 하 = 명백히 틀린 선지; 중 = 그럴듯한 함정 1개 포함; 상 = 지문 일부만 맞거나 방향·기간·범위만 뒤집은 함정 선지.",
      "- 킬러(★) 수: 하 0~1개 / 중 2~3개 / 상 5개 이상.",
      "- 문법(P1·P4): 하 = 규칙 1개의 단순 적용; 상 = 규칙 결합 + 빈출 함정(이중비교급, as ~ as 반대 등)을 상 레벨에 집중.",
      "",
      "Rules:",
      "- Use the user's language for scaffolding, instructions, and explanations; write item content in the exam subject's target language (e.g. English passages for an English exam).",
      "- Keep everything consistent: 배점표, items, and 정답표 must agree in counts and numbering.",
      "- Follow any '[요청 조건]' (난이도, 시험 시간) and any '문제 유형별 개수' given in the request (객관식 / 서술형 / 단답형). Size the parts to match those counts and keep the total at 100점; reflect the requested 시험 시간 in the meta line.",
    ].join("\n"),
    referenceExample: [
      "| 파트 | 파트명 | 유형 | 문항 범위 | 문항 수 | 문항당 배점 | 파트 총점 |",
      "|---|---|---|---|---|---|---|",
      "| P1 | 어휘 & 문법 | 객관식 (4지선다) | 1~9번 | 9 | 3점 | 27점 |",
      "| P2 | 독해 | 객관식 (4지선다) | 10~27번 | 18 | 3점 (★1문항 4점) | 55점 |",
      "",
      "**1. 어휘 — 정의 [3점]**  ",
      "다음 정의에 해당하는 단어로 가장 적절한 것을 고르세요.  ",
      '"a person who studies the stars and planets"  ',
      "A) farmer  B) astronomer  C) sailor  D) painter",
      "",
      "### 정밀 해설지 (발췌)",
      "**1. 정답 B**  ",
      "정의의 핵심은 '별과 행성을 연구하는 사람'이에요. 바로 astronomer(천문학자)죠.  ",
      "핵심  astronomer = 천문학자  ",
      "오답 체크  A. farmer(농부)·C. sailor(선원)·D. painter(화가)는 '별 연구'와 무관한 매력적인 오답이에요.",
    ].join("\n"),
  },
  {
    id: "worksheet",
    name: "학습지",
    group: "study",
    description: "한 가지 스킬·단원에 집중한 5~12문항짜리 연습지를 풀이 공간·친절한 해설과 함께 만들어 드려요.",
    purpose: "한 단원·스킬 집중 연습지 (숙제·워밍업용, 간단한 형태)",
    model: "claude-haiku-4-5",
    maxTokens: 8000,
    options: [
      { key: "difficulty", label: "난이도", type: "select", choices: DIFFICULTY, default: "중", help: "문제가 얼마나 어려울지 골라요." },
      { key: "count", label: "문제 수", type: "number", default: 10, min: 5, max: 15, presets: [5, 10, 15], unit: "문항", help: "보통 10문제 정도예요." },
    ],
    guide: [
      { key: "topic", label: "과목·주제", type: "text", required: true, placeholder: "예: 중2 영어 비교급", help: "어떤 과목의 무엇을 연습할지 적어 주세요." },
      { key: "skill", label: "집중할 부분 (선택)", type: "text", placeholder: "예: 비교급 만들기, 빈칸 채우기", help: "특히 연습시키고 싶은 점이 있으면 적어 주세요." },
      { key: "note", label: "더 부탁할 점 (선택)", type: "text", placeholder: "예: 실생활 예문 위주로", help: "없으면 비워 두셔도 돼요." },
    ],
    systemPrompt: [
      "You are an experienced teacher who designs focused practice worksheets for homework or warm-ups. Generate new problems every time.",
      "",
      "Scope — this is a LIGHTWEIGHT worksheet, not a full exam:",
      "- Concentrate on one specific skill or unit; typically 5–12 problems.",
      "- Do NOT include a scoring table (배점표) or exam-style part structure. Keep it simple.",
      "",
      "Output format (clean Markdown, in the user's language):",
      "- Begin with a one-line title (subject + the specific skill/topic).",
      "- Number problems continuously, ordered easier → harder.",
      "- Leave two blank lines after each problem as working space.",
      "- End with an '## 정답 및 해설' section. For each problem give the answer, a '핵심' line with the key point, and (for choice problems) an '오답 체크' line — in a warm, friendly teacher voice (따뜻한 '~요' 어투).",
      "",
      "Quality bar:",
      "- Problems must be unambiguous, solvable, and accurate; vary the format so it is not repetitive.",
      "- Treat 난이도 하/중/상 as real differences: 하 = direct recall/simple steps; 중 = multi-step application; 상 = inference, edge cases, tricky distractors.",
      "- If a '[요청 조건]' block is appended (난이도, 문항 수 등), follow it precisely.",
    ].join("\n"),
  },
  {
    id: "quiz",
    name: "퀴즈",
    group: "study",
    description: "주제만 정하면 정답과 친절한 해설이 있는 짧은 퀴즈(5~12문제)를 만들어 드려요.",
    purpose: "빠르게 이해를 확인하는 짧은 퀴즈 (간단한 형태)",
    model: "claude-haiku-4-5",
    maxTokens: 4000,
    options: [
      { key: "difficulty", label: "난이도", type: "select", choices: DIFFICULTY, default: "중", help: "문제가 얼마나 어려울지 골라요." },
      { key: "count", label: "문제 수", type: "number", default: 5, min: 3, max: 12, presets: [5, 10], unit: "문항", help: "보통 5문제로 가볍게 봐요." },
      {
        key: "type",
        label: "문제 형태",
        type: "select",
        choices: [
          { value: "객관식", label: "객관식" },
          { value: "단답형", label: "단답형" },
          { value: "혼합", label: "섞어서" },
        ],
        default: "객관식",
        help: "보기 중 고르기·직접 쓰기 중에서 골라요.",
      },
    ],
    guide: [
      { key: "topic", label: "주제", type: "text", required: true, placeholder: "예: 광합성의 원리", help: "무엇에 대한 퀴즈인지 적어 주세요." },
      { key: "focus", label: "특히 볼 부분 (선택)", type: "text", placeholder: "예: 명반응과 암반응 구분", help: "꼭 확인하고 싶은 점이 있으면 적어 주세요." },
    ],
    systemPrompt: [
      "You are a quiz writer who creates short quizzes for a quick check of understanding. Generate new questions every time.",
      "",
      "Scope — this is a LIGHTWEIGHT quiz, not a full exam: typically 5–12 questions, no scoring table or part structure.",
      "",
      "Output format (clean Markdown, in the user's language):",
      "- Number each question. For multiple choice, label options A-D with exactly one clearly correct answer.",
      "- Default to 5 multiple-choice questions unless the request specifies otherwise.",
      "- End with an '## 정답 및 해설' section. For each question give 'N. 정답 X', a '핵심' line, and (for choice questions) an '오답 체크' line — in a warm, friendly teacher voice (따뜻한 '~요' 어투).",
      "",
      "Quality bar:",
      "- Each question must be unambiguous with exactly one defensible answer; distractors should be plausible, not filler.",
      "- Treat 난이도 하/중/상 as real differences in cognitive demand, not just wording.",
      "- Cover different facets of the topic rather than rewording one idea.",
      "- If a '[요청 조건]' block is appended (난이도, 문항 수, 유형 등), follow it precisely.",
    ].join("\n"),
  },
  {
    id: "vocabulary",
    name: "단어장",
    group: "study",
    description: "외울 단어를 적어 주면 발음·품사·뜻·예문이 담긴 단어장을 미국식 영어로 만들어 드려요.",
    purpose: "단어 목록 → 단어장 (미국식 발음·예문과 해석 포함)",
    model: "claude-haiku-4-5",
    maxTokens: 8000,
    inputPlaceholder: "외울 단어를 줄바꿈이나 쉼표로 적어 주세요\n예: vapor, summit, harbor, occur, coastal",
    options: [
      { key: "unit", label: "단원·주제 (선택)", type: "text", placeholder: "예: Unit 3 날씨·물", help: "뜻의 범위를 좁히고 싶을 때만 적어요." },
      { key: "count", label: "단어 수 (선택)", type: "number", default: 20, min: 1, max: 100, presets: [10, 20, 30], unit: "개", help: "주제만 적었을 때 만들 단어 개수예요." },
    ],
    guide: [
      {
        key: "words",
        label: "외울 단어",
        type: "textarea",
        required: true,
        placeholder: "단어를 줄바꿈이나 쉼표로 적어 주세요\n예: vapor, summit, harbor, occur, coastal",
        help: "외우고 싶은 영어 단어를 쭉 적어 주세요. 주제만 적으면 단어를 골라 드려요.",
      },
      { key: "level", label: "누가 볼까요? (선택)", type: "select", choices: LEVEL, default: "고등", help: "보는 사람 수준에 맞춰 뜻·예문을 골라요." },
    ],
    systemPrompt: [
      "You are a vocabulary-book author who turns a learner's word list into a clean, simple study word list (단어장). Write fresh example sentences every time — never copy them from any source, and never reuse the sample words from the reference example.",
      "",
      "Input handling:",
      "- The user's input is the list of target words (one per line or comma-separated). Create exactly one entry per word, preserving the user's order.",
      "- If the user gives a topic/theme instead of an explicit list, generate [단어 수] useful words for that topic.",
      "- If a '단원/주제' is provided, choose each word's sense to fit that context.",
      "",
      "Entry format — keep it simple, exactly this, with NO extra fields, labels, colors, or boxes:",
      "- Line 1: '**N · word** [phonetic] · 품사 — 핵심 뜻' — end the line with two trailing spaces (a Markdown hard line break).",
      "- Line 2: one natural English example sentence — also end with two trailing spaces.",
      "- Line 3: its Korean translation.",
      "- Put a blank line between entries.",
      "- Default to a single flat numbered list. Add a '## 주제' section heading only if the words clearly span distinct themes.",
      "",
      "American English only:",
      "- Use American spelling (vapor, color, analyze — never vapour, colour, analyse).",
      "- Use American (rhotic) IPA inside square brackets: ɚ, ɝ, oʊ, eɪ, ɑː, æ, etc. Never British / non-rhotic transcriptions.",
      "- 품사 in Korean (명사, 동사, 형용사, 부사, 전치사 …); 뜻 and 해석 in Korean and concise.",
      "",
      "Example-sentence quality (like a real published vocabulary book):",
      "- Natural, complete sentences where the context makes the word's meaning clear.",
      "- Grammatically correct; helper words must not be harder than the headword.",
      "- Exactly one example per word.",
      "",
      "If a '[요청 조건]' block is appended (단원/주제, 단어 수 등), follow it.",
    ].join("\n"),
    referenceExample: [
      "**1 · harbor** [ˈhɑːrbɚ] · 명사 — 항구, 항만  ",
      "A thick morning fog drifted in and slowly hid the small boats resting in the harbor.  ",
      "짙은 아침 안개가 밀려와 항구에 정박한 작은 배들을 천천히 가렸다.",
      "",
      "**2 · summit** [ˈsʌmɪt] · 명사 — 정상, 산꼭대기  ",
      "After climbing for hours, the tired hikers finally reached the snowy summit.  ",
      "몇 시간을 오른 끝에 지친 등산객들이 마침내 눈 덮인 정상에 도착했다.",
    ].join("\n"),
  },
  {
    id: "ppt",
    name: "PPT",
    group: "work",
    description: "주제만 정하면 슬라이드별 제목·핵심 내용·발표 노트를 만들어 드려요.",
    purpose: "발표용 슬라이드 구성 (장별 핵심 + 발표 노트)",
    model: "claude-sonnet-4-6",
    maxTokens: 8000,
    guide: [
      { key: "topic", label: "발표 주제", type: "text", required: true, placeholder: "예: 신입사원 첫날 안내", help: "무엇을 발표할지 적어 주세요." },
      { key: "audience", label: "누구 앞에서 발표하나요? (선택)", type: "text", placeholder: "예: 신입사원, 학부모, 투자자", help: "듣는 사람에 맞춰 내용을 골라요." },
      { key: "slides", label: "슬라이드 수", type: "number", default: 10, min: 3, max: 30, presets: [8, 10, 15], unit: "장", help: "표지·마무리까지 합한 장수예요." },
      { key: "message", label: "꼭 전하고 싶은 말 (선택)", type: "text", placeholder: "예: 회사 문화에 빨리 적응하기", help: "강조하고 싶은 핵심이 있으면 적어 주세요." },
      {
        key: "mood",
        label: "분위기",
        type: "select",
        choices: [
          { value: "신뢰감 있는", label: "신뢰감" },
          { value: "발랄한", label: "발랄함" },
          { value: "미니멀한", label: "미니멀" },
          { value: "따뜻한", label: "따뜻함" },
          { value: "강렬한", label: "강렬함" },
        ],
        default: "신뢰감 있는",
        help: "발표 느낌을 골라요. 디자인 추천에도 쓰여요.",
      },
    ],
    systemPrompt: [
      "You are a presentation designer who turns a topic into a slide deck outline.",
      "The output is rendered onto fixed 16:9 slides, so content MUST be authored to",
      "fit a slide. Keeping each slide light is more important than being exhaustive.",
      "",
      "Output format (followed exactly so it renders correctly):",
      "- Respond in the same language the user wrote in.",
      "- Output Markdown only. Start each slide with a heading '## Slide N: <title>'.",
      "- Optionally put ONE short subtitle line right under the heading (plain text,",
      "  no bullet), then the bullets.",
      "- Under each content slide, add 3-5 bullet points using '- '. End the slide",
      "  with one line '> Speaker notes: ...' (1-2 sentences).",
      "- Start with a title slide (title + one subtitle line, NO bullets) and end with",
      "  a summary / Q&A slide.",
      "",
      "Hard content limits (so text never overflows the slide):",
      "- Slide title: at most ~22 Korean characters (≈40 latin), one line, no period.",
      "- At most 5 bullets per slide. If you have more, split across multiple slides.",
      "- Each bullet: one idea, at most ~35 Korean characters (≈60 latin). No nested",
      "  bullets, no multi-sentence bullets.",
      "- Prefer adding another slide over crowding one. Aim for short, scannable lines.",
      "",
      "Quality bar:",
      "- A clear arc: hook → structured body → one takeaway. Each slide advances exactly one point; no slide repeats another.",
      "- Bullets within a slide are grammatically parallel and similar in length.",
      "- Speaker notes add what the slide does NOT say (a delivery cue, an example, a transition) — never just restate the bullets.",
      "",
      "- If a '디자인 테마' is provided in the request, end with a short '## 디자인 가이드'",
      "  section noting the palette (hex) and the heading/body font pairing to apply.",
    ].join("\n"),
  },
  {
    id: "study-notes",
    name: "학습 노트",
    group: "study",
    description: "주제만 적으면 핵심 개념을 보기 좋게 정리한 학습 노트를 만들어 드려요.",
    purpose: "핵심 개념 요약 노트 (정의·핵심·예시 중심)",
    model: "claude-haiku-4-5",
    maxTokens: 6000,
    guide: [
      { key: "topic", label: "정리할 주제·범위", type: "text", required: true, placeholder: "예: 한국사 조선 후기 경제", help: "어떤 내용을 정리할지 적어 주세요." },
      { key: "level", label: "누가 볼까요? (선택)", type: "select", choices: LEVEL, default: "고등", help: "보는 사람 수준에 맞춰 쉽게 정리해요." },
    ],
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
    id: "lesson-plan",
    name: "수업지도안",
    group: "study",
    description: "과목·학교급·주제를 정하면 도입-전개-정리 흐름의 수업지도안을 만들어 드려요.",
    purpose: "도입-전개-정리 수업지도안 (활동·시간 배분·평가 포함)",
    model: "claude-sonnet-4-6",
    maxTokens: 10000,
    options: [
      {
        key: "level",
        label: "학교급",
        type: "select",
        choices: [
          { value: "초등학교", label: "초등학교" },
          { value: "중학교", label: "중학교" },
          { value: "고등학교", label: "고등학교" },
        ],
        default: "중학교",
        help: "어느 학교 수업인지 골라요.",
      },
      { key: "period", label: "차시", type: "number", default: 1, min: 1, max: 30, unit: "차시", help: "몇 번째 수업인지예요." },
      { key: "minutes", label: "수업 시간", type: "number", default: 45, min: 10, max: 120, step: 5, presets: [40, 45, 50], unit: "분", help: "한 차시 길이예요." },
    ],
    guide: [
      { key: "subject", label: "과목", type: "text", required: true, placeholder: "예: 중학교 영어", help: "수업 과목을 적어 주세요." },
      { key: "topic", label: "단원·주제", type: "text", required: true, placeholder: "예: 비교급과 최상급", help: "이 수업에서 다룰 내용이에요." },
      { key: "objective", label: "학습 목표 (선택)", type: "textarea", placeholder: "예: 비교급을 사용해 문장을 쓸 수 있다", help: "학생이 무엇을 할 수 있게 되면 좋을지 적어 주세요." },
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
    name: "이력서",
    group: "work",
    description: "지원하는 일·학력·경력을 적으면 깔끔하게 정리된 이력서를 만들어 드려요.",
    purpose: "학력·경력·강점을 날짜순으로 정리한 이력서",
    model: "claude-sonnet-4-6",
    maxTokens: 8000,
    options: [
      { key: "role", label: "지원하는 일 (선택)", type: "text", placeholder: "예: 외식업 매니저", help: "지원하려는 직무·일자리예요." },
      { key: "length", label: "글 길이", type: "number", default: 700, min: 200, max: 3000, step: 100, presets: [500, 700, 1000], unit: "자", help: "글자 수예요. 보통 700자 정도예요." },
    ],
    guide: [
      { key: "education", label: "학력 (선택)", type: "textarea", placeholder: "예: ○○대학교 경영학과 2022~", help: "학교·전공·다닌 기간을 적어 주세요." },
      { key: "experience", label: "경력·활동", type: "textarea", required: true, placeholder: "예: ○○카페 2년 — 주문·재고 관리", help: "일했던 곳, 기간, 한 일을 편하게 적어 주세요." },
      { key: "skills", label: "강점·잘하는 것 (선택)", type: "text", placeholder: "예: 데이터 분석, 협업", help: "내세우고 싶은 능력이 있으면 적어 주세요." },
    ],
    systemPrompt: [
      "You are a career writing assistant who drafts clean, structured Korean-style resumes (이력서 / CV).",
      "",
      "CRITICAL — content comes only from the user:",
      "- The reference example shows STRUCTURE and TONE only. Never reuse its placeholder text, and never invent personal facts (이름·학교·기간·회사·수치 등).",
      "- Use only details the user provides. For any missing specific, insert a clearly marked placeholder like [이름], [학교], [기간], [회사명], [구체적 수치].",
      "",
      "Output format (clean Markdown, in the user's language):",
      "- Header: 이름, 소속/상태, then a contact line (생년월일 · 연락처 · 이메일 · 지역) using placeholders if not given.",
      "- '## 학력사항' — reverse-chronological entries: 기간 then 학교·전공·상태.",
      "- '## 경력 및 활동사항' — each entry: a bold title with context and its 기간, then 2–4 factual sentences covering role, situation, and outcome/learning.",
      "- '## 보유 역량' — short paragraphs on job-relevant skills.",
      "",
      "Quality bar:",
      "- Factual and concise, but show context and results (not just titles).",
      "- If a '[요청 조건]' block is appended (직무, 분량 등), follow it precisely.",
    ].join("\n"),
    referenceExample: [
      "# [이름]",
      "[소속 · 재학/재직 상태]",
      "[생년월일] · [연락처] · [이메일] · [지역]",
      "",
      "## 학력사항",
      "[기간]  [학교 · 전공 · 상태]",
      "",
      "## 경력 및 활동사항",
      "**[활동·직무명] — [맥락/소속]**  [기간]",
      "[맡은 역할과 상황, 한 일, 그 결과·배움을 2~4문장으로. 사실 중심이되 맥락과 성과가 드러나게.]",
      "",
      "## 보유 역량",
      "[직무 관련 역량을 짧은 단락으로.]",
    ].join("\n"),
  },
  {
    id: "cover-letter",
    name: "자기소개서",
    group: "work",
    description: "지원하는 일과 경험을 적으면 이야기하듯 따뜻한 자기소개서를 만들어 드려요.",
    purpose: "경험을 이야기로 풀어 강점을 보여주는 자기소개서",
    model: "claude-sonnet-4-6",
    maxTokens: 8000,
    wizard: true,
    options: [
      {
        key: "role",
        label: "지원 직무",
        type: "text",
        placeholder: "예: 요양보호사, 카페 직원, 사무 보조",
        question: "어떤 일(직무)에 지원하시나요?",
        help: "지원하려는 직무나 일자리를 적어주세요.",
      },
      {
        key: "company",
        label: "지원 회사",
        type: "text",
        placeholder: "예: ○○컴퍼니",
        question: "지원하는 회사 이름이 있나요?",
        help: "없으면 넘어가셔도 됩니다.",
      },
      {
        key: "length",
        label: "글 길이",
        type: "number",
        default: 1000,
        min: 200,
        max: 5000,
        step: 100,
        presets: [500, 1000, 1500],
        unit: "자",
        question: "글은 어느 정도 길이로 쓸까요?",
        help: "−/+ 단추로 정해요. 보통 1000자 정도예요.",
      },
    ],
    guide: [
      {
        key: "experience",
        label: "핵심 경험",
        type: "textarea",
        required: true,
        placeholder: "예: 마트에서 3년간 일하며 손님 응대를 잘했어요.",
        question: "자랑하고 싶은 경험을 알려주세요.",
        help: "일했던 곳, 맡았던 일, 잘했던 점을 편하게 적어주세요. 한두 가지면 충분해요.",
        skipValue: "[대표 경험을 한 가지 적어 주세요]",
      },
      {
        key: "motivation",
        label: "지원 동기",
        type: "textarea",
        placeholder: "예: 사람을 돕는 일이 보람돼서요.",
        question: "왜 이 일을 하고 싶으세요?",
        help: "지원하는 이유를 한두 문장으로 적어주세요.",
        skipValue: "",
      },
      {
        key: "strength",
        label: "강조할 강점",
        type: "text",
        placeholder: "예: 성실함, 책임감, 친절함",
        question: "본인의 장점은 무엇인가요?",
        help: "잘하는 점이나 성격의 강점이요.",
        skipValue: "",
      },
      {
        key: "prompts",
        label: "자소서 문항 (있으면)",
        type: "textarea",
        placeholder: "예: 1. 지원 동기 2. 입사 후 포부",
        question: "정해진 자소서 질문이 있나요?",
        help: "회사가 준 질문이 있으면 적어주세요. 없으면 넘어가세요.",
        skipValue: "",
      },
    ],
    systemPrompt: [
      "You are a career writing assistant who drafts compelling, authentic Korean-style self-introductions (자기소개서) in a warm, narrative voice.",
      "",
      "CRITICAL — content comes only from the user:",
      "- The reference example shows STRUCTURE, NARRATIVE FLOW, and TONE only. Never reuse its placeholder text or invent personal stories/facts.",
      "- Build every section from the user's own experiences. For any missing specific, insert a clearly marked placeholder like [회사명] or [구체적 수치] — never fabricate.",
      "",
      "Output format (clean Markdown, in the user's language):",
      "- If the user provides specific prompts (문항), answer each as its own section using the prompt as the heading.",
      "- Otherwise use evocative thematic 소제목 that compress each section's main value.",
      "",
      "Voice & quality bar:",
      "- Warm, sincere, story-driven first person. Develop each section as a small story: 상황 → 행동 → 결과·의미, ending on the trait it reveals.",
      "- Show strengths through episodes, not adjective lists; keep warmth without becoming sentimental.",
      "- If a '[요청 조건]' block is appended (직무, 회사, 글자 수 등), follow it precisely and respect the requested length.",
    ].join("\n"),
    referenceExample: [
      "자기소개서 — [이름]",
      "",
      "## [핵심 가치를 압축한 비유적 소제목]",
      "[전환점이 된 구체적 상황으로 문을 엽니다.] [그때 내린 결정과 실제로 한 일을 이야기하듯 풀어냅니다.] [그 경험이 남긴 변화와 그로써 드러난 자질로 단락을 맺습니다.] 한 단락이 하나의 작은 이야기가 되도록 전개합니다.",
      "",
      "## [또 다른 가치를 담은 소제목]",
      "[다른 경험을 같은 흐름(상황 → 행동 → 결과·의미)으로 전개하고, 형용사 나열 대신 일화로 강점을 보여 줍니다.]",
    ].join("\n"),
  },
  {
    id: "creative-writing",
    name: "소설·글쓰기",
    group: "work",
    description: "장르와 소재만 정하면 원하는 길이의 이야기 초고를 써 드려요.",
    purpose: "장르·소재만 고르면 이야기 초고 완성",
    model: "claude-sonnet-4-6",
    maxTokens: 12000,
    options: [
      { key: "length", label: "글 길이", type: "number", default: 1500, min: 300, max: 8000, step: 100, presets: [1000, 1500, 3000], unit: "자", help: "글자 수예요." },
      {
        key: "pov",
        label: "이야기 시점",
        type: "select",
        choices: [
          { value: "1인칭", label: "1인칭(나)" },
          { value: "3인칭", label: "3인칭(그·그녀)" },
        ],
        default: "3인칭",
        help: "누구 눈으로 이야기를 들려줄지 골라요.",
      },
    ],
    guide: [
      {
        key: "genre",
        label: "장르",
        type: "select",
        required: true,
        choices: [
          { value: "판타지", label: "판타지" },
          { value: "로맨스", label: "로맨스" },
          { value: "스릴러", label: "스릴러" },
          { value: "SF", label: "SF" },
          { value: "일상", label: "일상" },
          { value: "동화", label: "동화" },
          { value: "무협", label: "무협" },
        ],
        help: "어떤 종류의 이야기인지 골라요.",
      },
      { key: "premise", label: "소재·설정", type: "textarea", required: true, placeholder: "예: 비 오는 날 우산을 나눠 쓴 두 사람", help: "주인공, 배경, 어떤 일이 벌어지는지 편하게 적어 주세요." },
      {
        key: "tone",
        label: "분위기 (선택)",
        type: "select",
        choices: [
          { value: "잔잔하고 따뜻한", label: "잔잔·따뜻" },
          { value: "긴장감 있는", label: "긴장감" },
          { value: "유쾌한", label: "유쾌함" },
          { value: "어둡고 진지한", label: "어두움" },
          { value: "서정적인", label: "서정적" },
        ],
        default: "잔잔하고 따뜻한",
        help: "이야기 느낌을 골라요.",
      },
    ],
    systemPrompt: [
      "You are a fiction writing assistant who drafts an original first draft (초고) from the writer's premise. Write fresh, original prose every time.",
      "",
      "Output (clean Markdown, in the user's language):",
      "- Open with a title, then the story prose, using scene breaks where natural.",
      "- Match the requested genre, point of view, tone, and length.",
      "",
      "Quality bar:",
      "- Show, don't tell: concrete sensory detail, purposeful dialogue, clear scene goals.",
      "- A coherent arc with a hook, rising tension, and an ending that resonates at the given length.",
      "- Natural, vivid prose; avoid cliché and purple writing.",
      "- If a '[요청 조건]' block is appended (분량, 시점 등), follow it and respect the requested length.",
    ].join("\n"),
  },
  {
    id: "excel",
    name: "엑셀",
    group: "work",
    description: "하고 싶은 작업을 적으면 수식·차트·정리 방법을 차근차근 알려 드려요.",
    purpose: "수식·차트·데이터 정리를 한 번에",
    model: "claude-sonnet-4-6",
    maxTokens: 6000,
    options: [
      {
        key: "tool",
        label: "쓰는 프로그램",
        type: "select",
        choices: [
          { value: "엑셀", label: "엑셀" },
          { value: "구글 시트", label: "구글 시트" },
        ],
        default: "엑셀",
        help: "어떤 프로그램을 쓰는지 골라요.",
      },
      {
        key: "task",
        label: "하려는 일",
        type: "select",
        choices: [
          { value: "수식·함수", label: "수식·함수" },
          { value: "피벗·차트", label: "피벗·차트" },
          { value: "데이터 정리", label: "데이터 정리" },
        ],
        default: "수식·함수",
        help: "어떤 종류의 작업인지 골라요.",
      },
    ],
    guide: [
      { key: "goal", label: "하고 싶은 작업", type: "textarea", required: true, placeholder: "예: 매출 표에서 월별 합계와 차트 만들기", help: "무엇을 하고 싶은지 편하게 적어 주세요." },
      { key: "data", label: "표가 어떻게 생겼나요? (선택)", type: "text", placeholder: "예: A열 날짜, B열 금액", help: "어느 칸에 무슨 값이 있는지 알려주면 더 정확해요." },
    ],
    systemPrompt: [
      "You are a spreadsheet expert who helps users accomplish tasks in Excel or Google Sheets.",
      "",
      "Output (clean Markdown, in the user's language):",
      "- Restate the goal in one line, then give the solution.",
      "- For formulas: show the exact formula in a code span, say which cell to place it in, and briefly explain each part.",
      "- For pivot tables / charts: give numbered step-by-step instructions.",
      "- For data cleanup: give the steps or formula, with a tiny before/after example if helpful.",
      "",
      "Quality bar:",
      "- Every formula MUST be syntactically valid AND actually produce the requested result — mentally trace it on a 2–3 row sample before presenting it.",
      "- Use the function names AND the argument separator of the chosen tool (Excel: ',' or ';' by locale; Google Sheets: ','); note any 엑셀 vs 구글 시트 difference that matters.",
      "- State assumptions explicitly (e.g. 'data in A2:A100, headers in row 1') and handle obvious edge cases (empty cells, division by zero, text in number columns) when relevant.",
      "- Prefer the simplest robust approach; mention an alternative only if clearly useful (e.g. SUMIFS vs SUMPRODUCT, XLOOKUP vs INDEX/MATCH).",
      "- If a '[요청 조건]' block is appended (도구, 작업 유형 등), follow it.",
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
