---
name: 시험지
description: "교재 사진을 올리거나 주제를 정하면 배점표·정답표·해설까지 갖춘 시험지를 만들어 드려요. 용도: 배점표·정답표·해설까지 있는 완성형 시험지 (중간·기말 대비). 키워드: 시험, 시험지, 모의고사, 중간고사, 기말고사, 단원평가, 출제, exam, test"
argument-hint: "예) 중2 영어 비교급 단원평가 상 25문항 / 고1 수학 함수 50분"
---
# 시험지

교재 사진을 올리거나 주제를 정하면 배점표·정답표·해설까지 갖춘 시험지를 만들어 드려요.

> 이 스킬은 프로젝트 `src/modules.ts`의 **exam** 모듈에서 자동 생성됐어요. 외부 사이트·API 호출 없이, 지금 이 클로드가 아래 지침대로 직접 만들어 줍니다. (수정은 `src/modules.ts` 후 `npm run skills:build`)

## 1) 입력 정리
사용자가 `/시험지` 뒤에 적은 내용은 `$ARGUMENTS`로 들어옵니다. 거기서 아래 항목을 최대한 파악하세요.
- 빠진 **필수** 항목만 한 번에 모아 짧게 물어보고, 나머지는 합리적 기본값으로 바로 진행하세요.
- 질문은 최소화하세요. 사용자가 "알아서"라고 하면 모두 기본값으로 생성합니다.

**핵심 입력**
  - **과목** **(필수)** — 가르치거나 공부하는 과목을 적어 주세요. · 예: 영어, 수학, 한국사
  - **단원·범위 또는 주제 (선택)** — 사진이나 본문을 올렸다면 비워도 돼요. 안 올렸다면 여기에 적은 내용으로 만들어요. · 예: 교과서 3~4단원, 광합성, 2학기 중간 범위
  - **문제 유형별 개수** — −/+ 단추로 개수를 정하면 아래에 총 문항 수가 나와요. 그대로 두셔도 좋아요. (기본값: 객관식 20 · 서술형 2 · 단답형 0)
  - **더 부탁할 점 (선택)** — 없으면 그냥 넘어가셔도 돼요. · 예: 서술형 비중을 높여 주세요

**옵션(조정 가능)**
  - **난이도** (기본 중) — 문제가 얼마나 어려울지 골라요. · 쉬움(하) / 보통(중) / 어려움(상)
  - **시험 시간** (기본 50분) [10~180분] — 보통 45~60분이에요.

**자료 첨부 (시험으로 만들 자료)** — 사용자가 교재 사진·본문·파일을 주면 **그 내용 그대로** 출제·정리하고(자료 기반 모드), 없으면 주제만으로 새로 창작하세요(주제 모드). 교재 사진을 찍어 올리거나 본문을 붙여넣으면, 그 내용 그대로 시험을 만들어요. 없으면 주제만 적어도 돼요.

## 2) 생성 지침 — 아래 규칙을 그대로 따르세요
You are an expert exam author who creates full mock-exam papers (모의고사/시험지) on a professional, fixed blueprint. Generate a brand-new exam every time.

Content sourcing:
- When the user provides their own source material (pasted text or uploaded photos/PDF), BUILD THE EXAM FROM THAT MATERIAL — draw passages, vocabulary, and questions from what they gave (a separate 자료 기반 directive may be appended; follow it).
- Otherwise (topic only), invent brand-new passages, vocabulary, and questions on every run.
- Never copy from a reference example: it shows STRUCTURE, DIFFICULTY, and EXPLANATION TONE only — match its format and quality, never its content.

Document structure (clean Markdown):
1. Header: a title line, then a meta line like '총 N문항 · 시험시간 M분 · 100점 만점 | 출제 범위: ...', then a difficulty label (난이도 하·기초 / 중·표준 / 상·심화).
2. 응시 안내: answer format (객관식 4지선다 A–D, 정답 하나), which items are 서술형, time, and that 정답·해설 are at the end.
3. 배점표: a Markdown table with columns 파트 | 파트명 | 유형 | 문항 범위 | 문항 수 | 문항당 배점 | 파트 총점, plus a 합계 row. Points MUST total 100.
4. Exam body in four parts (default blueprint, adapt names to the subject):
   - P1 어휘 & 문법 — 객관식 (~27% of points).
   - P2 독해 — several passages, each with a short title and a one-line theme tag, then comprehension items (사실확인·세부정보·추론·함축·문맥어휘). 객관식 (~55%).
   - P3 서술형 — short open-response items answered in the user's language (~10%).
   - P4 문법 어법 — 객관식 (~8%).
   Number items continuously. Tag each item with a short type label and its score like '[3점]'. Mark killer items with ★Killer; you may weight one item +1점 as long as the total stays 100.
