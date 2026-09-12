import type { Settings, UiLocale } from "./types.ts";

export type MessageKey =
  | "extName"
  | "extTagline"
  | "optionsTitle"
  | "optionsHeading"
  | "appearance"
  | "appearanceDesc"
  | "theme"
  | "themeDesc"
  | "themeLight"
  | "themeDark"
  | "themeSystem"
  | "themeChrome"
  | "accent"
  | "accentDesc"
  | "customColor"
  | "uiLanguage"
  | "uiLanguageDesc"
  | "uiLanguageZh"
  | "uiLanguageEn"
  | "provider"
  | "providerDesc"
  | "providerGoogle"
  | "providerLlm"
  | "llmProvider"
  | "llmProviderDesc"
  | "llmEndpoint"
  | "llmEndpointDesc"
  | "llmModel"
  | "llmModelDesc"
  | "llmApiKey"
  | "llmApiKeyDesc"
  | "llmApiKeyPlaceholder"
  | "errorLlmConfig"
  | "errorLlmHttp"
  | "errorLlmEmpty"
  | "errorLlmPermission"
  | "translation"
  | "targetLang"
  | "targetLangDesc"
  | "sourceLang"
  | "sourceLangDesc"
  | "trigger"
  | "triggerDesc"
  | "triggerAuto"
  | "triggerButton"
  | "skipInputs"
  | "skipInputsDesc"
  | "enableTts"
  | "enableTtsDesc"
  | "maxChars"
  | "maxCharsDesc"
  | "howto"
  | "howto1"
  | "howto2"
  | "howto3"
  | "howto4"
  | "saved"
  | "popupSource"
  | "popupSourcePlaceholder"
  | "popupFrom"
  | "popupTo"
  | "popupSwap"
  | "popupTranslate"
  | "popupSpeak"
  | "popupOpenOptions"
  | "popupNeedText"
  | "popupFailed"
  | "bubbleTranslate"
  | "bubbleSourceLang"
  | "bubbleTargetLang"
  | "bubbleSwap"
  | "bubbleClose"
  | "bubbleTranslating"
  | "bubbleSpeakSource"
  | "bubbleSpeakTarget"
  | "bubbleOptions"
  | "bubbleMore"
  | "contextMenu"
  | "errorEmpty"
  | "errorGoogle"
  | "errorBackup"
  | "errorMissing"
  | "errorUnknown"
  | "warningFallback";

type Catalog = Record<MessageKey, string>;

