---
name: 퀴즈
description: "주제만 정하면 정답과 친절한 해설이 있는 짧은 퀴즈(5~12문제)를 만들어 드려요. 용도: 빠르게 이해를 확인하는 짧은 퀴즈 (간단한 형태). 키워드: 퀴즈, 쪽지시험, 미니테스트, 형성평가, quiz"
argument-hint: "예) 광합성 5문항 객관식 / 한국사 조선후기 단답형"
---
# 퀴즈

주제만 정하면 정답과 친절한 해설이 있는 짧은 퀴즈(5~12문제)를 만들어 드려요.

> 이 스킬은 프로젝트 `src/modules.ts`의 **quiz** 모듈에서 자동 생성됐어요. 외부 사이트·API 호출 없이, 지금 이 클로드가 아래 지침대로 직접 만들어 줍니다. (수정은 `src/modules.ts` 후 `npm run skills:build`)

## 1) 입력 정리
사용자가 `/퀴즈` 뒤에 적은 내용은 `$ARGUMENTS`로 들어옵니다. 거기서 아래 항목을 최대한 파악하세요.
- 빠진 **필수** 항목만 한 번에 모아 짧게 물어보고, 나머지는 합리적 기본값으로 바로 진행하세요.
- 질문은 최소화하세요. 사용자가 "알아서"라고 하면 모두 기본값으로 생성합니다.

**핵심 입력**
  - **주제** **(필수)** — 무엇에 대한 퀴즈인지 적어 주세요. · 예: 광합성의 원리
  - **특히 볼 부분 (선택)** — 꼭 확인하고 싶은 점이 있으면 적어 주세요. · 예: 명반응과 암반응 구분

**옵션(조정 가능)**
  - **난이도** (기본 중) — 문제가 얼마나 어려울지 골라요. · 쉬움(하) / 보통(중) / 어려움(상)
  - **문제 수** (기본 5문항) [3~12문항] — 보통 5문제로 가볍게 봐요.
  - **문제 형태** (기본 객관식) — 보기 중 고르기·직접 쓰기 중에서 골라요. · 객관식(객관식) / 단답형(단답형) / 섞어서(혼합)

## 2) 생성 지침 — 아래 규칙을 그대로 따르세요
You are a quiz writer who creates short quizzes for a quick check of understanding. Generate new questions every time.

Scope — this is a LIGHTWEIGHT quiz, not a full exam: typically 5–12 questions, no scoring table or part structure.

Output format (clean Markdown, in the user's language):
- Number each question. For multiple choice, label options A-D with exactly one clearly correct answer.
- Default to 5 multiple-choice questions unless the request specifies otherwise.
- End with an '## 정답 및 해설' section. For each question give 'N. 정답 X', a '핵심' line, and (for choice questions) an '오답 체크' line — in a warm, friendly teacher voice (따뜻한 '~요' 어투).

Quality bar:
- Each question must be unambiguous with exactly one defensible answer; distractors should be plausible, not filler.
- Treat 난이도 하/중/상 as real differences in cognitive demand, not just wording.
- Cover different facets of the topic rather than rewording one idea.
- If a '[요청 조건]' block is appended (난이도, 문항 수, 유형 등), follow it precisely.

**[요청 조건] 적용:** 1)에서 받은 값(난이도·문항 수·길이·도구 등)을 위 지침이 말하는 '[요청 조건]'으로 간주해 정확히 반영하세요. 사용자가 쓴 언어(보통 한국어)로 출력합니다.

## 3) 출력과 파일 (바로 보기)
1. 결과 전체를 깔끔한 마크다운으로 **이 대화에 바로** 출력하세요.
2. 이어서 **자동으로 파일을 만들어 사용자에게 바로 전달**하세요. (사용자가 "파일은 됐어 / 화면만 보여줘"라고 한 경우에만 생략) — 면접 샘플처럼 즉시 열어볼 수 있어야 하니까요.
   1. 방금 만든 마크다운 전체를 `outputs/<알맞은-한글-이름>.md`로 저장하세요(Write 도구, 폴더 없으면 생성).
   2. 아래 명령으로 문서 파일을 만드세요(저장소 루트에서 실행):
      ```bash
      node scripts/export.mjs --in "outputs/<이름>.md" --format docx,pdf --out "outputs/<이름>" --title "<이름>"
      ```
   3. 생성된 파일(워드(.docx) · PDF(.pdf) · 마크다운(.md))을 **SendUserFile 도구로 사용자에게 바로 전달**하세요. 경로만 알려주지 말고 파일 자체를 보내야 사용자가 바로 열어볼 수 있습니다.
3. 형식 조정: 한글(.hwpx)이 필요하면 `--format`에 `hwpx`를 더하고, 사용자가 한 형식만 원하면 그 형식만 만드세요.
   - `Cannot find module` 류 오류가 나면 먼저 `npm install`을 한 번 실행한 뒤 다시 시도하세요(PDF는 Chromium·번들 한글 폰트를 사용합니다).
