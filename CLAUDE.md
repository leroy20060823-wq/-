# CLAUDE.md

학습·업무 자료(시험지·단어장·학습지 등)를 생성하는 플랫폼. 생성 모듈은
`src/modules.ts`에 있고, 클로드 코드 슬래시 명령(스킬)은 `.claude/skills/`로
**자동 생성**된다(`npm run skills:build`). 스킬 파일은 손으로 고치지 말고
`src/modules.ts`/`scripts/build-skills.mjs`를 고친 뒤 재생성한다.

## 자료 렌더러 (영역별)

- **시험지** → `scripts/exam-pdf.mjs`(= `buildExamModel` + `scripts/exam_pdf.py`,
  WeasyPrint). 프리미엄 표지·네이비 섹션바·**5지선다 ①②③④⑤**·정답표·해설.
  - **용지: 기본 B4(JIS-B4 257×364mm)** — 수능·동형모의고사 표준. 항상 B4로 출력한다.
    A4가 필요하면 `--paper a4`. (`--variant teacher|student|key|all` 와 함께 사용)
- **단어장** → `scripts/vocab-pdf.mjs`(Chromium). 마룬 헤더·품사 배지.
- **그 밖** → `scripts/export.mjs`(Markdown → docx/pdf/hwpx/pptx/html).
- 표지는 **중립·범용이 기본**. 학교·기관 브랜드(brand)·모토(motto)·영문 부제는
  사용자가 직접 요청할 때만 넣고, 임의로 만들어 넣지 않는다.

## 🔒 시험지 제작 필수 규칙 — 최종 검토 프로토콜

**시험지(모의고사·내신·단원평가 등)를 제작하면, 항상 PDF로 내보내기 전에
[`scripts/exam-review-protocol.md`](scripts/exam-review-protocol.md)의 최종 검토
프로토콜을 적용한 뒤 최종본을 낸다.** 스킬(`/시험지`)뿐 아니라 다른 경로(직접 작성,
`/자료` 라우터 등)로 만들 때도 동일하게 적용한다.

- 권장 순서: **1 → 3 → 2 → 6 → 5 → 4 → 7 → 8 → 9** (시간이 없으면 9번 단일 패스로 1~3 대체).
- 정답 정합성·유일성·어법(1·2·3·9)은 `Agent` 도구로 독립 리뷰어를 띄워 검증(자기 편향 감소).
- 치명·중대 결함은 반드시 수정한 뒤, 정답표·선지·배점·번호 일관성을 재확인하고,
  최종 전달 시 수정 결함을 한두 줄로 요약 보고한다.

## 개발

- `npm run typecheck` · `npm test`(82 tests) · `npm run build` 통과 유지.
- 작업 브랜치: `claude/cool-wright-6a6tii`.
