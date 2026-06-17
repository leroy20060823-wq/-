# getdesign.md — PPT 디자인 시스템

PPT 모듈이 추천하는 **폰트 + 색 팔레트 프리셋**의 정의서입니다. 코드의 실제 데이터는
[`src/design.ts`](src/design.ts)가 이 문서를 그대로 반영합니다. 프리셋을 바꾸려면 두 곳을
함께 수정하세요.

> 이 파일은 원래 제공되었어야 하는데 저장소에 없어, 웹폰트로 로드 가능한 한국어 폰트 +
> 팔레트로 초안을 만들어 두었습니다. 자유롭게 교체/추가하세요.

## 동작 방식

1. PPT 가이드 폼에서 **주제 · 용도(강조 메시지) · 청중 · 분위기**를 입력받습니다.
2. `recommendThemes()`가 입력 텍스트와 각 프리셋의 `moods`(+동의어)를 매칭해 점수를 매기고
   상위 2~3개를 추천합니다. (지금은 키워드 기반. API 키가 들어오면 동일한 입출력 형태로
   LLM 분석기로 교체/보강 가능 — `src/design.ts` 주석 참고.)
3. 프런트엔드가 추천안을 **라이브 미리보기**(실제 웹폰트 + 팔레트를 적용한 미니 슬라이드
   목업)로 나란히 보여주고, 사용자가 하나를 고릅니다.
4. 고른 테마는 생성 프롬프트에 전달되어, 결과 PPT에 **디자인 가이드(색·폰트)** 가 포함됩니다.

## 폰트 대체 규칙

웹에서 직접 못 쓰는 폰트(인쇄용 명조 등)는 **가장 가까운 Google 웹폰트**로 대체하고,
미리보기 카드에 그 사실을 작게 표시합니다(`substituted: true` + `note`). 모든 폰트는
한글 글리프를 지원하는 것으로 골랐습니다.

## 프리셋

| id | 이름 | 분위기 키워드 | 배경 | 잉크 | 강조색 | 제목 폰트 | 본문 폰트 |
|----|------|----------------|------|------|--------|-----------|-----------|
| `trust` | 신뢰 비즈니스 | 비즈니스·신뢰·기업·발표·데이터 | `#FFFFFF` | `#16203A` | `#2F6DB5` | Noto Sans KR 700 | Noto Sans KR 400 |
| `warm` | 따뜻 감성 | 따뜻·감성·교육·스토리·강연 | `#FBF7EF` | `#3A3027` | `#C2613A` | Gowun Batang 700 | Gowun Dodum 400 |
| `minimal` | 미니멀 모던 | 미니멀·모던·심플·스타트업·테크 | `#FFFFFF` | `#111418` | `#E2543B` | IBM Plex Sans KR 600 | IBM Plex Sans KR 400 |
| `playful` | 발랄 친근 | 발랄·친근·캐주얼·이벤트·어린이 | `#FFFDF6` | `#2A2722` | `#F2A65A` | Jua | Noto Sans KR 400 |
| `classic` | 클래식 격식 | 클래식·격식·전통·학술·역사 | `#FBFAF6` | `#20211C` | `#7A5C2E` | Nanum Myeongjo 800 ※대체 | Nanum Myeongjo 400 |
| `impact` | 강렬 임팩트 | 강렬·임팩트·마케팅·런칭·키노트 | `#14161A` | `#FFFFFF` | `#FF5A36` | Black Han Sans | Noto Sans KR 500 |

※ `classic`의 제목은 인쇄용 명조체를 웹폰트 `Nanum Myeongjo`로 대체합니다.

## 프리셋 추가하기

1. `src/design.ts`의 `PRESETS`에 항목을 추가합니다(팔레트 + heading/body 폰트 + `moods`).
2. 필요하면 `SYNONYMS`에 분위기 동의어를 더합니다(매칭 정확도 향상).
3. 위 표에도 같은 내용을 적어 문서를 동기화합니다.
4. 폰트는 [Google Fonts](https://fonts.google.com)에서 한글을 지원하는 family로 고르고,
   웹에서 못 쓰면 `substituted: true` + `note`를 채웁니다.

## API

- `GET /api/ppt/themes` — 전체 프리셋.
- `POST /api/ppt/recommend` — body `{ topic, purpose, audience, mood }` → 상위 추천 2~3개. (API 키 불필요)
