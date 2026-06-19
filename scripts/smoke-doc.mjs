// Browser smoke test for the paged-document QA pipeline (needs dev server :3000).
// Renders long content + a long table + a wide table and asserts: multiple pages,
// zero vertical/horizontal overflow, and every table fragment repeats its header.
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
await page.addInitScript(() => localStorage.setItem("aio_onboarded", "1"));
await page.goto("http://localhost:3000/#generate", { waitUntil: "load" });

const result = await page.evaluate(async () => {
  const { renderPagedDocument } = await import("/docqa.js");

  const paras = Array.from(
    { length: 26 },
    (_, i) =>
      `<p>${i + 1}. 이 문단은 페이지 넘김과 한국어 줄바꿈을 시험하기 위해 충분히 길게 작성한 본문입니다. ` +
      "공백 없이 이어지는긴문장도자연스럽게줄바꿈되어야하며 표와 목록도 페이지 경계에서 깨지지 않아야 합니다.</p>",
  ).join("");

  const rows = Array.from(
    { length: 40 },
    (_, i) =>
      `<tr><td>${i + 1}</td><td>headword${i + 1}</td><td>[aɪ.p: ${i + 1}]</td><td>명사</td><td>아주 긴 한국어 뜻풀이를 넣어서 행 높이를 키웁니다</td><td>This is an example sentence number ${i + 1}.</td></tr>`,
  ).join("");
  const table =
    `<table><thead><tr><th>번호</th><th>표제어</th><th>발음</th><th>품사</th><th>뜻</th><th>예문</th></tr></thead><tbody>${rows}</tbody></table>`;

  const wide =
    `<table><thead><tr><th>A</th><th>B</th><th>C</th></tr></thead><tbody><tr>` +
    `<td>${"가나다라마바사아자차".repeat(20)}</td><td>짧음</td><td>짧음</td></tr></tbody></table>`;

  const src = document.createElement("div");
  src.style.display = "none";
  src.innerHTML = `<h1>단어장</h1>${paras}<h2>표제어 목록</h2>${table}<h2>넓은 표</h2>${wide}`;
  document.body.appendChild(src);

  const container = document.createElement("div");
  container.style.width = "780px";
  document.body.appendChild(container);

  const log = await renderPagedDocument(container, src, {
    page: "a4",
    fonts: ["Noto Sans KR", "Noto Serif KR"],
    footer: { left: "단어장" },
  });

  const contents = [...container.querySelectorAll(".doc-content")];
  const overflowV = contents.filter((c) => c.scrollHeight - c.clientHeight > 1).length;
  const overflowH = contents.filter((c) => c.scrollWidth - c.clientWidth > 1).length;
  const tables = [...container.querySelectorAll(".doc-content table")];
  const tablesWithHeader = tables.filter((t) => t.querySelector("thead th")).length;

  return {
    pages: container.querySelectorAll(".doc-frame").length,
    overflowV,
    overflowH,
    tableFragments: tables.length,
    tablesWithHeader,
    qaOk: log.ok,
    passes: log.passes.length,
  };
});

console.log(JSON.stringify(result, null, 2));
const pass =
  result.pages > 1 &&
  result.overflowV === 0 &&
  result.overflowH === 0 &&
  result.tableFragments >= 2 && // the long table must have split into >=2 fragments
  result.tablesWithHeader === result.tableFragments; // every fragment repeats its header
console.log(pass ? "\nDOC SMOKE PASS ✅" : "\nDOC SMOKE FAIL ❌");
await browser.close();
process.exit(pass ? 0 : 1);
