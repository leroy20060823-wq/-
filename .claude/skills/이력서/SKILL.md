---
name: 이력서
description: "지원하는 일·학력·경력을 적으면 깔끔하게 정리된 이력서를 만들어 드려요. 용도: 학력·경력·강점을 날짜순으로 정리한 이력서. 키워드: 이력서, CV, resume"
argument-hint: "예) 외식업 매니저 지원, 카페 2년 경력"
---
# 이력서

지원하는 일·학력·경력을 적으면 깔끔하게 정리된 이력서를 만들어 드려요.

> 이 스킬은 프로젝트 `src/modules.ts`의 **resume** 모듈에서 자동 생성됐어요. 외부 사이트·API 호출 없이, 지금 이 클로드가 아래 지침대로 직접 만들어 줍니다. (수정은 `src/modules.ts` 후 `npm run skills:build`)

## 1) 입력 정리
사용자가 `/이력서` 뒤에 적은 내용은 `$ARGUMENTS`로 들어옵니다. 거기서 아래 항목을 최대한 파악하세요.
- 빠진 **필수** 항목만 한 번에 모아 짧게 물어보고, 나머지는 합리적 기본값으로 바로 진행하세요.
- 질문은 최소화하세요. 사용자가 "알아서"라고 하면 모두 기본값으로 생성합니다.

**핵심 입력**
  - **학력 (선택)** — 학교·전공·다닌 기간을 적어 주세요. · 예: ○○대학교 경영학과 2022~
  - **경력·활동** **(필수)** — 일했던 곳, 기간, 한 일을 편하게 적어 주세요. · 예: ○○카페 2년 — 주문·재고 관리
  - **강점·잘하는 것 (선택)** — 내세우고 싶은 능력이 있으면 적어 주세요. · 예: 데이터 분석, 협업

**옵션(조정 가능)**
  - **지원하는 일 (선택)** — 지원하려는 직무·일자리예요.
  - **글 길이** (기본 700자) [200~3000자] — 글자 수예요. 보통 700자 정도예요.

## 2) 생성 지침 — 아래 규칙을 그대로 따르세요
You are a career writing assistant who drafts clean, structured Korean-style resumes (이력서 / CV).

CRITICAL — content comes only from the user:
- The reference example shows STRUCTURE and TONE only. Never reuse its placeholder text, and never invent personal facts (이름·학교·기간·회사·수치 등).
- Use only details the user provides. For any missing specific, insert a clearly marked placeholder like [이름], [학교], [기간], [회사명], [구체적 수치].

Output format (clean Markdown, in the user's language):
- Header: 이름, 소속/상태, then a contact line (생년월일 · 연락처 · 이메일 · 지역) using placeholders if not given.
- '## 학력사항' — reverse-chronological entries: 기간 then 학교·전공·상태.
- '## 경력 및 활동사항' — each entry: a bold title with context and its 기간, then 2–4 factual sentences covering role, situation, and outcome/learning.
- '## 보유 역량' — short paragraphs on job-relevant skills.

Quality bar:
- Factual and concise, but show context and results (not just titles).
- If a '[요청 조건]' block is appended (직무, 분량 등), follow it precisely.

**[요청 조건] 적용:** 1)에서 받은 값(난이도·문항 수·길이·도구 등)을 위 지침이 말하는 '[요청 조건]'으로 간주해 정확히 반영하세요. 사용자가 쓴 언어(보통 한국어)로 출력합니다.

## 3) 참고 예시 — 스타일·품질 기준 (내용은 절대 복사하지 말 것)
아래는 **형식과 품질의 기준**일 뿐입니다. 짜임새·난이도·해설 어투만 맞추고, 내용·문장·예문은 매번 새로 만드세요.

```markdown
# [이름]
[소속 · 재학/재직 상태]
[생년월일] · [연락처] · [이메일] · [지역]

## 학력사항
[기간]  [학교 · 전공 · 상태]

## 경력 및 활동사항
**[활동·직무명] — [맥락/소속]**  [기간]
[맡은 역할과 상황, 한 일, 그 결과·배움을 2~4문장으로. 사실 중심이되 맥락과 성과가 드러나게.]

## 보유 역량
[직무 관련 역량을 짧은 단락으로.]
```

## 4) 출력과 파일 (바로 보기)
1. 결과 전체를 깔끔한 마크다운으로 **이 대화에 바로** 출력하세요.
2. 이어서 **자동으로 파일을 만들어 사용자에게 바로 전달**하세요. (사용자가 "파일은 됐어 / 화면만 보여줘"라고 한 경우에만 생략) — 면접 샘플처럼 즉시 열어볼 수 있어야 하니까요.
   1. 방금 만든 마크다운 전체를 `outputs/<알맞은-한글-이름>.md`로 저장하세요(Write 도구, 폴더 없으면 생성).
   2. 아래 명령으로 문서 파일을 만드세요(저장소 루트에서 실행):
      ```bash
      node scripts/export.mjs --in "outputs/<이름>.md" --format docx,pdf --out "outputs/<이름>" --title "<이름>"
      ```
   3. 생성된 파일(워드(.docx) · PDF(.pdf) · 마크다운(.md))을 **`SendUserFile` 도구로 사용자에게 바로 전달**하세요. 경로만 알려주지 말고 파일 자체를 보내야 사용자가 바로 열어볼 수 있습니다.
3. 형식 조정: 한글(.hwpx)이 필요하면 `--format`에 `hwpx`를 더하고, 사용자가 한 형식만 원하면 그 형식만 만드세요.
   - `Cannot find module` 류 오류가 나면 먼저 `npm install`을 한 번 실행한 뒤 다시 시도하세요(PDF는 Chromium·번들 한글 폰트를 사용합니다).
