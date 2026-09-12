import type {
  ChromeThemeColors,
  ChromeThemeLike,
  ColorScheme,
  DefinitionGroup,
  DictionaryItem,
  Language,
  Settings,
  ThemeTokens,
  TranslateResult
} from "./types.ts";
import { resolveUiLocale } from "./i18n.ts";

export const LANGUAGES: Language[] = [
  { code: "auto", name: "Detect language", native: "自動偵測" },
  { code: "zh-TW", name: "Chinese (Traditional)", native: "中文（繁體）" },
  { code: "zh-CN", name: "Chinese (Simplified)", native: "中文（簡體）" },
  { code: "en", name: "English", native: "English" },
  { code: "ja", name: "Japanese", native: "日本語" },
  { code: "ko", name: "Korean", native: "한국어" },
  { code: "es", name: "Spanish", native: "Español" },
  { code: "fr", name: "French", native: "Français" },
  { code: "de", name: "German", native: "Deutsch" },
  { code: "it", name: "Italian", native: "Italiano" },
  { code: "pt", name: "Portuguese", native: "Português" },
  { code: "ru", name: "Russian", native: "Русский" },
  { code: "vi", name: "Vietnamese", native: "Tiếng Việt" },
  { code: "th", name: "Thai", native: "ไทย" },
  { code: "id", name: "Indonesian", native: "Bahasa Indonesia" },
  { code: "ms", name: "Malay", native: "Bahasa Melayu" },
  { code: "ar", name: "Arabic", native: "العربية" },
  { code: "hi", name: "Hindi", native: "हिन्दी" },
  { code: "tr", name: "Turkish", native: "Türkçe" },
  { code: "nl", name: "Dutch", native: "Nederlands" },
  { code: "pl", name: "Polish", native: "Polski" },
  { code: "sv", name: "Swedish", native: "Svenska" },
  { code: "uk", name: "Ukrainian", native: "Українська" },
  { code: "cs", name: "Czech", native: "Čeština" },
  { code: "el", name: "Greek", native: "Ελληνικά" },
  { code: "he", name: "Hebrew", native: "עברית" },
  { code: "hu", name: "Hungarian", native: "Magyar" },
  { code: "ro", name: "Romanian", native: "Română" },
  { code: "da", name: "Danish", native: "Dansk" },
  { code: "fi", name: "Finnish", native: "Suomi" },
  { code: "no", name: "Norwegian", native: "Norsk" }
];

export const DEFAULTS: Settings = {
  targetLang: "zh-TW",
  sourceLang: "auto",
  trigger: "auto",
  enableTts: true,
  skipInputs: true,
  maxChars: 5000,
  appearance: "system",
  accentColor: "#1a73e8",
  uiLocale: "en",
  translator: "google",
  llmProvider: "openai",
  llmEndpoint: "",
  llmModel: ""
};

export const LLM_DEFAULTS: Record<
  "openai" | "claude" | "gemini",
  { endpoint: string; model: string }
> = {
  openai: {
    endpoint: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o-mini"
  },
  claude: {
    endpoint: "https://api.anthropic.com/v1/messages",
    model: "claude-3-5-haiku-latest"
  },
  gemini: {
    endpoint: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-2.0-flash"
  }
};

export const ACCENT_PRESETS = [
  "#1a73e8",
  "#0b57d0",
  "#137333",
  "#c5221f",
  "#e37400",
  "#9334e6",
  "#00897b",
  "#d93025"
];

export const THEMES: Record<ColorScheme, ThemeTokens> = {
  light: {
    scheme: "light",
    bg: "#f0f4f9",
    surface: "#ffffff",
    surface2: "#f8fafc",
    text: "#1f1f1f",
    muted: "#5f6368",
    border: "#dbe1ea",
    accent: "#0b57d0",
    accentText: "#ffffff",
    success: "#137333",
    danger: "#b3261e",
    shadow: "0 1px 2px rgba(31,31,31,.06), 0 12px 32px rgba(31,31,31,.08)"
  },
  dark: {
    scheme: "dark",
    bg: "#0f1113",
    surface: "#1a1c1e",
    surface2: "#222529",
    text: "#e3e3e3",
    muted: "#c4c7c5",
    border: "#3c4043",
    accent: "#a8c7fa",
    accentText: "#062e6f",
    success: "#81c995",
    danger: "#f2b8b5",
    shadow: "0 12px 32px rgba(0,0,0,.42)"
  }
};

