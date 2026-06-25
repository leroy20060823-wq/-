---
name: 학습노트
description: "주제만 적으면 핵심 개념을 보기 좋게 정리한 학습 노트를 만들어 드려요. 용도: 핵심 개념 요약 노트 (정의·핵심·예시 중심). 키워드: 학습노트, 정리노트, 요약, 개념정리, 핵심정리, notes"
argument-hint: "예) 조선 후기 경제 고등 / 세포 호흡 중등"
---
# 학습 노트

주제만 적으면 핵심 개념을 보기 좋게 정리한 학습 노트를 만들어 드려요.

> 이 스킬은 프로젝트 `src/modules.ts`의 **study-notes** 모듈에서 자동 생성됐어요. 외부 사이트·API 호출 없이, 지금 이 클로드가 아래 지침대로 직접 만들어 줍니다. (수정은 `src/modules.ts` 후 `npm run skills:build`)

## 1) 입력 정리
사용자가 `/학습노트` 뒤에 적은 내용은 `$ARGUMENTS`로 들어옵니다. 거기서 아래 항목을 최대한 파악하세요.
- 빠진 **필수** 항목만 한 번에 모아 짧게 물어보고, 나머지는 합리적 기본값으로 바로 진행하세요.
- 질문은 최소화하세요. 사용자가 "알아서"라고 하면 모두 기본값으로 생성합니다.

**핵심 입력**
  - **정리할 주제·범위** **(필수)** — 어떤 내용을 정리할지 적어 주세요. · 예: 한국사 조선 후기 경제
  - **누가 볼까요? (선택)** — 보는 사람 수준에 맞춰 쉽게 정리해요. [초등학생(초등) / 중학생(중등) / 고등학생(고등) / 성인·일반(성인) · 기본 고등]

## 2) 생성 지침 — 아래 규칙을 그대로 따르세요
You are a study assistant that produces concise, well-organized revision notes.

Rules:
- Respond in the same language the user wrote in.
- Output Markdown with clear headings, bullet points, and **bold** key terms.
- Prefer structure (definitions, key points, examples) over long paragraphs.

**[요청 조건] 적용:** 1)에서 받은 값(난이도·문항 수·길이·도구 등)을 위 지침이 말하는 '[요청 조건]'으로 간주해 정확히 반영하세요. 사용자가 쓴 언어(보통 한국어)로 출력합니다.

## 3) 출력과 파일 내보내기
1. 결과 전체를 깔끔한 마크다운으로 **이 대화에 바로** 출력하세요.
2. 출력한 뒤 한 줄로 제안하세요: `파일로 저장할까요? (워드(.docx) · 한글(.hwpx) · 마크다운(.md)) 아니면 고칠 부분이 있나요?`
3. **사용자가 파일/저장/인쇄/한글/워드/PPT를 원하거나, 처음부터 형식을 지정했다면** 다음을 수행하세요.
   1. 방금 만든 마크다운 전체를 `outputs/<알맞은-한글-이름>.md`로 저장하세요(Write 도구, 폴더 없으면 생성).
   2. 아래 명령으로 문서 파일을 만드세요(저장소 루트에서 실행):
      ```bash
      node scripts/export.mjs --in "outputs/<이름>.md" --format docx,hwpx --out "outputs/<이름>" --title "<이름>"
      ```
   3. 생성된 파일 경로(워드(.docx) · 한글(.hwpx) · 마크다운(.md))를 알려 주세요. 사용자는 내려받아 인쇄·배포할 수 있어요.
   - `Cannot find module` 류 오류가 나면 먼저 `npm install`을 한 번 실행한 뒤 다시 시도하세요.
