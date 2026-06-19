// Browser smoke test for the slide rendering pipeline (requires the dev server
// on :3000). Renders a deliberately abusive deck — over-long title, a slide with
// 10 long Korean bullets, a low-contrast dark theme — and asserts the pipeline's
// guarantees: no flow overflows, the long slide gets split, contrast is fixed.
import { chromium } from "playwright";

const base = process.env.BASE || "http://localhost:3000";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
await page.goto(base + "/", { waitUntil: "load" });

const result = await page.evaluate(async () => {
  const { parseDeck, renderDeck } = await import("/slides.js");
  const longBullets = Array.from(
    { length: 10 },
    (_, i) => `- 매우 긴 불릿 항목 ${i + 1}번으로 한 줄에 다 들어가지 않을 만큼 충분히 길게 작성한 한국어 문장입니다 자동 줄바꿈과 분할 확인`,
  );
  const md = [
    "## Slide 1: 신제품 발표회 그리고 일부러 아주 길게 늘여 쓴 제목으로 자동 축소가 동작하는지 끝까지 확인",
    "이것은 부제목이며 역시 꽤 길게 작성하여 레이아웃이 깨지지 않는지 살펴봅니다",
    "",
    "## Slide 2: 핵심 내용 점검",
    ...longBullets,
    "> Speaker notes: 발표자 메모.",
    "",
    "## Slide 3: 요약",
    "- 짧은 항목 하나",
    "- 또 다른 항목 둘",
  ].join("\n");

  // Dark bg with deliberately near-black ink → contrast guard must override ink.
  const theme = {
    palette: { bg: "#101418", surface: "#20242b", ink: "#0a0a0a", sub: "#161616", accent: "#FF5A36" },
    heading: { webFont: "Black Han Sans" },
    body: { webFont: "Noto Sans KR" },
  };

  const container = document.createElement("div");
  container.style.width = "900px";
  document.body.appendChild(container);

  const report = await renderDeck(container, parseDeck(md), theme);

  const flows = [...container.querySelectorAll(".deck-slide .deck-flow")];
  const overflowCount = flows.filter((f) => f.scrollHeight - f.clientHeight > 1).length;

  const firstSlide = container.querySelector(".deck-slide");
  const titleColor = getComputedStyle(firstSlide.querySelector(".deck-title")).color;
  const slideBg = getComputedStyle(firstSlide).backgroundColor;

  // Second pass: a single slide UNDER the bullet cap (5) but each bullet huge, so
  // the only way to fit is the height-based split path (report.splits).
  const huge = Array.from(
    { length: 5 },
    (_, i) =>
      `핵심 항목 ${i + 1}: ` +
      "이 문장은 한 슬라이드에 다섯 개가 절대 들어갈 수 없을 만큼 아주 길게 작성한 한국어 설명입니다. ".repeat(12),
  );
  const c2 = document.createElement("div");
  c2.style.width = "900px";
  document.body.appendChild(c2);
  const report2 = await renderDeck(
    c2,
    { slides: [{ kind: "content", title: "거대한 내용", bullets: huge }] },
    theme,
  );
  const overflow2 = [...c2.querySelectorAll(".deck-slide .deck-flow")].filter(
    (f) => f.scrollHeight - f.clientHeight > 1,
  ).length;

  return {
    report,
    slideCount: container.querySelectorAll(".deck-slide").length,
    overflowCount,
    titleColor,
    slideBg,
    report2,
    overflow2,
    slideCount2: c2.querySelectorAll(".deck-slide").length,
  };
});

console.log(JSON.stringify(result, null, 2));

const pass =
  result.overflowCount === 0 &&
  result.slideCount > 3 && // 10-bullet slide must have split (cap path)
  result.overflow2 === 0 &&
  result.slideCount2 > 1 && // huge-bullet slide must have split (height path)
  result.report2.splits >= 1;

console.log(pass ? "\nSMOKE PASS ✅" : "\nSMOKE FAIL ❌");
await browser.close();
process.exit(pass ? 0 : 1);
