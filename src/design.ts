/**
 * Design system for the PPT module — the canonical source is getdesign.md;
 * this file mirrors it as typed data the app uses.
 *
 * Each preset pairs a color palette with a heading/body font. Fonts are chosen
 * to be loadable as Google web fonts (and to cover Korean glyphs). When a
 * preset's "ideal" font can't be used on the web, `substituted` is true and
 * `note` explains the closest web substitute shown to the user.
 *
 * `recommendThemes()` is a keyword/mood matcher today. It's deliberately a pure
 * function with a simple input shape so an LLM-based analyzer (once an API key
 * is configured) can replace or augment it without touching callers.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface DesignFont {
  /** The intended font (may be a print/system font). */
  ideal: string;
  /** The Google web font family actually loaded in the browser. */
  webFont: string;
  weights: number[];
  /** True when webFont is a substitute for `ideal`. */
  substituted: boolean;
  note?: string;
}

export interface DesignPalette {
  bg: string;
  surface: string;
  ink: string;
  sub: string;
  accent: string;
  accent2?: string;
}

export interface DesignPreset {
  id: string;
  name: string;
  moods: string[];
  palette: DesignPalette;
  heading: DesignFont;
  body: DesignFont;
}

export const PRESETS: DesignPreset[] = [
  {
    id: "trust",
    name: "신뢰 비즈니스",
    moods: ["비즈니스", "신뢰", "기업", "발표", "보고", "데이터", "전문", "깔끔"],
    palette: { bg: "#FFFFFF", surface: "#EEF3F9", ink: "#16203A", sub: "#5B6B82", accent: "#2F6DB5" },
    heading: { ideal: "Noto Sans KR", webFont: "Noto Sans KR", weights: [700], substituted: false },
    body: { ideal: "Noto Sans KR", webFont: "Noto Sans KR", weights: [400], substituted: false },
  },
  {
    id: "warm",
    name: "따뜻 감성",
    moods: ["따뜻", "감성", "교육", "스토리", "강연", "친근", "에세이", "인문"],
    palette: { bg: "#FBF7EF", surface: "#F3EAD9", ink: "#3A3027", sub: "#7A6E5F", accent: "#C2613A", accent2: "#7BA05B" },
    heading: { ideal: "Gowun Batang", webFont: "Gowun Batang", weights: [700], substituted: false },
    body: { ideal: "Gowun Dodum", webFont: "Gowun Dodum", weights: [400], substituted: false },
  },
  {
    id: "minimal",
    name: "미니멀 모던",
    moods: ["미니멀", "모던", "심플", "스타트업", "제품", "테크", "깔끔", "트렌디"],
    palette: { bg: "#FFFFFF", surface: "#F4F5F6", ink: "#111418", sub: "#6B7178", accent: "#E2543B" },
    heading: { ideal: "IBM Plex Sans KR", webFont: "IBM Plex Sans KR", weights: [600], substituted: false },
    body: { ideal: "IBM Plex Sans KR", webFont: "IBM Plex Sans KR", weights: [400], substituted: false },
  },
  {
    id: "playful",
    name: "발랄 친근",
    moods: ["발랄", "친근", "캐주얼", "이벤트", "어린이", "동아리", "밝은", "재미"],
    palette: { bg: "#FFFDF6", surface: "#FFF1D6", ink: "#2A2722", sub: "#6B675E", accent: "#F2A65A", accent2: "#6CAE75" },
    heading: { ideal: "Jua", webFont: "Jua", weights: [400], substituted: false },
    body: { ideal: "Noto Sans KR", webFont: "Noto Sans KR", weights: [400], substituted: false },
  },
  {
    id: "classic",
    name: "클래식 격식",
    moods: ["클래식", "격식", "전통", "학술", "역사", "우아", "인문", "논문"],
    palette: { bg: "#FBFAF6", surface: "#F0ECE0", ink: "#20211C", sub: "#5E5C50", accent: "#7A5C2E" },
    heading: {
      ideal: "인쇄용 명조 (바탕)",
      webFont: "Nanum Myeongjo",
      weights: [800],
      substituted: true,
      note: "인쇄용 명조체를 가장 가까운 웹폰트 'Nanum Myeongjo'로 대체",
    },
    body: { ideal: "Nanum Myeongjo", webFont: "Nanum Myeongjo", weights: [400], substituted: false },
  },
  {
    id: "impact",
    name: "강렬 임팩트",
    moods: ["강렬", "임팩트", "마케팅", "런칭", "키노트", "스포츠", "굵은", "주목"],
    palette: { bg: "#14161A", surface: "#20242B", ink: "#FFFFFF", sub: "#AEB6C2", accent: "#FF5A36" },
    heading: { ideal: "Black Han Sans", webFont: "Black Han Sans", weights: [400], substituted: false },
    body: { ideal: "Noto Sans KR", webFont: "Noto Sans KR", weights: [500], substituted: false },
  },
];

