# 시험지 제작 최종 검토 프로토콜

시험지(모의고사·내신·단원평가 등)를 **만든 직후, PDF로 내보내기 전에** 반드시
이 프로토콜로 적대적 검토를 거친다. 정합성을 먼저 잡고 → 표면 설계 → 언어 →
난이도/한국어 순으로 좁혀간다.

## 실행 순서 (권장)

**1 → 3 → 2 → 6 → 5 → 4 → 7 → 8**, 마지막에 **9**번으로 전체 재확인.

- 1·3·2(정합성·교재규칙·유일성)에서 **문항 구조를 먼저 고친 뒤** 5번(정답 분포)을
  보는 것이 효율적이다.
- **시간이 없으면 9번(4단계 메타 검증) 단일 패스로 1~3을 대체**할 수 있다.
- 정답 정합성·유일성·어법(1·2·3·9)은 **독립성 확보를 위해 Agent 도구로 별도 리뷰어를
  띄워** 실행하길 권장(자기 출제물을 자기가 봐주는 편향을 줄인다).

## 입력 안내

- **교재(원본 페이지)가 첨부된 경우**: 본문 근거·문법 규칙을 **교재 기준**으로 검증한다
  (교재가 가르치지 않은 규칙으로 채점하지 않는다).
- **교재가 없는 경우**: "교재 규칙" 대신 **인쇄된 지문/문장 + 일반적으로 통용되는
  표준 어법**을 기준으로 동일하게 검증한다. 자기완결성(본문만으로 풀림)은 항상 적용.

## 결함 처리

- 심각도 **치명 / 중대 / 경미**로 분류, **치명·중대는 반드시 수정**한 뒤 최종본을 낸다.
- 수정 후 **정답표·선지·배점·문항 번호 일관성**을 재확인한다.
- 최종 전달 시 수정한 결함을 한두 줄로 요약 보고한다.

---

## A. 정답 정합성 & 풀이 가능성 (1–3)

### 1) 자기완결성 / 풀이 가능성 — "본문만으로 정답이 나오는가"

```
You are a senior CSAT (수능) English item-validation specialist reviewing a mock exam for Korean university students (Units 3–4). I have attached (a) the exam and (b) the source textbook pages.

This pass checks ONE thing: SELF-CONTAINMENT. Every reading and grammar item must be solvable using ONLY the printed passage/stem — never outside world knowledge, and never information that exists in the textbook but was cut from the printed passage.

For each item:
1. Quote the exact sentence(s) in the PRINTED passage that license the keyed answer. If none exists, flag the item as NOT self-contained.
2. State whether the answer needs inference, and if so whether that inference is forced by the text or merely plausible.
3. Confirm no distractor becomes defensible for a reader who lacks outside knowledge.

Output a table: 문항 | 자기완결성(O/△/X) | 본문 근거(정확 인용) | 문제점 | 수정 제안.
Assume the student knows nothing beyond the page. Do not praise. Respond in Korean.
```

### 2) 정답 유일성 + 오답 분석 — 복수 정답·미세 모호를 파괴

```
You are an adversarial reviewer whose only goal is to BREAK each multiple-choice item by finding a second defensible answer. The standard is strict: if a knowledgeable student could reasonably argue for any option other than the key — using the attached textbook's own stated rules or the passage's own wording — the item is defective. "School-grammar conventions the textbook does not teach" do NOT count as justification.

For every MCQ:
1. State the key.
2. For EACH other option, write the strongest good-faith case a sharp student could make that it is also correct, then rule it in or out, citing the passage or textbook rule.
3. Verify each distractor is wrong for a single, articulable reason (not merely "less good").
4. Verdict: 정답 유일(O) / 복수 정답 가능(X) / 미세 모호(△).

For every X or △, propose a surgical rewrite of the stem or offending option(s) that leaves exactly one defensible answer, and explain why the fix closes the loophole.
Output per item, then a summary list of all defective items. Respond in Korean. Do not soften your critique.
```

### 3) 어법 항목 ↔ 교재 규칙 정합성 — 교재가 가르친 규칙으로만 채점되는지

```
You are an English grammar examiner. I have attached the textbook's grammar pages (comparative/superlative adjectives; and/also/too; conjunctions) and a mock exam. Every grammar/usage item AND its explanation must conform EXACTLY to the rules as stated on these pages — not to broader prescriptive grammar the textbook never teaches.

For each grammar/usage item:
1. Identify which textbook rule it tests, quoting the textbook's exact wording.
2. Confirm the key is correct under THAT rule, and that every distractor violates a rule the textbook actually states.
3. Flag where: (a) the key relies on a rule the textbook never states; (b) a distractor is actually acceptable under the textbook's rules; (c) the Korean explanation misstates the rule.
4. Pay special attention to: comparative formation by syllable count, the no-double-"w" rule, irregular forms (good/bad), and position of also/too ("Put also before the main verb; put too at the end; too usually has a comma before it").

Output: 문항 | 적용 교재 규칙(원문 인용) | 정답 적합성(O/X) | 오답 모두 오답인가? | 해설 정확성 | 수정 제안. Respond in Korean.
```

## B. 언어·설계 품질 (4–6)

### 4) 원어민 자연스러움 감수 — 번역투·어색한 문장·선지 비대칭 제거