const ZH: Catalog = {
  extName: "選字翻譯",
  extTagline: "選取網頁文字，或在這裡直接翻譯。",
  optionsTitle: "選字翻譯設定",
  optionsHeading: "設定",
  appearance: "外觀",
  appearanceDesc: "設定頁、工具列彈窗和翻譯氣泡都會跟著這些設定。",
  theme: "主題",
  themeDesc: "淺色、深色，跟隨系統，或跟隨 Chrome 目前的主題顏色。",
  themeLight: "淺色",
  themeDark: "深色",
  themeSystem: "系統",
  themeChrome: "Chrome",
  accent: "強調色",
  accentDesc: "按鈕、選取狀態和氣泡重點會使用這個顏色。選 Chrome 主題時，會優先用瀏覽器主題色。",
  customColor: "自訂顏色",
  uiLanguage: "介面語言",
  uiLanguageDesc: "設定頁、彈窗和氣泡只支援英文與繁體中文。預設為英文。",
  uiLanguageZh: "繁體中文",
  uiLanguageEn: "English",
  provider: "翻譯來源",
  providerDesc: "預設用 Google 翻譯。也可改成自己的 OpenAI、Claude 或 Gemini 相容節點。",
  providerGoogle: "Google 翻譯",
  providerLlm: "自訂 LLM",
  llmProvider: "API 格式",
  llmProviderDesc: "依節點實際支援的協定選擇。多數轉發服務可用 OpenAI。",
  llmEndpoint: "API 節點",
  llmEndpointDesc: "完整請求網址。留空則使用該格式的預設官方位址。",
  llmModel: "模型",
  llmModelDesc: "節點上的模型名稱。",
  llmApiKey: "API 金鑰",
  llmApiKeyDesc: "只存在這台電腦，不會同步到 Chrome 帳號。",
  llmApiKeyPlaceholder: "選填，依節點需求",
  errorLlmConfig: "請先在設定裡填寫 LLM 節點與金鑰",
  errorLlmHttp: "LLM 節點回應失敗（$STATUS$）",
  errorLlmEmpty: "LLM 沒有回傳譯文",
  errorLlmPermission: "沒有權限連到這個 LLM 節點",
  translation: "翻譯",
  targetLang: "目標語言",
  targetLangDesc: "選取文字後預設翻成這個語言。",
  sourceLang: "來源語言",
  sourceLangDesc: "通常保持自動偵測即可。",
  trigger: "觸發方式",
  triggerDesc: "選取後直接翻譯，或先顯示翻譯按鈕。",
  triggerAuto: "選取後直接顯示譯文",
  triggerButton: "選取後顯示翻譯按鈕",
  skipInputs: "略過輸入框",
  skipInputsDesc: "在搜尋欄、表單或文字框裡反白時不跳出翻譯。",
  enableTts: "啟用朗讀",
  enableTtsDesc: "在氣泡裡點喇叭，用 Google 翻譯的語音朗讀。",
  maxChars: "單次最多字數",
  maxCharsDesc: "超過這個長度會截斷後再翻譯。",
  howto: "使用方式",
  howto1: "在網頁反白文字，翻譯氣泡會自動出現。來源語言和目標語言相同，或譯文與原文相同時不會跳出。",
  howto2: "可在氣泡裡改來源／目標語言，或點喇叭朗讀。",
  howto3: "也可以反白後按滑鼠右鍵，或用 Alt+T。",
  howto4: "工具列圖示可直接貼上文字翻譯。",
  saved: "已儲存",
  popupSource: "原文",
  popupSourcePlaceholder: "貼上或輸入要翻譯的文字",
  popupFrom: "來源",
  popupTo: "目標",
  popupSwap: "交換語言",
  popupTranslate: "翻譯",
  popupSpeak: "朗讀譯文",
  popupOpenOptions: "開啟設定",
  popupNeedText: "請先輸入文字",
  popupFailed: "翻譯失敗",
  bubbleTranslate: "翻譯選取文字",
  bubbleSourceLang: "來源語言",
  bubbleTargetLang: "目標語言",
  bubbleSwap: "交換語言",
  bubbleClose: "關閉",
  bubbleTranslating: "翻譯中…",
  bubbleSpeakSource: "朗讀原文",
  bubbleSpeakTarget: "朗讀譯文",
  bubbleOptions: "EXTENSION OPTIONS",
  bubbleMore: "MORE »",
  contextMenu: "翻譯「%s」",
  errorEmpty: "沒有可翻譯的文字",
  errorGoogle: "Google 翻譯暫時無法使用（$STATUS$）",
  errorBackup: "備用翻譯來源也失敗了",
  errorMissing: "找不到譯文",
  errorUnknown: "未知的訊息類型",
  warningFallback: "已改用備用翻譯來源"
};