// Maps a preset mood keyword to extra terms that should also count as a match.
const SYNONYMS: Record<string, string[]> = {
  비즈니스: ["business", "회사", "ir", "실적", "제안", "영업", "컨설팅"],
  신뢰: ["안정", "공식", "정중"],
  데이터: ["통계", "분석", "지표", "리포트"],
  따뜻: ["따듯", "포근", "다정"],
  교육: ["수업", "학교", "강의", "학생", "온보딩"],
  스토리: ["이야기", "서사", "내러티브"],
  미니멀: ["minimal", "절제", "여백"],
  모던: ["modern", "세련"],
  테크: ["tech", "it", "개발", "ai", "소프트웨어"],
  스타트업: ["startup", "창업", "피칭", "투자"],
  발랄: ["귀여운", "유쾌", "활기"],
  어린이: ["키즈", "유아", "초등"],
  이벤트: ["행사", "축제", "파티"],
  클래식: ["classic", "고전"],
  격식: ["포멀", "정장", "엄숙"],
  학술: ["논문", "연구", "세미나", "학회"],
  역사: ["전통", "문화재"],
  강렬: ["강력", "임팩트", "파워풀"],
  마케팅: ["광고", "브랜딩", "프로모션", "세일즈"],
  런칭: ["출시", "런치", "launch", "키노트"],
};

export interface DesignRecommendation {
  preset: DesignPreset;
  score: number;
  reason: string;
}

export interface RecommendInput {
  topic?: string;
  purpose?: string;
  audience?: string;
  mood?: string;
}

/**
 * Keyword/mood-based theme recommendation. Pure and side-effect free so it can be
 * swapped for an LLM analyzer later (same input/output shape).
 */
export function recommendThemes(input: RecommendInput, limit = 3): DesignRecommendation[] {
  const hay = [input.topic, input.purpose, input.audience, input.mood]
    .filter((v): v is string => typeof v === "string" && v.trim() !== "")
    .join(" ")
    .toLowerCase();

  const scored = PRESETS.map((preset) => {
    const matched: string[] = [];
    for (const mood of preset.moods) {
      const terms = [mood, ...(SYNONYMS[mood] ?? [])];
      if (terms.some((t) => hay.includes(t.toLowerCase()))) matched.push(mood);
    }
    return { preset, score: matched.length, matched };
  });

  // Stable sort keeps PRESETS order for ties (and for the all-zero fallback).
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((s) => ({
    preset: s.preset,
    score: s.score,
    reason: s.score > 0 ? `‘${s.matched.slice(0, 2).join("·")}’ 분위기에 잘 어울려요` : "기본 추천",
  }));
}

export function getPreset(id: string): DesignPreset | undefined {
  return PRESETS.find((p) => p.id === id);
}

/* ---------- designs.json (generated from design-systems/) ---------- */
export interface DesignEntry {
  slug: string;
  name_ko: string;
  name_en: string;
  tags: string[];
  colors: string[];
  palette: DesignPalette;
  fonts: {
    title: string;
    body: string;
    substitutes: string[];
    titleWeb: string;
    bodyWeb: string;
    latinWeb: string;
    substituted: boolean;
    note?: string;
  };
  thumbnail: string;
  signature: string;
}

let designsCache: DesignEntry[] | null = null;
export function loadDesigns(): DesignEntry[] {
  if (designsCache) return designsCache;
  try {
    const p = join(dirname(fileURLToPath(import.meta.url)), "..", "designs.json");
    designsCache = existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as DesignEntry[]) : [];
  } catch {
    designsCache = [];
  }
  return designsCache;
}

// Map a design entry to the "preset" shape the frontend/recommender already use,
// plus the extra thumbnail/tags fields.
export function designToTheme(d: DesignEntry): DesignPreset & {
  thumbnail: string;
  tags: string[];
  name_en: string;
  signature: string;
} {
  return {
    id: d.slug,
    name: d.name_ko || d.name_en,
    name_en: d.name_en,
    moods: d.tags,
    tags: d.tags,
    palette: d.palette,
    heading: {
      ideal: d.fonts.title,
      webFont: d.fonts.titleWeb,
      weights: [700],
      substituted: d.fonts.substituted,
      note: d.fonts.note,
    },
    body: { ideal: d.fonts.body, webFont: d.fonts.bodyWeb, weights: [400], substituted: false },
    thumbnail: d.thumbnail,
    signature: d.signature,
  };
}

/**
 * Recommend from designs.json (tag-based). Returns the same {preset, score,
 * reason} shape as recommendThemes so callers/frontend are unchanged. Returns
 * null when no designs are available (caller falls back to PRESETS).
 */
export function recommendFromDesigns(input: RecommendInput, limit = 3): DesignRecommendation[] | null {
  const designs = loadDesigns();
  if (designs.length === 0) return null;
  const hay = [input.topic, input.purpose, input.audience, input.mood]
    .filter((v): v is string => typeof v === "string" && v.trim() !== "")
    .join(" ")
    .toLowerCase();

  const scored = designs.map((d) => {
    const matched = d.tags.filter((t) => hay.includes(t.toLowerCase()));
    return { d, score: matched.length, matched };
  });
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((s) => ({
    preset: designToTheme(s.d),
    score: s.score,
    reason: s.score > 0 ? `‘${s.matched.slice(0, 2).join("·")}’ 분위기에 잘 어울려요` : "추천 디자인",
  }));
}

export function listThemes(): (DesignPreset | (DesignPreset & { thumbnail: string }))[] {
  const designs = loadDesigns();
  return designs.length > 0 ? designs.map(designToTheme) : PRESETS;
}
