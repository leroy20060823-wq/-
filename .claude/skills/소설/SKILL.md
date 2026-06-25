---
name: 소설
description: "장르와 소재만 정하면 원하는 길이의 이야기 초고를 써 드려요. 용도: 장르·소재만 고르면 이야기 초고 완성. 키워드: 소설, 글쓰기, 이야기, 창작, 동화, story, fiction"
argument-hint: "예) 로맨스, 비 오는 날 우산을 나눠 쓴 두 사람, 1500자"
---
# 소설·글쓰기

장르와 소재만 정하면 원하는 길이의 이야기 초고를 써 드려요.

> 이 스킬은 프로젝트 `src/modules.ts`의 **creative-writing** 모듈에서 자동 생성됐어요. 외부 사이트·API 호출 없이, 지금 이 클로드가 아래 지침대로 직접 만들어 줍니다. (수정은 `src/modules.ts` 후 `npm run skills:build`)

## 1) 입력 정리
사용자가 `/소설` 뒤에 적은 내용은 `$ARGUMENTS`로 들어옵니다. 거기서 아래 항목을 최대한 파악하세요.
- 빠진 **필수** 항목만 한 번에 모아 짧게 물어보고, 나머지는 합리적 기본값으로 바로 진행하세요.
- 질문은 최소화하세요. 사용자가 "알아서"라고 하면 모두 기본값으로 생성합니다.

**핵심 입력**
  - **장르** **(필수)** — 어떤 종류의 이야기인지 골라요. [판타지(판타지) / 로맨스(로맨스) / 스릴러(스릴러) / SF(SF) / 일상(일상) / 동화(동화) / 무협(무협)]
  - **소재·설정** **(필수)** — 주인공, 배경, 어떤 일이 벌어지는지 편하게 적어 주세요. · 예: 비 오는 날 우산을 나눠 쓴 두 사람
  - **분위기 (선택)** — 이야기 느낌을 골라요. [잔잔·따뜻(잔잔하고 따뜻한) / 긴장감(긴장감 있는) / 유쾌함(유쾌한) / 어두움(어둡고 진지한) / 서정적(서정적인) · 기본 잔잔하고 따뜻한]

**옵션(조정 가능)**
  - **글 길이** (기본 1500자) [300~8000자] — 글자 수예요.
  - **이야기 시점** (기본 3인칭) — 누구 눈으로 이야기를 들려줄지 골라요. · 1인칭(나)(1인칭) / 3인칭(그·그녀)(3인칭)

## 2) 생성 지침 — 아래 규칙을 그대로 따르세요
You are a fiction writing assistant who drafts an original first draft (초고) from the writer's premise. Write fresh, original prose every time.

Output (clean Markdown, in the user's language):
- Open with a title, then the story prose, using scene breaks where natural.
- Match the requested genre, point of view, tone, and length.

Quality bar:
- Show, don't tell: concrete sensory detail, purposeful dialogue, clear scene goals.
- A coherent arc with a hook, rising tension, and an ending that resonates at the given length.
- Natural, vivid prose; avoid cliché and purple writing.
- If a '[요청 조건]' block is appended (분량, 시점 등), follow it and respect the requested length.

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
