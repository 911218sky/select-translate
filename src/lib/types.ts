export type Appearance = "light" | "dark" | "system" | "chrome";
export type TriggerMode = "auto" | "button";
export type UiLocale = "zh-TW" | "en";
export type Translator = "google" | "llm";
export type LlmProvider = "openai" | "claude" | "gemini";
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
  translator: Translator;
  llmProvider: LlmProvider;
  llmEndpoint: string;
  llmModel: string;
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
  provider: "google" | "mymemory" | "openai" | "claude" | "gemini";
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
  /** Client request id used to cancel superseded in-flight translates. */
  requestId?: number;
}

export interface SpeakMessage {
  type: "SPEAK";
  text: string;
  lang?: string;
}

export interface OffscreenSpeakMessage {
  type: "OFFSCREEN_SPEAK";
  /** Prefer fetching via GET_TTS_AUDIO — offscreen cannot use chrome.storage. */
  audio?: string;
  /** When true, offscreen should request audio from the service worker. */
  hasAudio?: boolean;
  /** Correlates GET_TTS_AUDIO with the in-flight SPEAK that registered the payload. */
  audioId?: string;
  text?: string;
  lang?: string;
}

export interface OffscreenPingMessage {
  type: "OFFSCREEN_PING";
}

export interface GetTtsAudioMessage {
  type: "GET_TTS_AUDIO";
  audioId?: string;
}

export interface TranslateSelectionMessage {
  type: "TRANSLATE_SELECTION";
  text?: string;
}

export interface GetSecretsMessage {
  type: "GET_SECRETS";
}

export interface SaveSecretsMessage {
  type: "SAVE_SECRETS";
  /** Required when saving; omit is rejected so keys are not cleared by accident. */
  llmApiKey: string;
}

export interface ListLlmModelsMessage {
  type: "LIST_LLM_MODELS";
}

export interface TestLlmMessage {
  type: "TEST_LLM";
}

export interface Secrets {
  llmApiKey: string;
}

export type ExtensionMessage =
  | TranslateMessage
  | SpeakMessage
  | OffscreenSpeakMessage
  | OffscreenPingMessage
  | GetTtsAudioMessage
  | TranslateSelectionMessage
  | GetSecretsMessage
  | SaveSecretsMessage
  | ListLlmModelsMessage
  | TestLlmMessage
  | { type: "GET_SETTINGS" }
  | { type: "OPEN_OPTIONS" }
  | { type: "PING" }
  | { type: "GET_CHROME_THEME" };

export interface OkResponse<T = unknown> {
  ok: true;
  result?: T;
  settings?: Settings;
  secrets?: Secrets;
  theme?: ChromeThemeLike | null;
  tabId?: number | null;
  models?: string[];
  audio?: string;
}

export interface ErrorResponse {
  ok: false;
  error: string;
}

export type MessageResponse<T = unknown> = OkResponse<T> | ErrorResponse;

declare global {
  interface Window {
    /** Extension version stamp — avoids blocking reinjection after updates. */
    __SELECT_TRANSLATE_LOADED__?: string;
    /** Tear down listeners/DOM from a previous boot (upgrade path). */
    __SELECT_TRANSLATE_CLEANUP__?: () => void;
  }
}