export const POS_MAP: Record<string, string> = {
  noun: "noun",
  verb: "verb",
  adjective: "adjective",
  adverb: "adverb",
  preposition: "preposition",
  conjunction: "conjunction",
  pronoun: "pronoun",
  interjection: "interjection",
  particle: "particle",
  determiner: "determiner",
  article: "article",
  numeral: "numeral",
  prefix: "prefix",
  suffix: "suffix",
  abbreviation: "abbreviation",
  phrase: "phrase",
  "auxiliary verb": "auxiliary verb",
  名詞: "noun",
  动词: "verb",
  動詞: "verb",
  形容词: "adjective",
  形容詞: "adjective",
  副词: "adverb",
  副詞: "adverb",
  介词: "preposition",
  介詞: "preposition",
  介系詞: "preposition",
  连词: "conjunction",
  連接詞: "conjunction",
  代词: "pronoun",
  代名詞: "pronoun",
  感叹词: "interjection",
  感嘆詞: "interjection",
  助词: "particle",
  助詞: "particle",
  冠词: "article",
  冠詞: "article",
  数词: "numeral",
  數詞: "numeral",
  缩写: "abbreviation",
  縮寫: "abbreviation",
  短语: "phrase",
  片語: "phrase",
  助动词: "auxiliary verb",
  助動詞: "auxiliary verb"
};

export function normalizePos(pos: unknown): string {
  const raw = String(pos || "").trim();
  if (!raw) return "";
  return POS_MAP[raw] || POS_MAP[raw.toLowerCase()] || raw.toLowerCase();
}

export function languageName(code: string, locale?: string): string {
  const item = LANGUAGES.find((entry) => entry.code === code);
  if (!item) return code || "";
  const resolved = locale ? resolveUiLocale(locale) : resolveUiLocale();
  return resolved.startsWith("zh") ? item.native : item.name;
}

export function languageBanner(code: string): string {
  const item = LANGUAGES.find((entry) => entry.code === code);
  if (!item || item.code === "auto") return "";
  return item.name.toUpperCase();
}

export function normalizeLang(code?: string | null): string {
  if (!code || code === "auto") return "auto";
  const lower = String(code).toLowerCase().replace(/_/g, "-");
  if (lower === "zh-tw" || lower === "zh-hant" || lower === "zh-cht") return "zh-TW";
  if (lower === "zh-cn" || lower === "zh" || lower === "zh-hans" || lower === "zh-chs") {
    return "zh-CN";
  }
  const match = LANGUAGES.find((item) => item.code.toLowerCase() === lower);
  return match ? match.code : lower;
}

export function ttsLang(code?: string | null): string {
  const normalized = normalizeLang(code);
  if (normalized === "zh-TW") return "zh-TW";
  if (normalized === "zh-CN") return "zh-CN";
  return normalized === "auto" ? "en" : normalized;
}

export const GOOGLE_TTS_LIMIT = 180;

/** Truncate by Unicode code points (avoids splitting surrogate pairs). */
export function truncateCodePoints(text: string, max: number): string {
  const value = String(text || "");
  if (max <= 0 || value.length <= max) return value;
  return Array.from(value).slice(0, max).join("");
}

export function googleTtsUrl(text: string, lang?: string | null): string {
  const params = new URLSearchParams({
    ie: "UTF-8",
    q: truncateCodePoints(text, GOOGLE_TTS_LIMIT),
    tl: ttsLang(lang),
    client: "tw-ob"
  });
  return `https://translate.google.com/translate_tts?${params.toString()}`;
}

export function sameLanguage(source: string | undefined, target: string | undefined): boolean {
  const sl = normalizeLang(source);
  const tl = normalizeLang(target);
  if (!tl || tl === "auto") return false;
  if (!sl || sl === "auto") return false;
  return sl.toLowerCase() === tl.toLowerCase();
}