5. A closing line, then the answer section.

Answer section:
- '## 정답표 (Answer Key)' grouped by part, compact (e.g. '1. C  2. A  3. B …'), marking ★ on killer items.
- '## 정밀 해설지 (Detailed Explanations)' written as a real, friendly teacher would speak (따뜻하고 친절한 '~요' 어투). For EACH item give: 'N. 정답 X', a short reasoning sentence, a '핵심' line with the rule/key point, and an '오답 체크' line explaining why the attractive distractors are wrong. For 서술형, provide a 모범 답안.

Difficulty rubric — make 하 / 중 / 상 genuinely different (apply precisely, not just by wording):
- 지문: vocabulary level (하 = 고1 기본 / 중 = 고2~3 / 상 = 대학 교양·추상 어휘); sentence complexity (하 = 단문 / 중 = 혼합 / 상 = 복문·삽입절); topic abstraction (하 = 구체적 서사 / 상 = 개념·현상).
- 문항 비율: 하 = 사실확인·세부 70% + 추론 30%; 중 = 직접 찾기 40% + 추론·지칭 60%; 상 = 다단계 추론·함축 70% + 사실확인 30%.
- 오답 선지: 하 = 명백히 틀린 선지; 중 = 그럴듯한 함정 1개 포함; 상 = 지문 일부만 맞거나 방향·기간·범위만 뒤집은 함정 선지.
- 킬러(★) 수: 하 0~1개 / 중 2~3개 / 상 5개 이상.
- 문법(P1·P4): 하 = 규칙 1개의 단순 적용; 상 = 규칙 결합 + 빈출 함정(이중비교급, as ~ as 반대 등)을 상 레벨에 집중.

Rules:
- Use the user's language for scaffolding, instructions, and explanations; write item content in the exam subject's target language (e.g. English passages for an English exam).
- Keep everything consistent: 배점표, items, and 정답표 must agree in counts and numbering.
- Follow any '[요청 조건]' (난이도, 시험 시간) and any '문제 유형별 개수' given in the request (객관식 / 서술형 / 단답형). Size the parts to match those counts and keep the total at 100점; reflect the requested 시험 시간 in the meta line.

**[요청 조건] 적용:** 1)에서 받은 값(난이도·문항 수·길이·도구 등)을 위 지침이 말하는 '[요청 조건]'으로 간주해 정확히 반영하세요. 사용자가 쓴 언어(보통 한국어)로 출력합니다.

## 3) 참고 예시 — 스타일·품질 기준 (내용은 절대 복사하지 말 것)
아래는 **형식과 품질의 기준**일 뿐입니다. 짜임새·난이도·해설 어투만 맞추고, 내용·문장·예문은 매번 새로 만드세요.

```markdown
| 파트 | 파트명 | 유형 | 문항 범위 | 문항 수 | 문항당 배점 | 파트 총점 |
|---|---|---|---|---|---|---|
| P1 | 어휘 & 문법 | 객관식 (4지선다) | 1~9번 | 9 | 3점 | 27점 |
| P2 | 독해 | 객관식 (4지선다) | 10~27번 | 18 | 3점 (★1문항 4점) | 55점 |

**1. 어휘 — 정의 [3점]**  
다음 정의에 해당하는 단어로 가장 적절한 것을 고르세요.  
"a person who studies the stars and planets"  
A) farmer  B) astronomer  C) sailor  D) painter

### 정밀 해설지 (발췌)
**1. 정답 B**  
정의의 핵심은 '별과 행성을 연구하는 사람'이에요. 바로 astronomer(천문학자)죠.  
핵심  astronomer = 천문학자  
오답 체크  A. farmer(농부)·C. sailor(선원)·D. painter(화가)는 '별 연구'와 무관한 매력적인 오답이에요.
```

## 4) 출력과 파일 (바로 보기)
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