```
You are a native-English copy editor and ELT materials writer. Review every English sentence in this exam — passages, stems, and options — for naturalness, idiomaticity, and register appropriate to CEFR A2–B1 / 수능 4등급.

Flag anything that reads as translated-from-Korean, stilted, ambiguous in reference, inconsistent in tense/article use, or an odd collocation. For each, give the original, a more natural rewrite, and a one-line reason. Do not change meaning or difficulty — naturalness only. Leave correct sentences untouched and do not list them.
Check especially that answer options are PARALLEL in structure and comparable in length, so the key is not betrayed by being the only well-formed or longest option.

Output: 위치(문항/지문) | 원문 | 수정안 | 이유. Respond in Korean (keep the English sentences in English).
```

### 5) 정답 분포 + 길이/위치 단서 — 찍기 방지 & 선지 균형

```
You are a psychometrician auditing this exam for answer-key bias. Two analyses:

1) Distribution: tally correct answers by letter (A/B/C/D) for the multiple-choice sections and report counts. If meaningfully skewed (one letter near-absent, another dominant), identify which specific items could have options reordered to balance it WITHOUT creating new ambiguity, and propose the reordering.
2) Surface cues: for each item, check whether the key is systematically the longest, the most qualified/detailed, the only grammatically complete option, or in a predictable position. List every item a test-wise student could guess from surface features alone, and propose a fix (rebalance option length/specificity).

Output the distribution table first, then flagged items with fixes. Respond in Korean.
```

### 6) 문항 간 독립성 / 누설 / 중복 — 한 문항이 다른 문항 정답을 흘리는지

```
Review this exam for cross-item leakage and redundancy. Treat the whole paper as one system.

Report:
1. Leakage: does any item's stem, options, or passage reveal or hint at another item's answer (e.g., a reading passage stating a rule a later grammar item tests, or two items keyed off the same sentence)?
2. Redundancy: do any two items test the same point in nearly the same way?
3. Vocabulary recycling: is any target word defined/translated in one item in a way that trivializes another?

For each finding: name both items, quote the leaking/overlapping text, explain the dependency, and propose a fix that preserves coverage. Respond in Korean.
```

## C. 난이도 & 한국어 품질 (7–8)

### 7) 난이도 보정 / 수능 유형 정렬 — 45분·4등급 기준 적정성

```
You are a reviewer with 수능 영어 출제 experience. Calibrate this exam against authentic CSAT item style and a target difficulty of 수능 4등급, for a 45-minute, 33-item paper.

For each item, assign 난이도(하/중/상) and a CSAT-type label (빈칸추론, 일치/불일치, 함의추론, 어법, 어휘 등). Then at paper level:
1. Is the difficulty spread reasonable (not uniformly easy, with a few discriminating items)?
2. Do stems and distractors resemble real CSAT items, or read like a generic textbook quiz?
3. Is the reading load achievable in 45 minutes for the target student?
4. Are any items so easy they discriminate nothing, or so trick-dependent they're unfair?

Output: per-item table (난이도/유형/코멘트), then a short paragraph on paper-level balance with concrete swap/rewrite suggestions. Respond in Korean.
```

### 8) 한국어 발문·해설 품질 — 용어 통일·어미 다양성·해설 충실도

```
You are a Korean-language editor specializing in 교육 평가 자료. Review ONLY the Korean text — instructions, stems, and answer-key explanations.

Check:
1. Naturalness/precision (no awkward translation-Korean, no ambiguous 발문).
2. Terminology consistency (use 본문 throughout, not a mix of 지문/본문/글; vary distractor labels — 유인 선지 / 단골 오답 / 오답 — rather than repeating one term mechanically).
3. Explanation quality: each must (a) justify the key with a 본문/규칙 근거 and (b) say why each major distractor is wrong. Flag explanations that merely restate the answer.
4. Tone variety: endings should vary naturally (입니다 / 예요 / 이에요), not repeat one ending.

Output: 위치 | 문제점 유형 | 원문 | 수정안. Respond in Korean.
```

## D. 종합 적대적 검증 (9 — 캡스톤)

### 9) 4단계 메타 검증 — 직접 풀이 → 자기 의심 → 반박 → 재검토

> 시간이 없을 때 1–3을 대신하는 단일 패스로도 쓸 수 있다.

```
Run a four-stage adversarial verification of this entire exam. Move through every stage explicitly; do not skip self-doubt.

Stage 1 — 검토: Solve every item from scratch as a top student would, recording your answer and your reasoning from the passage/rule.
Stage 2 — 자기 의심: For every item where you matched the key, actively try to prove yourself wrong — find a reading under which a different option is correct. For every mismatch, assume YOU are wrong first and re-derive.
Stage 3 — 반박: Play a 1등급 student who paid for this exam and is furious about any defect. Write that student's strongest objections to every weak item.
Stage 4 — 재검토: Resolve each objection — defend the item with evidence, or concede it's defective and give a surgical fix.

Deliver: (1) every item where your independent answer differs from the printed key, with resolution; (2) a defect list ranked by severity (치명/중대/경미); (3) the minimal fix for each. Cite the passage or textbook rule for every judgment. Respond in Korean. Do not flatter the exam — your job is to find what's broken.
```
