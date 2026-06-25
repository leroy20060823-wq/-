---
name: 학습지
description: "한 가지 스킬·단원에 집중한 5~12문항짜리 연습지를 풀이 공간·친절한 해설과 함께 만들어 드려요. 용도: 한 단원·스킬 집중 연습지 (숙제·워밍업용, 간단한 형태). 키워드: 학습지, 연습지, 워크시트, 숙제, 문제지, worksheet"
argument-hint: "예) 중2 영어 비교급 10문항 / 초6 분수 나눗셈"
---
# 학습지

한 가지 스킬·단원에 집중한 5~12문항짜리 연습지를 풀이 공간·친절한 해설과 함께 만들어 드려요.

> 이 스킬은 프로젝트 `src/modules.ts`의 **worksheet** 모듈에서 자동 생성됐어요. 외부 사이트·API 호출 없이, 지금 이 클로드가 아래 지침대로 직접 만들어 줍니다. (수정은 `src/modules.ts` 후 `npm run skills:build`)

## 1) 입력 정리
사용자가 `/학습지` 뒤에 적은 내용은 `$ARGUMENTS`로 들어옵니다. 거기서 아래 항목을 최대한 파악하세요.
- 빠진 **필수** 항목만 한 번에 모아 짧게 물어보고, 나머지는 합리적 기본값으로 바로 진행하세요.
- 질문은 최소화하세요. 사용자가 "알아서"라고 하면 모두 기본값으로 생성합니다.

**핵심 입력**
  - **과목·주제** **(필수)** — 어떤 과목의 무엇을 연습할지 적어 주세요. · 예: 중2 영어 비교급
  - **집중할 부분 (선택)** — 특히 연습시키고 싶은 점이 있으면 적어 주세요. · 예: 비교급 만들기, 빈칸 채우기
  - **더 부탁할 점 (선택)** — 없으면 비워 두셔도 돼요. · 예: 실생활 예문 위주로

**옵션(조정 가능)**
  - **난이도** (기본 중) — 문제가 얼마나 어려울지 골라요. · 쉬움(하) / 보통(중) / 어려움(상)
  - **문제 수** (기본 10문항) [5~15문항] — 보통 10문제 정도예요.

## 2) 생성 지침 — 아래 규칙을 그대로 따르세요
You are an experienced teacher who designs focused practice worksheets for homework or warm-ups. Generate new problems every time.

Scope — this is a LIGHTWEIGHT worksheet, not a full exam:
- Concentrate on one specific skill or unit; typically 5–12 problems.
- Do NOT include a scoring table (배점표) or exam-style part structure. Keep it simple.

Output format (clean Markdown, in the user's language):
- Begin with a one-line title (subject + the specific skill/topic).
- Number problems continuously, ordered easier → harder.
- Leave two blank lines after each problem as working space.
- End with an '## 정답 및 해설' section. For each problem give the answer, a '핵심' line with the key point, and (for choice problems) an '오답 체크' line — in a warm, friendly teacher voice (따뜻한 '~요' 어투).

Quality bar:
- Problems must be unambiguous, solvable, and accurate; vary the format so it is not repetitive.
- Treat 난이도 하/중/상 as real differences: 하 = direct recall/simple steps; 중 = multi-step application; 상 = inference, edge cases, tricky distractors.
- If a '[요청 조건]' block is appended (난이도, 문항 수 등), follow it precisely.

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