export function compactText(value: unknown): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function isNoOpTranslation(original: unknown, translated: unknown): boolean {
  const source = compactText(original);
  const target = compactText(translated);
  return Boolean(source) && source === target;
}

function countMatches(text: string, pattern: RegExp): number {
  return (text.match(pattern) || []).length;
}

/**
 * Cheap script heuristic so we can skip the bubble before calling translate
 * when source is "auto" and the selection already looks like the target language
 * (e.g. target zh-TW + selected Chinese text).
 */
export function textLooksLikeLanguage(text: string, lang: string | undefined): boolean {
  const tl = normalizeLang(lang);
  if (!tl || tl === "auto") return false;
  const sample = compactText(text);
  if (!sample) return false;

  const han = countMatches(sample, /\p{Script=Han}/gu);
  const hiragana = countMatches(sample, /\p{Script=Hiragana}/gu);
  const katakana = countMatches(sample, /\p{Script=Katakana}/gu);
  const hangul = countMatches(sample, /\p{Script=Hangul}/gu);
  const latin = countMatches(sample, /\p{Script=Latin}/gu);
  const cyrillic = countMatches(sample, /\p{Script=Cyrillic}/gu);
  const arabic = countMatches(sample, /\p{Script=Arabic}/gu);
  const thai = countMatches(sample, /\p{Script=Thai}/gu);
  const total = han + hiragana + katakana + hangul + latin + cyrillic + arabic + thai;
  if (total === 0) return false;
  const share = (n: number) => n / total;
  const cjkOther = hiragana + katakana + hangul;

  if (tl === "zh-TW" || tl === "zh-CN") {
    return share(han) >= 0.5 && share(cjkOther) < 0.12;
  }
  if (tl === "ja") {
    return share(hiragana + katakana) >= 0.12 || (share(han) >= 0.35 && share(hiragana + katakana) >= 0.05);
  }
  if (tl === "ko") return share(hangul) >= 0.45;
  if (tl === "ru" || tl === "uk") return share(cyrillic) >= 0.5;
  if (tl === "ar") return share(arabic) >= 0.5;
  if (tl === "th") return share(thai) >= 0.5;
  if (tl === "he") return countMatches(sample, /\p{Script=Hebrew}/gu) / Math.max(total, 1) >= 0.5;
  // Latin-script targets (en, es, fr, …)
  return share(latin) >= 0.55 && share(han + cjkOther) < 0.2;
}

export function shouldHideTranslation(
  sourceLang: string | undefined,
  targetLang: string | undefined,
  original?: unknown,
  translated?: unknown
): boolean {
  if (sameLanguage(sourceLang, targetLang)) return true;
  if (original !== undefined && translated !== undefined && isNoOpTranslation(original, translated)) {
    return true;
  }
  // Before translate (no translated yet): if source is auto, skip when text already looks like target.
  if (original !== undefined && translated === undefined) {
    const sl = normalizeLang(sourceLang);
    if ((!sl || sl === "auto") && textLooksLikeLanguage(String(original), targetLang)) {
      return true;
    }
  }
  return false;
}

