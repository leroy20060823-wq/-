# prompts/ — 복붙용 프롬프트 (1 파일 = 1 프롬프트)

각 `.txt`는 **순수 텍스트 프롬프트 하나**입니다(마크다운·코드펜스 없음).
파일 열고 **전체 선택 → 복사**하면 그대로 깔끔하게 붙여넣을 수 있어요.

## 홈페이지 SDK용 (system / review)
- `system/exam.txt` · `system/vocab.txt` · `system/ppt.txt` · `system/excel.txt`
  → `messages.create({ system: <파일 내용>, messages:[user] })` 의 system에 그대로.
- `review/exam-capstone.txt` — 시험지 4단계 적대적 검증(필수 QA).
- `review/ppt.txt` · `review/excel.txt` · `review/vocab.txt` · `review/explanation.txt`
  — 각 모듈 산출물 검토(별도 messages.create 호출로 독립 실행).
- `review/router.txt` — 자연어 → 모듈/파라미터 분류(JSON 반환).

전체 흐름·모델/토큰·SDK 코드 예시는 `docs/anthropic-sdk-prompts.md` 참고.

## Claude Code 밤샘 작업용 (build/)
- `build/00-session-context.txt` — 세션 시작 시 한 번 붙여넣는 공통 컨텍스트.
- `build/01..15-*.txt` — 작업 한 건당 한 파일. 하고 싶은 작업 파일 내용을 붙여넣어 실행.

권장 순서: 02 → 01 → 03 → 05 + 04 → 09 + 15 → 06 → 11 → 07 / 08 / 10 / 12 / 13 / 14.

> 같은 프롬프트가 `docs/`(읽기용, 설명 포함)와 `prompts/`(복붙용, 순수 텍스트)에
> 둘 다 있습니다. 복붙은 `prompts/`에서 하세요.