const EN: Catalog = {
  extName: "Select Translate",
  extTagline: "Select text on a page, or translate it here.",
  optionsTitle: "Select Translate settings",
  optionsHeading: "Settings",
  appearance: "Appearance",
  appearanceDesc: "These settings apply to the options page, toolbar popup, and translation bubble.",
  theme: "Theme",
  themeDesc: "Light, dark, follow your system, or follow the current Chrome theme colors.",
  themeLight: "Light",
  themeDark: "Dark",
  themeSystem: "System",
  themeChrome: "Chrome",
  accent: "Accent color",
  accentDesc: "Buttons and highlights use this color. Chrome theme mode prefers the browser theme color.",
  customColor: "Custom color",
  uiLanguage: "Interface language",
  uiLanguageDesc: "Settings, popup, and bubble text. English and Traditional Chinese only. English is the default.",
  uiLanguageZh: "Traditional Chinese",
  uiLanguageEn: "English",
  provider: "Translator",
  providerDesc: "Use Google Translate by default, or your own OpenAI, Claude, or Gemini-compatible endpoint.",
  providerGoogle: "Google Translate",
  providerLlm: "Custom LLM",
  llmProvider: "API format",
  llmProviderDesc: "Choose the protocol your node speaks. Most proxies use OpenAI.",
  llmEndpoint: "API endpoint",
  llmEndpointDesc: "Full request URL. Leave blank to use the official default for this format.",
  llmModel: "Model",
  llmModelDesc: "Model name on the node.",
  llmApiKey: "API key",
  llmApiKeyDesc: "Stored on this computer only. It is not synced with your Chrome account.",
  llmApiKeyPlaceholder: "Optional, if the node requires one",
  errorLlmConfig: "Add an LLM endpoint and key in settings first",
  errorLlmHttp: "The LLM endpoint failed ($STATUS$)",
  errorLlmEmpty: "The LLM returned no translation",
  errorLlmPermission: "This extension cannot reach that LLM endpoint",
  translation: "Translation",
  targetLang: "Target language",
  targetLangDesc: "Selected text is translated into this language by default.",
  sourceLang: "Source language",
  sourceLangDesc: "Keep automatic detection unless you need a fixed source.",
  trigger: "Trigger",
  triggerDesc: "Translate as soon as you select text, or show a button first.",
  triggerAuto: "Show translation after selecting",
  triggerButton: "Show a translate button first",
  skipInputs: "Ignore text fields",
  skipInputsDesc: "Do not translate selections inside search boxes, forms, or editors.",
  enableTts: "Enable speech",
  enableTtsDesc: "Speaker buttons play Google Translate’s voice.",
  maxChars: "Character limit",
  maxCharsDesc: "Longer selections are trimmed before translating.",
  howto: "How to use",
  howto1: "Select text on a page. The bubble appears automatically, unless the source already matches the target language.",
  howto2: "Change languages in the bubble, or tap a speaker to listen.",
  howto3: "You can also right-click the selection or press Alt+T.",
  howto4: "Use the toolbar icon to paste text and translate it.",
  saved: "Saved",
  popupSource: "Original",
  popupSourcePlaceholder: "Paste or type text to translate",
  popupFrom: "From",
  popupTo: "To",
  popupSwap: "Swap languages",
  popupTranslate: "Translate",
  popupSpeak: "Speak translation",
  popupOpenOptions: "Open settings",
  popupNeedText: "Enter some text first",
  popupFailed: "Translation failed",
  bubbleTranslate: "Translate selection",
  bubbleSourceLang: "Source language",
  bubbleTargetLang: "Target language",
  bubbleSwap: "Swap languages",
  bubbleClose: "Close",
  bubbleTranslating: "Translating…",
  bubbleSpeakSource: "Speak original",
  bubbleSpeakTarget: "Speak translation",
  bubbleOptions: "EXTENSION OPTIONS",
  bubbleMore: "MORE »",
  contextMenu: "Translate “%s”",
  errorEmpty: "Nothing to translate",
  errorGoogle: "Google Translate is unavailable ($STATUS$)",
  errorBackup: "The fallback translator also failed",
  errorMissing: "No translation found",
  errorUnknown: "Unknown message type",
  warningFallback: "Using the fallback translator"
};

const CATALOGS: Record<"zh-TW" | "en", Catalog> = {
  "zh-TW": ZH,
  en: EN
};

export function resolveUiLocale(settings?: Pick<Settings, "uiLocale"> | UiLocale | string): "zh-TW" | "en" {
  const value = typeof settings === "string" ? settings : settings?.uiLocale;
  return value === "zh-TW" ? "zh-TW" : "en";
}

export function t(
  key: MessageKey,
  settings?: Pick<Settings, "uiLocale"> | UiLocale | string,
  vars?: Record<string, string | number>
): string {
  const locale = resolveUiLocale(settings);
  let text = CATALOGS[locale][key] || CATALOGS.en[key] || key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`$${name}$`, String(value));
    }
  }
  return text;
}

export function applyDomI18n(root: ParentNode, settings?: Pick<Settings, "uiLocale">): void {
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n as MessageKey | undefined;
    if (!key) return;
    el.textContent = t(key, settings);
  });
  root.querySelectorAll<HTMLElement>("[data-i18n-placeholder]").forEach((el) => {
    const key = el.dataset.i18nPlaceholder as MessageKey | undefined;
    if (key) el.setAttribute("placeholder", t(key, settings));
  });
  root.querySelectorAll<HTMLElement>("[data-i18n-title]").forEach((el) => {
    const key = el.dataset.i18nTitle as MessageKey | undefined;
    if (key) el.setAttribute("title", t(key, settings));
  });
  root.querySelectorAll<HTMLElement>("[data-i18n-aria]").forEach((el) => {
    const key = el.dataset.i18nAria as MessageKey | undefined;
    if (key) el.setAttribute("aria-label", t(key, settings));
  });
}
