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

/**
 * A guided form field. Instead of a blank textarea, each module asks a few
 * friendly questions; the answers are composed into the request prompt.
 */
export interface GuideField {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "number";
  placeholder?: string;
  choices?: ModuleOptionChoice[];
  required?: boolean;
  hint?: string;
}

export interface GenerationModule {
  id: string;
  name: string;
  description: string;
  /** One-line use-case shown in the UI. */
  purpose: string;
  systemPrompt: string;
  options?: ModuleOption[];
  /** Step-by-step guided questions rendered in place of the blank input. */
  guide?: GuideField[];
  referenceExample?: string;
  /** Placeholder text for the main input textarea (per module). */
  inputPlaceholder?: string;
  model?: string;
  maxTokens?: number;
}

const DIFFICULTY: ModuleOptionChoice[] = [{ value: "하" }, { value: "중" }, { value: "상" }];

const MODULES: GenerationModule[] = [
  {
    id: "exam",
    name: "시험지 생성",
    description:
      "출제 범위·난이도·문항 수를 받아 배점표·4파트·정답표·정밀 해설지가 포함된 완본 모의고사를 생성합니다.",
    purpose: "기말·중간 대비 완본 모의고사 (배점표·정답표·정밀 해설지 포함)",
    model: "claude-sonnet-4-6",
    maxTokens: 16000,
    options: [
      { key: "difficulty", label: "난이도", type: "select", choices: DIFFICULTY, default: "중" },
      { key: "count", label: "문항 수", type: "number", default: 33, min: 10, max: 50 },
    ],
    guide: [
      { key: "subject", label: "과목", type: "text", required: true, placeholder: "예: 영어 읽기와 쓰기" },
      { key: "scope", label: "출제 범위 / 단원", type: "text", required: true, placeholder: "예: 교재 Unit 3~4" },
      { key: "types", label: "포함할 문항 유형", type: "text", placeholder: "예: 어휘, 독해, 서술형, 문법" },
      { key: "note", label: "특이사항 (선택)", type: "text", placeholder: "예: 서술형 비중 높이기" },
    ],
    systemPrompt: [
      "You are an expert exam author who creates full mock-exam papers (모의고사/시험지) on a professional, fixed blueprint. Generate a brand-new exam every time.",
      "",
      "CRITICAL — original content only:",
      "- Never copy passages, sentences, or items from any source, including any reference example. Invent new passages, new vocabulary, and new questions on every run.",
      "- A reference example, if present, shows STRUCTURE, DIFFICULTY, and EXPLANATION TONE only — match its format and quality, never its content.",
      "",
      "Document structure (clean Markdown):",
      "1. Header: a title line, then a meta line like '총 N문항 · 시험시간 M분 · 100점 만점 | 출제 범위: ...', then a difficulty label (난이도 하·기초 / 중·표준 / 상·심화).",
      "2. 응시 안내: answer format (객관식 4지선다 A–D, 정답 하나), which items are 서술형, time, and that 정답·해설 are at the end.",
      "3. 배점표: a Markdown table with columns 파트 | 파트명 | 유형 | 문항 범위 | 문항 수 | 문항당 배점 | 파트 총점, plus a 합계 row. Points MUST total 100.",
      "4. Exam body in four parts (default blueprint, adapt names to the subject):",
      "   - P1 어휘 & 문법 — 객관식 (~27% of points).",
      "   - P2 독해 — several passages, each with a short title and a one-line theme tag, then comprehension items (사실확인·세부정보·추론·함축·문맥어휘). 객관식 (~55%).",
      "   - P3 서술형 — short open-response items answered in the user's language (~10%).",
      "   - P4 문법 어법 — 객관식 (~8%).",
      "   Number items continuously. Tag each item with a short type label and its score like '[3점]'. Mark killer items with ★Killer; you may weight one item +1점 as long as the total stays 100.",
      "5. A closing line, then the answer section.",
      "",
      "Answer section:",
      "- '## 정답표 (Answer Key)' grouped by part, compact (e.g. '1. C  2. A  3. B …'), marking ★ on killer items.",
      "- '## 정밀 해설지 (Detailed Explanations)' written as a real, friendly teacher would speak (따뜻하고 친절한 '~요' 어투). For EACH item give: 'N. 정답 X', a short reasoning sentence, a '핵심' line with the rule/key point, and an '오답 체크' line explaining why the attractive distractors are wrong. For 서술형, provide a 모범 답안.",
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
      "- If a '[요청 조건]' block is appended (난이도, 문항 수 등), follow it. If 문항 수 differs from the default, scale each part proportionally and keep the total at 100점.",
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
    name: "학습지 생성",
    description: "특정 스킬·단원에 집중한 5~12문항 연습 학습지를 풀이 공간·친절한 해설과 함께 생성합니다.",
    purpose: "특정 스킬·단원 집중 연습지 (숙제·워밍업용, 배점표 없이 간단히)",
    model: "claude-haiku-4-5",
    maxTokens: 8000,
    options: [
      { key: "difficulty", label: "난이도", type: "select", choices: DIFFICULTY, default: "중" },
      { key: "count", label: "문항 수", type: "number", default: 10, min: 5, max: 15 },
    ],
    guide: [
      { key: "topic", label: "과목 · 주제", type: "text", required: true, placeholder: "예: 중2 영어 비교급" },
      { key: "skill", label: "집중할 스킬 / 유형", type: "text", placeholder: "예: 비교급 만들기, 빈칸 채우기" },
      { key: "note", label: "특이사항 (선택)", type: "text", placeholder: "예: 실생활 예문 위주" },
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
    name: "퀴즈 생성",
    description: "주제·난이도·유형을 받아 정답·친절한 해설이 포함된 5~12문항 짧은 퀴즈를 생성합니다.",
    purpose: "빠른 이해 점검용 짧은 퀴즈 (배점표 없이 간단히)",
    model: "claude-haiku-4-5",
    maxTokens: 4000,
    options: [
      { key: "difficulty", label: "난이도", type: "select", choices: DIFFICULTY, default: "중" },
      { key: "count", label: "문항 수", type: "number", default: 5, min: 3, max: 12 },
      {
        key: "type",
        label: "유형",
        type: "select",
        choices: [{ value: "객관식" }, { value: "단답형" }, { value: "혼합" }],
        default: "객관식",
      },
    ],
    guide: [
      { key: "topic", label: "주제", type: "text", required: true, placeholder: "예: 광합성의 원리" },
      { key: "focus", label: "강조할 포인트 (선택)", type: "text", placeholder: "예: 명반응과 암반응 구분" },
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
    name: "단어장 생성",
    description: "외울 단어 목록을 받아 발음기호·품사·뜻·예문이 있는 단어장을 미국식 영어로 생성합니다.",
    purpose: "외운 단어 목록 → 단어장 (미국식 발음·예문+해석)",
    model: "claude-haiku-4-5",
    maxTokens: 8000,
    inputPlaceholder: "외울 단어를 줄바꿈 또는 쉼표로 입력하세요\n예: vapor, summit, harbor, occur, coastal",
    options: [
      { key: "unit", label: "단원/주제 (선택)", type: "text", placeholder: "뜻 범위 지정용 — 예: Unit 3 날씨·물" },
      { key: "count", label: "단어 수 (선택)", type: "number", default: 20, min: 1, max: 100 },
    ],
    guide: [
      {
        key: "words",
        label: "외울 단어 목록",
        type: "textarea",
        required: true,
        placeholder: "단어를 줄바꿈 또는 쉼표로 입력\n예: vapor, summit, harbor, occur, coastal",
      },
      { key: "level", label: "대상 수준 (선택)", type: "text", placeholder: "예: 고1 수준" },
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
    name: "발표자료(PPT) 개요 생성",
    description: "주제를 받아 슬라이드별 제목·핵심 내용·발표자 노트를 생성합니다.",
    purpose: "발표용 슬라이드 개요 (슬라이드별 핵심 + 발표자 노트)",
    model: "claude-sonnet-4-6",
    maxTokens: 8000,
    guide: [
      { key: "topic", label: "발표 주제", type: "text", required: true, placeholder: "예: 신입사원 온보딩" },
      { key: "audience", label: "청중 / 대상", type: "text", placeholder: "예: 신입사원" },
      { key: "slides", label: "분량 / 슬라이드 수", type: "text", placeholder: "예: 10장, 10분" },
      { key: "message", label: "강조할 메시지 (선택)", type: "text", placeholder: "예: 회사 문화 적응" },
    ],
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
    purpose: "핵심 개념 요약 노트 (정의·핵심·예시 중심)",
    model: "claude-haiku-4-5",
    maxTokens: 6000,
    guide: [
      { key: "topic", label: "주제 / 범위", type: "text", required: true, placeholder: "예: 한국사 — 조선 후기 경제" },
      { key: "level", label: "대상 수준 (선택)", type: "text", placeholder: "예: 고등학교" },
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
    name: "수업지도안 생성",
    description: "과목·학교급·차시·학습목표를 받아 도입-전개-정리 단계의 수업지도안을 생성합니다.",
    purpose: "도입-전개-정리 수업지도안 (활동·시간배분·평가 포함)",
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
    guide: [
      { key: "subject", label: "과목", type: "text", required: true, placeholder: "예: 중학교 영어" },
      { key: "topic", label: "단원 / 주제", type: "text", required: true, placeholder: "예: 비교급과 최상급" },
      { key: "objective", label: "학습목표 (선택)", type: "textarea", placeholder: "예: 비교급을 활용해 문장을 쓸 수 있다" },
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
    name: "이력서 작성",
    description: "지원 직무·학력·경력을 받아 구조화된 이력서(CV)를 작성합니다.",
    purpose: "구조화된 이력서(CV) — 학력·경력·역량을 날짜 기반으로 정리",
    model: "claude-sonnet-4-6",
    maxTokens: 8000,
    options: [
      { key: "role", label: "지원 직무", type: "text", placeholder: "예: 외식업 매니저" },
      { key: "length", label: "분량(자)", type: "number", default: 700, min: 200, max: 3000 },
    ],
    guide: [
      { key: "education", label: "학력", type: "textarea", placeholder: "학교 · 전공 · 기간 (예: ○○대 경영 2022~)" },
      { key: "experience", label: "경력 · 활동", type: "textarea", required: true, placeholder: "회사/활동 · 기간 · 한 일" },
      { key: "skills", label: "강점 · 보유 역량", type: "text", placeholder: "예: 데이터 분석, 협업" },
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
    name: "자기소개서 작성",
    description: "지원 직무·회사·경험을 받아 서사형·따뜻한 문체의 자기소개서를 작성합니다.",
    purpose: "서사형 자기소개서 — 일화 중심으로 강점을 보여주는 글",
    model: "claude-sonnet-4-6",
    maxTokens: 8000,
    options: [
      { key: "role", label: "지원 직무", type: "text", placeholder: "예: 외식업 매니저" },
      { key: "company", label: "지원 회사", type: "text", placeholder: "예: ○○컴퍼니 (선택)" },
      { key: "length", label: "글자 수", type: "number", default: 1000, min: 200, max: 5000 },
    ],
    guide: [
      { key: "experience", label: "핵심 경험", type: "textarea", required: true, placeholder: "자랑할 경험 1~2개 (상황·한 일·결과)" },
      { key: "motivation", label: "지원 동기", type: "textarea", placeholder: "왜 이 직무/회사인지" },
      { key: "strength", label: "강조할 강점", type: "text", placeholder: "예: 끈기, 협업" },
      { key: "prompts", label: "자소서 문항 (있으면)", type: "textarea", placeholder: "예: 1. 지원 동기 2. 입사 후 포부" },
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
    description: "장르·소재를 받아 원하는 분량의 이야기 초고를 작성합니다.",
    purpose: "장르·소재만 고르면 이야기 초고 완성",
    model: "claude-sonnet-4-6",
    maxTokens: 12000,
    options: [
      { key: "length", label: "분량(자)", type: "number", default: 1500, min: 300, max: 8000 },
      {
        key: "pov",
        label: "시점",
        type: "select",
        choices: [{ value: "1인칭" }, { value: "3인칭" }],
        default: "3인칭",
      },
    ],
    guide: [
      {
        key: "genre",
        label: "장르",
        type: "select",
        required: true,
        choices: [
          { value: "판타지" },
          { value: "로맨스" },
          { value: "스릴러" },
          { value: "SF" },
          { value: "일상" },
          { value: "동화" },
          { value: "무협" },
        ],
      },
      { key: "premise", label: "소재 · 설정", type: "textarea", required: true, placeholder: "주인공, 배경, 핵심 갈등을 적어주세요" },
      { key: "tone", label: "분위기 / 톤 (선택)", type: "text", placeholder: "예: 잔잔하고 따뜻한" },
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
    name: "엑셀 작업",
    description: "원하는 작업을 설명하면 수식·차트·데이터 정리 방법을 알려줍니다.",
    purpose: "수식·차트·데이터 정리를 한 번에",
    model: "claude-sonnet-4-6",
    maxTokens: 6000,
    options: [
      {
        key: "tool",
        label: "도구",
        type: "select",
        choices: [{ value: "엑셀" }, { value: "구글 시트" }],
        default: "엑셀",
      },
      {
        key: "task",
        label: "작업 유형",
        type: "select",
        choices: [{ value: "수식·함수" }, { value: "피벗·차트" }, { value: "데이터 정리" }],
        default: "수식·함수",
      },
    ],
    guide: [
      { key: "goal", label: "하고 싶은 작업", type: "textarea", required: true, placeholder: "예: 매출 데이터에서 월별 합계와 차트 만들기" },
      { key: "data", label: "데이터 구조 (선택)", type: "text", placeholder: "예: A열 날짜, B열 금액" },
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
      "- Formulas must be correct and use the right function names for the chosen tool (note 엑셀 vs 구글 시트 differences when they matter).",
      "- Prefer the simplest robust approach; mention an alternative only if clearly useful.",
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
