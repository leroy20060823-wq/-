// Builds design assets from design-systems/<slug>/DESIGN.md:
//   - public/design-thumbnails/<slug>-design-preview.png  (Playwright, ×3)
//   - merges an entry into designs.json
//
// Usage: node scripts/build-design-assets.mjs <slug...>   (or "all")
// Re-runnable: upserts designs.json so batches accumulate. Per-design try/catch
// logs failures and continues.
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sysDir = join(root, "design-systems");
const thumbDir = join(root, "public", "design-thumbnails");
const designsPath = join(root, "designs.json");

// ---- DESIGN.md (YAML frontmatter) parsing ----
function parseDesignMd(text) {
  const out = { name: "", description: "", colors: {}, fonts: {} };
  const lines = text.split("\n");
  let section = null;
  let typGroup = null;
  const typ = {}; // group -> fontFamily
  for (const line of lines) {
    const top = line.match(/^([a-zA-Z_-]+):\s*(.*)$/);
    if (top && !line.startsWith(" ")) {
      section = top[1];
      if (section === "name") out.name = top[2].trim();
      if (section === "description") out.description = top[2].trim();
      typGroup = null;
      continue;
    }
    if (section === "colors") {
      const m = line.match(/^\s{2}([\w-]+):\s*"?(#[0-9a-fA-F]{3,8})"?/);
      if (m) out.colors[m[1]] = m[2].toLowerCase();
    } else if (section === "typography") {
      const g = line.match(/^\s{2}([\w-]+):\s*$/);
      if (g) typGroup = g[1];
      const ff = line.match(/^\s{4}fontFamily:\s*"?(.+?)"?\s*$/);
      if (ff && typGroup) typ[typGroup] = ff[1];
    }
  }
  out._typ = typ;
  // Prose fallback when there's no YAML colors block.
  if (Object.keys(out.colors).length === 0) {
    out._prose = true;
    out.colorList = allHex(text);
    out.roleHints = roleHintsFrom(text);
    const pf = proseFonts(text);
    out._proseFonts = pf;
    if (!out.name) {
      const h = text.match(/^#\s+(.+)$/m);
      out.name = h ? h[1].replace(/design system\s*(inspired by)?/i, "").trim() : "";
    }
    if (!out.description) {
      const para = text.split("\n").find((l) => l.trim() && !l.startsWith("#") && !l.startsWith("|"));
      out.description = para ? para.trim() : "";
    }
  }
  return out;
}

const GENERIC = new Set(["serif", "sans-serif", "monospace", "system-ui", "cursive"]);
function splitFamily(ff) {
  if (!ff) return { ideal: "", subs: [] };
  const parts = ff.split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
  const ideal = parts[0] || "";
  const subs = parts.slice(1).filter((p) => !GENERIC.has(p.toLowerCase()));
  return { ideal, subs };
}

// ---- Markdown-prose fallback (some DESIGN.md aren't YAML frontmatter) ----
function allHex(text) {
  const out = [];
  const seen = new Set();
  const re = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g;
  let m;
  while ((m = re.exec(text))) {
    const h = m[0].toLowerCase();
    if (!seen.has(h)) {
      seen.add(h);
      out.push(h);
    }
  }
  return out;
}
function roleHintsFrom(text) {
  const hints = {};
  const set = (role, hex) => {
    if (!hints[role]) hints[role] = hex.toLowerCase();
  };
  for (const line of text.split("\n")) {
    const hex = (line.match(/#[0-9a-fA-F]{6}\b/) || [])[0];
    if (!hex) continue;
    const L = line.toLowerCase();
    if (/background|surface|canvas|\bwhite\b|\bbase\b|\bpaper\b/.test(L)) set("bg", hex);
    if (/primary|brand|\bcta\b|accent|\blink/.test(L)) set("accent", hex);
    if (/secondary|muted|neutral|gray|grey|\bsub/.test(L)) set("sub", hex);
    if (/text|near.?black|\bink\b|foreground|heading/.test(L)) set("ink", hex);
  }
  return hints;
}
function paletteFromHints(hints, list) {
  const sorted = [...list].sort((a, b) => lum(a) - lum(b));
  const bg = hints.bg || sorted[sorted.length - 1] || "#ffffff";
  const ink = hints.ink || sorted[0] || "#111111";
  const accent = hints.accent || list.find((v) => lum(v) > 0.15 && lum(v) < 0.8) || list[0] || "#888";
  const sub = hints.sub || ink;
  return { bg, surface: bg, ink, sub, accent };
}
function proseFonts(text) {
  const disp = text.match(/(?:Display|Heading)[^\n]*?`([^`]+)`/i);
  const body = text.match(/(?:Body|UI|Product|Text)[^\n]*?`([^`]+)`/i);
  return { title: disp ? disp[1] : "", body: body ? body[1] : disp ? disp[1] : "" };
}

// Latin "ideal/substitute" font name -> a Google Fonts family we can load.
const LATIN_GF = {
  inter: "Inter", söhne: "Inter", sohne: "Inter", helvetica: "Inter", arial: "Inter",
  "tiempos headline": "Noto Serif", tiempos: "Noto Serif", copernicus: "Cormorant Garamond",
  "cormorant garamond": "Cormorant Garamond", "eb garamond": "EB Garamond", garamond: "EB Garamond",
  "times new roman": "Noto Serif", georgia: "Noto Serif", "playfair display": "Playfair Display",
  "jetbrains mono": "JetBrains Mono", "space grotesk": "Space Grotesk", "space mono": "Space Mono",
  "ibm plex mono": "IBM Plex Mono", "ibm plex sans": "IBM Plex Sans", roboto: "Roboto",
  "roboto mono": "Roboto Mono", manrope: "Manrope", "dm sans": "DM Sans", poppins: "Poppins",
  montserrat: "Montserrat", lato: "Lato", "work sans": "Work Sans", "plus jakarta sans": "Plus Jakarta Sans",
};
function latinGoogle(name) {
  if (!name) return "Inter";
  return LATIN_GF[name.toLowerCase()] || "Inter";
}

// English descriptor -> Korean mood tags for recommendation matching.
const TAG_LEX = [
  [/warm|humanist|editorial|cream|coral/i, ["따뜻", "에디토리얼"]],
  [/serif|slab|garamond|tiempos/i, ["세리프", "클래식"]],
  [/minimal|clean|whitespace|simple|restrained/i, ["미니멀", "깔끔"]],
  [/dark|black|navy|night/i, ["다크"]],
  [/neon|electric|vivid|vibrant|saturated/i, ["네온", "생동감"]],
  [/lux|premium|elegant|refined|sophisticat/i, ["럭셔리", "우아", "프리미엄"]],
  [/bold|strong|loud|impact|heavy/i, ["강렬", "임팩트"]],
  [/playful|friendly|fun|round|soft/i, ["발랄", "친근"]],
  [/corporate|enterprise|business|trust|professional/i, ["비즈니스", "신뢰", "전문"]],
  [/tech|developer|engineer|code|mono|terminal|infra|data/i, ["테크", "모노", "데이터"]],
  [/gradient|colorful|multi-?color|rainbow/i, ["그라데이션", "컬러풀"]],
  [/modern|contemporary|sleek/i, ["모던"]],
  [/geometric|grid|systematic/i, ["기하학", "모던"]],
  [/startup|product|saas|landing/i, ["스타트업", "제품"]],
];
function deriveTags(desc) {
  const tags = new Set();
  for (const [re, ts] of TAG_LEX) if (re.test(desc)) ts.forEach((t) => tags.add(t));
  if (tags.size === 0) tags.add("모던");
  return [...tags];
}

function lum(hex) {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
function pick(colors, keys) {
  for (const k of keys) if (colors[k]) return colors[k];
  return null;
}
function palette(colors) {
  const entries = Object.entries(colors);
  const vals = entries.map(([, v]) => v);
  const bg = pick(colors, ["canvas", "background", "bg", "surface", "surface-soft", "base"]) ||
    vals.slice().sort((a, b) => lum(b) - lum(a))[0];
  const ink = pick(colors, ["ink", "body-strong", "text", "foreground", "body"]) ||
    vals.slice().sort((a, b) => lum(a) - lum(b))[0];
  const accent = pick(colors, ["primary", "accent", "brand", "primary-active", "accent-teal"]) ||
    vals.find((v) => { const l = lum(v); return l > 0.2 && l < 0.8; }) || vals[0];
  const sub = pick(colors, ["muted", "body", "muted-soft", "secondary"]) || ink;
  const accent2 = pick(colors, ["accent-teal", "accent-amber", "accent2", "secondary"]) || undefined;
  return { bg, surface: pick(colors, ["surface-card", "surface-soft", "surface"]) || bg, ink, sub, accent, accent2 };
}

function titleIsSerif(ideal, desc) {
  return /serif|garamond|tiempos|copernicus|playfair|times|georgia/i.test(`${ideal} ${desc}`);
}

// ---- HTML tile (common KR slide scenario + per-design signature) ----
function archetype(tags) {
  if (tags.some((t) => ["럭셔리", "우아", "프리미엄"].includes(t))) return "luxury";
  if (tags.some((t) => ["테크", "다크", "네온", "모노"].includes(t))) return "tech";
  if (tags.some((t) => ["그라데이션", "컬러풀", "발랄"].includes(t))) return "colorful";
  if (tags.some((t) => ["에디토리얼", "세리프", "따뜻"].includes(t))) return "editorial";
  return "modern";
}

function tileHtml(d) {
  const p = d.palette;
  const titleFont = d.fonts.titleWeb;
  const latin = d.fonts.latinWeb;
  const a = archetype(d.tags);
  const chips = d.colors
    .map((c) => `<div class="chip"><span class="sw" style="background:${c}"></span><span class="hex">${c}</span></div>`)
    .join("");
  const upper = a === "luxury" || a === "tech";
  const labelLs = a === "luxury" ? "0.3em" : a === "tech" ? "0.18em" : "0.12em";
  const titleLs = a === "luxury" ? "0.04em" : titleIsSerif(d.fonts.title, "") ? "-0.01em" : "0";
  const radius = a === "colorful" ? 18 : a === "editorial" ? 10 : a === "luxury" ? 0 : 8;
  const titleWeight = a === "editorial" || a === "luxury" ? 600 : 800;
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&family=Noto+Serif+KR:wght@400;600;700&family=${encodeURIComponent(titleFont).replace(/%20/g, "+")}:wght@400;600;700;900&family=${encodeURIComponent(latin).replace(/%20/g, "+")}:wght@400;500;700&display=swap">
<style>
  *{margin:0;box-sizing:border-box}
  #tile{width:480px;background:${p.bg};font-family:'Noto Sans KR',sans-serif}
  .slide{height:270px;padding:30px 32px;display:flex;flex-direction:column;justify-content:center;gap:12px;position:relative;overflow:hidden;background:${p.bg}}
  .label{font-family:'${latin}','Noto Sans KR',sans-serif;font-size:12px;font-weight:700;letter-spacing:${labelLs};color:${p.accent};text-transform:uppercase}
  .bar{width:46px;height:5px;border-radius:3px;background:${p.accent}}
  .title{font-family:'${titleFont}','Noto Serif KR','Noto Sans KR',serif;font-size:38px;font-weight:${titleWeight};line-height:1.12;color:${p.ink};letter-spacing:${titleLs}${upper ? ";text-transform:uppercase" : ""}}
  .sub{font-size:15px;color:${p.sub};font-weight:500}
  .bullets{display:flex;flex-direction:column;gap:5px;margin-top:4px}
  .b{font-size:12.5px;color:${p.sub};display:flex;gap:7px;align-items:center}
  .b::before{content:"";width:5px;height:5px;border-radius:${radius > 4 ? "50%" : "1px"};background:${p.accent};flex:none}
  .stat{position:absolute;right:32px;bottom:28px;font-family:'${latin}','Noto Sans KR',sans-serif;font-size:40px;font-weight:800;color:${p.accent};letter-spacing:-0.02em}
  .strip{display:flex;flex-wrap:wrap;gap:4px;padding:12px 16px;background:${p.surface};border-top:1px solid rgba(0,0,0,0.06)}
  .chip{display:flex;align-items:center;gap:4px}
  .sw{width:14px;height:14px;border-radius:4px;border:1px solid rgba(0,0,0,0.12)}
  .hex{font-size:8.5px;color:${p.ink};opacity:.7;font-family:'JetBrains Mono',monospace}
  .foot{display:flex;justify-content:space-between;align-items:center;padding:12px 16px 14px;background:${p.surface}}
  .nm{font-size:15px;font-weight:700;color:${p.ink}}
  .tags{font-size:11px;color:${p.sub}}
</style></head><body>
<div id="tile">
  <div class="slide">
    <span class="label">PRODUCT LAUNCH</span>
    <div class="bar"></div>
    <div class="title">신제품 발표회</div>
    <div class="sub">2026년 봄, 새로운 시작</div>
    <div class="bullets">
      <div class="b">시장 현황 — 빠르게 성장하는 수요</div>
      <div class="b">핵심 기능 — 한눈에 보는 차별점</div>
      <div class="b">기대 효과 — 더 나은 사용자 경험</div>
    </div>
    <div class="stat">+38%</div>
  </div>
  <div class="strip">${chips}</div>
  <div class="foot"><span class="nm">${d.name_ko} · ${d.name_en}</span><span class="tags">${d.tags.slice(0, 3).join(" · ")}</span></div>
</div>
</body></html>`;
}

// Curated Korean names for well-known brands; others fall back to English.
const KO_NAMES = {
  claude: "클로드", figma: "피그마", clickhouse: "클릭하우스", bugatti: "부가티", ferrari: "페라리",
  apple: "애플", airbnb: "에어비앤비", stripe: "스트라이프", notion: "노션", linear: "리니어",
  vercel: "버셀", coinbase: "코인베이스", binance: "바이낸스", bmw: "BMW", dell: "델",
  spotify: "스포티파이", discord: "디스코드", cohere: "코히어", cursor: "커서", expo: "엑스포",
};

function buildEntry(slug, parsed) {
  const desc = parsed.description || "";
  let colors, pal, t, b;
  if (parsed._prose) {
    colors = parsed.colorList;
    pal = paletteFromHints(parsed.roleHints, parsed.colorList);
    t = splitFamily(parsed._proseFonts.title);
    b = splitFamily(parsed._proseFonts.body);
  } else {
    colors = Object.values(parsed.colors).filter((v, i, a) => a.indexOf(v) === i);
    pal = palette(parsed.colors);
    t = splitFamily(parsed._typ["display-xl"] || parsed._typ["display-lg"] ||
      Object.entries(parsed._typ).find(([k]) => k.startsWith("display"))?.[1] ||
      Object.values(parsed._typ)[0]);
    b = splitFamily(parsed._typ["body-md"] ||
      Object.entries(parsed._typ).find(([k]) => k.startsWith("body"))?.[1] || t.ideal);
  }
  if (colors.length === 0) throw new Error("no colors");
  const serif = titleIsSerif(t.ideal, desc);
  const latinWeb = latinGoogle(t.subs[0] || t.ideal);
  const titleWeb = serif ? "Noto Serif KR" : "Noto Sans KR";
  const bodyWeb = "Noto Sans KR";
  const note = `원안 '${t.ideal || "브랜드 전용"}'은 웹폰트가 아니라, 한글은 '${titleWeb}', 라틴은 '${latinWeb}'로 대체`;
  const nameEn = (parsed.name || slug).split(/[-\s]/)[0].replace(/^\w/, (c) => c.toUpperCase());
  return {
    slug,
    name_ko: KO_NAMES[slug] || nameEn,
    name_en: nameEn,
    tags: deriveTags(desc),
    colors,
    palette: pal,
    fonts: { title: t.ideal, body: b.ideal, substitutes: [...new Set([...t.subs, ...b.subs])], titleWeb, bodyWeb, latinWeb, substituted: true, note },
    thumbnail: `/design-thumbnails/${slug}-design-preview.png`,
    signature: (desc.split(". ")[0] || "").slice(0, 140),
  };
}

async function main() {
  await mkdir(thumbDir, { recursive: true });
  let slugs = process.argv.slice(2);
  if (slugs.length === 1 && slugs[0] === "all") {
    slugs = (await readdir(sysDir, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
  }
  const existing = existsSync(designsPath) ? JSON.parse(await readFile(designsPath, "utf8")) : [];
  const byslug = new Map(existing.map((e) => [e.slug, e]));

  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 3 });
  const ok = [], failed = [];
  for (const slug of slugs) {
    const mdPath = join(sysDir, slug, "DESIGN.md");
    try {
      if (!existsSync(mdPath)) throw new Error("DESIGN.md not found");
      const parsed = parseDesignMd(await readFile(mdPath, "utf8"));
      const entry = buildEntry(slug, parsed);
      await page.setContent(tileHtml(entry), { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(250);
      const el = await page.$("#tile");
      await el.screenshot({ path: join(thumbDir, `${slug}-design-preview.png`) });
      byslug.set(slug, entry);
      ok.push(slug);
      console.log(`✓ ${slug} (${entry.colors.length} colors, ${entry.tags.join("·")})`);
    } catch (e) {
      failed.push(`${slug}: ${e.message}`);
      console.log(`✗ ${slug}: ${e.message}`);
    }
  }
  await browser.close();

  const merged = [...byslug.values()].sort((a, b) => a.slug.localeCompare(b.slug));
  await writeFile(designsPath, JSON.stringify(merged, null, 2) + "\n");
  console.log(`\ndesigns.json: ${merged.length} entries. ok=${ok.length} failed=${failed.length}`);
  if (failed.length) console.log("FAILED:\n" + failed.map((f) => "  " + f).join("\n"));
}

await main();
