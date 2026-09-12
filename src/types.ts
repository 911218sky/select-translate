export type Appearance = "light" | "dark" | "system" | "chrome";
export type TriggerMode = "auto" | "button";
export type UiLocale = "auto" | "zh-TW" | "en";
export type ColorScheme = "light" | "dark";
export interface Language {
  code: string;
  name: string;
  native: string;
}

export interface Settings {
  targetLang: string;
  sourceLang: string;
  trigger: TriggerMode;
  enableTts: boolean;
  skipInputs: boolean;
  maxChars: number;
  appearance: Appearance;
  accentColor: string;
  uiLocale: UiLocale;
}

export interface DictionaryEntry {
  word: string;
  reverse: string[];
  score: number | null;
}

export interface DictionaryItem {
  pos: string;
  terms: string[];
  entries: DictionaryEntry[];
}

export interface DefinitionItem {
  definition: string;
  example: string;
}

export interface DefinitionGroup {
  pos: string;
  items: DefinitionItem[];
}

export interface TranslateResult {
  original: string;
  translated: string;
  sourceLang: string;
  targetLang: string;
  dictionary: DictionaryItem[];
  definitions: DefinitionGroup[];
  examples: string[];
  alternatives: string[];
  provider: "google" | "mymemory";
  warning?: string;
}

export interface ThemeTokens {
  scheme: ColorScheme;
  bg: string;
  surface: string;
  surface2: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
  accentText: string;
  success: string;
  danger: string;
  shadow: string;
}

export interface ChromeThemeColors {
  bg: string;
  surface: string;
  text: string;
  accent: string;
}

export interface ChromeThemeLike {
  colors?: Record<string, number[] | string | undefined>;
}

export interface TranslateMessage {
  type: "TRANSLATE";
  text: string;
  sourceLang?: string;
  targetLang?: string;
}

export interface SpeakMessage {
  type: "SPEAK";
  text: string;
  lang?: string;
}

export interface OffscreenSpeakMessage {
  type: "OFFSCREEN_SPEAK";
  audio?: string;
  text?: string;
  lang?: string;
}

export interface TranslateSelectionMessage {
  type: "TRANSLATE_SELECTION";
  text?: string;
}

export type ExtensionMessage =
  | TranslateMessage
  | SpeakMessage
  | OffscreenSpeakMessage
  | TranslateSelectionMessage
  | { type: "GET_SETTINGS" }
  | { type: "OPEN_OPTIONS" }
  | { type: "PING" }
  | { type: "GET_CHROME_THEME" };

export interface OkResponse<T = unknown> {
  ok: true;
  result?: T;
  settings?: Settings;
  theme?: ChromeThemeLike | null;
  tabId?: number | null;
}

export interface ErrorResponse {
  ok: false;
  error: string;
}

export type MessageResponse<T = unknown> = OkResponse<T> | ErrorResponse;

declare global {
  interface Window {
    __SELECT_TRANSLATE_LOADED__?: boolean;
  }
}
