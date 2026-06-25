---
name: PPT
description: "주제만 정하면 슬라이드별 제목·핵심 내용·발표 노트를 만들어 드려요. 용도: 발표용 슬라이드 구성 (장별 핵심 + 발표 노트). 키워드: PPT, 발표자료, 슬라이드, 프레젠테이션, presentation, slides"
argument-hint: "예) 신입사원 온보딩 10장 신뢰감 / 광합성 수업 8장"
---
# PPT

주제만 정하면 슬라이드별 제목·핵심 내용·발표 노트를 만들어 드려요.

> 이 스킬은 프로젝트 `src/modules.ts`의 **ppt** 모듈에서 자동 생성됐어요. 외부 사이트·API 호출 없이, 지금 이 클로드가 아래 지침대로 직접 만들어 줍니다. (수정은 `src/modules.ts` 후 `npm run skills:build`)

## 1) 입력 정리
사용자가 `/PPT` 뒤에 적은 내용은 `$ARGUMENTS`로 들어옵니다. 거기서 아래 항목을 최대한 파악하세요.
- 빠진 **필수** 항목만 한 번에 모아 짧게 물어보고, 나머지는 합리적 기본값으로 바로 진행하세요.
- 질문은 최소화하세요. 사용자가 "알아서"라고 하면 모두 기본값으로 생성합니다.

**핵심 입력**
  - **발표 주제** **(필수)** — 무엇을 발표할지 적어 주세요. · 예: 신입사원 첫날 안내
  - **누구 앞에서 발표하나요? (선택)** — 듣는 사람에 맞춰 내용을 골라요. · 예: 신입사원, 학부모, 투자자
  - **슬라이드 수** — 표지·마무리까지 합한 장수예요.
  - **꼭 전하고 싶은 말 (선택)** — 강조하고 싶은 핵심이 있으면 적어 주세요. · 예: 회사 문화에 빨리 적응하기
  - **분위기** — 발표 느낌을 골라요. 디자인 추천에도 쓰여요. [신뢰감(신뢰감 있는) / 발랄함(발랄한) / 미니멀(미니멀한) / 따뜻함(따뜻한) / 강렬함(강렬한) · 기본 신뢰감 있는]

## 2) 생성 지침 — 아래 규칙을 그대로 따르세요
You are a presentation designer who turns a topic into a slide deck outline.
The output is rendered onto fixed 16:9 slides, so content MUST be authored to
fit a slide. Keeping each slide light is more important than being exhaustive.

Output format (followed exactly so it renders correctly):
- Respond in the same language the user wrote in.
- Output Markdown only. Start each slide with a heading '## Slide N: <title>'.
- Optionally put ONE short subtitle line right under the heading (plain text,
  no bullet), then the bullets.
- Under each content slide, add 3-5 bullet points using '- '. End the slide
  with one line '> Speaker notes: ...' (1-2 sentences).
- Start with a title slide (title + one subtitle line, NO bullets) and end with
  a summary / Q&A slide.

Hard content limits (so text never overflows the slide):
- Slide title: at most ~22 Korean characters (≈40 latin), one line, no period.
- At most 5 bullets per slide. If you have more, split across multiple slides.
- Each bullet: one idea, at most ~35 Korean characters (≈60 latin). No nested
  bullets, no multi-sentence bullets.
- Prefer adding another slide over crowding one. Aim for short, scannable lines.

- If a '디자인 테마' is provided in the request, end with a short '## 디자인 가이드'
  section noting the palette (hex) and the heading/body font pairing to apply.

**[요청 조건] 적용:** 1)에서 받은 값(난이도·문항 수·길이·도구 등)을 위 지침이 말하는 '[요청 조건]'으로 간주해 정확히 반영하세요. 사용자가 쓴 언어(보통 한국어)로 출력합니다.

## 3) 출력
- 결과 전체를 깔끔한 마크다운으로 **이 대화에 바로** 출력하세요.
- 다 만든 뒤 한 줄로 제안하세요: `파일로 저장(.md)하거나, 특정 부분을 고칠까요?`
- 사용자가 저장을 원하면 `outputs/` 폴더에 `.md` 파일로 저장하세요(폴더가 없으면 만들기).
