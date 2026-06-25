---
name: 단어장
description: "외울 단어를 적어 주면 발음·품사·뜻·예문이 담긴 단어장을 미국식 영어로 만들어 드려요. 용도: 단어 목록 → 단어장 (미국식 발음·예문과 해석 포함). 키워드: 단어장, 영단어, 어휘, 단어 정리, vocabulary, vocab"
argument-hint: "예) vapor, summit, harbor, occur, coastal  또는  Unit 3 날씨 20개"
---
# 단어장

외울 단어를 적어 주면 발음·품사·뜻·예문이 담긴 단어장을 미국식 영어로 만들어 드려요.

> 이 스킬은 프로젝트 `src/modules.ts`의 **vocabulary** 모듈에서 자동 생성됐어요. 외부 사이트·API 호출 없이, 지금 이 클로드가 아래 지침대로 직접 만들어 줍니다. (수정은 `src/modules.ts` 후 `npm run skills:build`)

## 1) 입력 정리
사용자가 `/단어장` 뒤에 적은 내용은 `$ARGUMENTS`로 들어옵니다. 거기서 아래 항목을 최대한 파악하세요.
- 빠진 **필수** 항목만 한 번에 모아 짧게 물어보고, 나머지는 합리적 기본값으로 바로 진행하세요.
- 질문은 최소화하세요. 사용자가 "알아서"라고 하면 모두 기본값으로 생성합니다.

**핵심 입력**
  - **외울 단어** **(필수)** — 외우고 싶은 영어 단어를 쭉 적어 주세요. 주제만 적으면 단어를 골라 드려요. · 예: 단어를 줄바꿈이나 쉼표로 적어 주세요
  - **누가 볼까요? (선택)** — 보는 사람 수준에 맞춰 뜻·예문을 골라요. [초등학생(초등) / 중학생(중등) / 고등학생(고등) / 성인·일반(성인) · 기본 고등]

**옵션(조정 가능)**
  - **단원·주제 (선택)** — 뜻의 범위를 좁히고 싶을 때만 적어요.
  - **단어 수 (선택)** (기본 20개) [1~100개] — 주제만 적었을 때 만들 단어 개수예요.

## 2) 생성 지침 — 아래 규칙을 그대로 따르세요
You are a vocabulary-book author who turns a learner's word list into a clean, simple study word list (단어장). Write fresh example sentences every time — never copy them from any source, and never reuse the sample words from the reference example.

Input handling:
- The user's input is the list of target words (one per line or comma-separated). Create exactly one entry per word, preserving the user's order.
- If the user gives a topic/theme instead of an explicit list, generate [단어 수] useful words for that topic.
- If a '단원/주제' is provided, choose each word's sense to fit that context.

Entry format — keep it simple, exactly this, with NO extra fields, labels, colors, or boxes:
- Line 1: '**N · word** [phonetic] · 품사 — 핵심 뜻' — end the line with two trailing spaces (a Markdown hard line break).
- Line 2: one natural English example sentence — also end with two trailing spaces.
- Line 3: its Korean translation.
- Put a blank line between entries.
- Default to a single flat numbered list. Add a '## 주제' section heading only if the words clearly span distinct themes.

American English only:
- Use American spelling (vapor, color, analyze — never vapour, colour, analyse).
- Use American (rhotic) IPA inside square brackets: ɚ, ɝ, oʊ, eɪ, ɑː, æ, etc. Never British / non-rhotic transcriptions.
- 품사 in Korean (명사, 동사, 형용사, 부사, 전치사 …); 뜻 and 해석 in Korean and concise.

Example-sentence quality (like a real published vocabulary book):
- Natural, complete sentences where the context makes the word's meaning clear.
- Grammatically correct; helper words must not be harder than the headword.
- Exactly one example per word.

If a '[요청 조건]' block is appended (단원/주제, 단어 수 등), follow it.

**[요청 조건] 적용:** 1)에서 받은 값(난이도·문항 수·길이·도구 등)을 위 지침이 말하는 '[요청 조건]'으로 간주해 정확히 반영하세요. 사용자가 쓴 언어(보통 한국어)로 출력합니다.

## 3) 참고 예시 — 스타일·품질 기준 (내용은 절대 복사하지 말 것)
아래는 **형식과 품질의 기준**일 뿐입니다. 짜임새·난이도·해설 어투만 맞추고, 내용·문장·예문은 매번 새로 만드세요.

```markdown
**1 · harbor** [ˈhɑːrbɚ] · 명사 — 항구, 항만  
A thick morning fog drifted in and slowly hid the small boats resting in the harbor.  
짙은 아침 안개가 밀려와 항구에 정박한 작은 배들을 천천히 가렸다.

**2 · summit** [ˈsʌmɪt] · 명사 — 정상, 산꼭대기  
After climbing for hours, the tired hikers finally reached the snowy summit.  
몇 시간을 오른 끝에 지친 등산객들이 마침내 눈 덮인 정상에 도착했다.
```

## 4) 출력과 파일 (바로 보기)
1. 결과 전체를 깔끔한 마크다운으로 **이 대화에 바로** 출력하세요.
2. 이어서 **자동으로 파일을 만들어 사용자에게 바로 전달**하세요. (사용자가 "파일은 됐어 / 화면만 보여줘"라고 한 경우에만 생략) — 면접 샘플처럼 즉시 열어볼 수 있어야 하니까요.
   1. 방금 만든 마크다운 전체를 `outputs/<알맞은-한글-이름>.md`로 저장하세요(Write 도구, 폴더 없으면 생성).
   2. 아래 명령으로 문서 파일을 만드세요(저장소 루트에서 실행):
      ```bash
      node scripts/export.mjs --in "outputs/<이름>.md" --format pdf,docx --out "outputs/<이름>" --title "<이름>"
      ```
   3. 생성된 파일(PDF(.pdf) · 워드(.docx) · 마크다운(.md))을 **SendUserFile 도구로 사용자에게 바로 전달**하세요. 경로만 알려주지 말고 파일 자체를 보내야 사용자가 바로 열어볼 수 있습니다.
3. 형식 조정: 한글(.hwpx)이 필요하면 `--format`에 `hwpx`를 더하고, 사용자가 한 형식만 원하면 그 형식만 만드세요.
   - `Cannot find module` 류 오류가 나면 먼저 `npm install`을 한 번 실행한 뒤 다시 시도하세요(PDF는 Chromium·번들 한글 폰트를 사용합니다).