export function stripTags(html: unknown): string {
  return String(html)
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

export function unique(items: Array<string | null | undefined>): string[] {
  return [...new Set((items || []).filter((item): item is string => Boolean(item)))];
}

export function parseGoogleResult(
  data: unknown,
  original: string,
  sl: string,
  tl: string
): TranslateResult {
  const root = Array.isArray(data) ? data : [];
  const sentences = Array.isArray(root[0]) ? root[0] : [];
  const translated = sentences
    .map((item) => (Array.isArray(item) ? item[0] : ""))
    .filter(Boolean)
    .join("");
  const detected = normalizeLang((root[2] as string) || sl);
  const sourceText =
    sentences
      .map((item) => (Array.isArray(item) ? item[1] : ""))
      .filter(Boolean)
      .join("") || original;

  const dictionary: DictionaryItem[] = [];
  if (Array.isArray(root[1])) {
    for (const entry of root[1]) {
      if (!Array.isArray(entry)) continue;
      dictionary.push({
        pos: normalizePos(entry[0]),
        terms: Array.isArray(entry[1]) ? entry[1].filter(Boolean) : [],
        entries: Array.isArray(entry[2])
          ? entry[2].map((item: unknown) => {
              const row = Array.isArray(item) ? item : [];
              return {
                word: String(row[0] || ""),
                reverse: Array.isArray(row[1]) ? row[1].map(String) : [],
                score: typeof row[3] === "number" ? row[3] : null
              };
            })
          : []
      });
    }
  }

  const definitions: DefinitionGroup[] = [];
  if (Array.isArray(root[12])) {
    for (const entry of root[12]) {
      if (!Array.isArray(entry)) continue;
      definitions.push({
        pos: normalizePos(entry[0]),
        items: Array.isArray(entry[1])
          ? entry[1].map((item: unknown) => {
              const row = Array.isArray(item) ? item : [];
              return {
                definition: String(row[0] || ""),
                example: String(row[2] || "")
              };
            })
          : []
      });
    }
  }

  const examples: string[] = [];
  const exampleRoot = Array.isArray(root[13]) ? root[13][0] : null;
  if (Array.isArray(exampleRoot)) {
    for (const item of exampleRoot.slice(0, 3)) {
      const html = Array.isArray(item) ? item[0] : "";
      if (html) examples.push(stripTags(html));
    }
  }

  const alternatives: string[] = [];
  if (Array.isArray(root[5])) {
    for (const chunk of root[5]) {
      const words = Array.isArray(chunk?.[2])
        ? chunk[2].map((item: unknown) => (Array.isArray(item) ? item[0] : "")).filter(Boolean)
        : [];
      if (words.length) alternatives.push(...words.slice(0, 5));
    }
  }

  return {
    original: sourceText,
    // Keep empty when Google returned no sentences — callers must treat as error,
    // not as a no-op hide (translated === original).
    translated,
    sourceLang: detected === "auto" ? sl : detected,
    targetLang: tl,
    dictionary,
    definitions,
    examples,
    alternatives: unique(alternatives).slice(0, 8),
    provider: "google"
  };
}

export function clampChannel(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(255, Math.round(n)));
}

export function rgbToHex(rgb: unknown): string {
  if (!rgb) return "";
  if (typeof rgb === "string") return normalizeHex(rgb);
  if (!Array.isArray(rgb) || rgb.length < 3) return "";
  const hex = rgb
    .slice(0, 3)
    .map((item) => clampChannel(item).toString(16).padStart(2, "0"))
    .join("");
  return `#${hex}`;
}

export function normalizeHex(value: unknown): string {
  const raw = String(value || "").trim();
  const short = raw.match(/^#([0-9a-f]{3})$/i);
  if (short) {
    return `#${short[1]
      .split("")
      .map((ch) => ch + ch)
      .join("")
      .toLowerCase()}`;
  }
  const full = raw.match(/^#([0-9a-f]{6})$/i);
  return full ? `#${full[1].toLowerCase()}` : "";
}

export function hexToRgb(hex: string): [number, number, number] | null {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  return [
    parseInt(normalized.slice(1, 3), 16),
    parseInt(normalized.slice(3, 5), 16),
    parseInt(normalized.slice(5, 7), 16)
  ];
}

export function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 1;
  const linear = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

export function mixHex(a: string, b: string, amount: number): string {
  const left = hexToRgb(a);
  const right = hexToRgb(b);
  if (!left || !right) return normalizeHex(a) || normalizeHex(b);
  const t = Math.max(0, Math.min(1, amount));
  return rgbToHex(left.map((channel, index) => channel + (right[index] - channel) * t));
}

export function contrastText(bg: string): string {
  return luminance(bg) > 0.45 ? "#1f1f1f" : "#ffffff";
}

export function systemScheme(): ColorScheme {
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

export function chromeThemeColors(theme: ChromeThemeLike | null | undefined): ChromeThemeColors {
  const colors = theme?.colors || {};
  return {
    bg: rgbToHex(colors.ntp_background || colors.frame || colors.toolbar),
    surface: rgbToHex(colors.toolbar || colors.ntp_background || colors.frame),
    text: rgbToHex(colors.ntp_text || colors.tab_text || colors.bookmark_text || colors.tab_background_text),
    accent: rgbToHex(colors.button_background || colors.frame || colors.toolbar)
  };
}

export function resolveTheme(settings: Partial<Settings> = {}, chromeTheme: ChromeThemeLike | null = null): ThemeTokens {
  const appearance = settings.appearance || DEFAULTS.appearance;
  const customAccent = normalizeHex(settings.accentColor) || DEFAULTS.accentColor;
  let scheme: ColorScheme | AppearanceLike = appearance;
  if (appearance === "system" || appearance === "chrome") scheme = systemScheme();

  const chromeColors = appearance === "chrome" ? chromeThemeColors(chromeTheme) : emptyChromeColors();
  if (appearance === "chrome" && chromeColors.bg) {
    scheme = luminance(chromeColors.bg) < 0.45 ? "dark" : "light";
  }

  const resolvedScheme: ColorScheme = scheme === "dark" ? "dark" : "light";
  const base: ThemeTokens = { ...THEMES[resolvedScheme] };
  if (chromeColors.bg) base.bg = chromeColors.bg;
  if (chromeColors.surface) base.surface = chromeColors.surface;
  if (chromeColors.text) {
    base.text = chromeColors.text;
    base.muted = mixHex(chromeColors.text, base.bg, 0.35);
  }
  if (appearance === "chrome" && chromeColors.surface) {
    base.surface2 = mixHex(chromeColors.surface, resolvedScheme === "dark" ? "#000000" : "#ffffff", 0.08);
    base.border = mixHex(chromeColors.surface, resolvedScheme === "dark" ? "#ffffff" : "#000000", 0.16);
  }

  const accent = appearance === "chrome" && chromeColors.accent ? chromeColors.accent : customAccent;
  base.accent = accent;
  base.accentText = contrastText(accent);
  base.scheme = resolvedScheme;
  return base;
}

type AppearanceLike = ColorScheme | "system" | "chrome";

function emptyChromeColors(): ChromeThemeColors {
  return { bg: "", surface: "", text: "", accent: "" };
}

export function applyTheme(
  settings: Partial<Settings>,
  chromeTheme: ChromeThemeLike | null,
  root?: HTMLElement | null
): ThemeTokens {
  if (!root || !root.style) return resolveTheme(settings, chromeTheme);
  const tokens = resolveTheme(settings, chromeTheme);
  const map: Record<string, string> = {
    bg: tokens.bg,
    surface: tokens.surface,
    surface2: tokens.surface2,
    text: tokens.text,
    muted: tokens.muted,
    border: tokens.border,
    accent: tokens.accent,
    "accent-text": tokens.accentText,
    success: tokens.success,
    danger: tokens.danger,
    shadow: tokens.shadow
  };
  Object.entries(map).forEach(([key, value]) => {
    root.style.setProperty(`--st-${key}`, value);
  });
  root.style.colorScheme = tokens.scheme;
  if (root.dataset) root.dataset.theme = tokens.scheme;
  if (root === document.documentElement) {
    document.body?.setAttribute("data-theme", tokens.scheme);
  }
  return tokens;
}

export function languageOptionsHtml(includeAuto: boolean, locale?: string): string {
  const items = includeAuto ? LANGUAGES : LANGUAGES.filter((item) => item.code !== "auto");
  return items
    .map((item) => `<option value="${item.code}">${escapeHtml(languageName(item.code, locale))}</option>`)
    .join("");
}

export function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function escapeAttr(value: unknown): string {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

export function googleTranslateUrl(text: string, sl: string, tl: string): string {
  const params = new URLSearchParams({
    sl: sl || "auto",
    tl: tl || "zh-TW",
    text
  });
  return `https://translate.google.com/?${params.toString()}`;
}

export function toStorage(value: Partial<Settings> | Settings): { [key: string]: unknown } {
  return { ...(value as unknown as { [key: string]: unknown }) };
}

export function llmDefaults(provider: Settings["llmProvider"]): { endpoint: string; model: string } {
  return LLM_DEFAULTS[provider] || LLM_DEFAULTS.openai;
}

export function sanitizeHttpUrl(value: string): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

export function originPattern(url: string): string {
  const parsed = new URL(url);
  return `${parsed.origin}/*`;
}
