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
  | "llmFetchModels"
  | "llmTest"
  | "llmBusy"
  | "llmFetchOk"
  | "llmFetchEmpty"
  | "llmTestOk"
  | "llmModelCustom"
  | "errorLlmConfig"
  | "errorLlmHttp"
  | "errorLlmHttpDetail"
  | "errorLlmEmpty"
  | "errorLlmPermission"
  | "errorLlmNetwork"
  | "errorLlmNotJson"
  | "errorLlmEndpoint"
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
  | "errorTimeout"
  | "errorSpeak"
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
  accentDesc: "翻譯氣泡與譯文重點會使用這個顏色。選 Chrome 主題時，會優先用瀏覽器主題色。",
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
  llmEndpointDesc: "可填完整聊天網址，或只填 base（例如 …/v1）。留空則用該格式預設。",
  llmModel: "模型",
  llmModelDesc: "可按「取得模型」從節點拉下拉清單，或手動輸入名稱。",
  llmApiKey: "API 金鑰",
  llmApiKeyDesc: "只存在這台電腦，不會同步到 Chrome 帳號。",
  llmApiKeyPlaceholder: "選填，依節點需求",
  llmFetchModels: "取得模型",
  llmTest: "測試連線",
  llmBusy: "處理中…",
  llmFetchOk: "已載入 $COUNT$ 個模型",
  llmFetchEmpty: "節點沒有回傳可用模型",
  llmTestOk: "連線成功。試譯：「$RESULT$」",
  llmModelCustom: "自訂（下方輸入）",
  errorLlmConfig: "請先在設定裡填寫有效的 LLM 節點（需含 http:// 或 https://）",
  errorLlmHttp: "LLM 節點回應失敗（$STATUS$）",
  errorLlmHttpDetail: "LLM 節點回應失敗（$STATUS$）：$DETAIL$",
  errorLlmEmpty: "LLM 沒有回傳譯文",
  errorLlmPermission: "沒有權限連到這個 LLM 節點",
  errorLlmNetwork: "無法連線到這個 LLM 節點，請確認網址與網路",
  errorLlmNotJson: "節點回傳的不是 JSON，請確認 API 節點網址是否正確",
  errorLlmEndpoint: "API 節點網址無效，請使用完整的 http:// 或 https:// 網址",
  translation: "翻譯",
  targetLang: "目標語言",
  targetLangDesc: "選取文字後預設翻成這個語言。",
  sourceLang: "來源語言",
  sourceLangDesc: "通常保持自動偵測即可。",
  trigger: "觸發方式",
  triggerDesc: "選取後直接翻譯，或改成只用右鍵／快捷鍵。",
  triggerAuto: "選取後直接顯示譯文",
  triggerButton: "僅右鍵或 Alt+T 時翻譯",
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
  bubbleOptions: "擴充功能選項",
  bubbleMore: "更多 »",
  contextMenu: "翻譯「%s」",
  errorEmpty: "沒有可翻譯的文字",
  errorGoogle: "Google 翻譯暫時無法使用（$STATUS$）",
  errorBackup: "備用翻譯來源也失敗了",
  errorMissing: "找不到譯文",
  errorUnknown: "未知的訊息類型",
  errorTimeout: "翻譯逾時，請再試一次",
  errorSpeak: "無法朗讀，請稍後再試",
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
  accentDesc: "Used for the translation bubble and translated text. Chrome theme mode prefers the browser theme color.",
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
  llmEndpointDesc: "Full chat URL or just the base (for example …/v1). Leave blank for the official default.",
  llmModel: "Model",
  llmModelDesc: "Fetch models into a dropdown, or type a name manually.",
  llmApiKey: "API key",
  llmApiKeyDesc: "Stored on this computer only. It is not synced with your Chrome account.",
  llmApiKeyPlaceholder: "Optional, if the node requires one",
  llmFetchModels: "Fetch models",
  llmTest: "Test connection",
  llmBusy: "Working…",
  llmFetchOk: "Loaded $COUNT$ models",
  llmFetchEmpty: "The node returned no models",
  llmTestOk: "Connected. Sample: “$RESULT$”",
  llmModelCustom: "Custom (type below)",
  errorLlmConfig: "Enter a valid LLM endpoint in settings (must include http:// or https://)",
  errorLlmHttp: "The LLM endpoint failed ($STATUS$)",
  errorLlmHttpDetail: "The LLM endpoint failed ($STATUS$): $DETAIL$",
  errorLlmEmpty: "The LLM returned no translation",
  errorLlmPermission: "This extension cannot reach that LLM endpoint",
  errorLlmNetwork: "Could not connect to the LLM endpoint. Check the URL and network.",
  errorLlmNotJson: "The endpoint returned HTML/text instead of JSON. Check the API URL.",
  errorLlmEndpoint: "Invalid API endpoint. Use a full http:// or https:// URL.",
  translation: "Translation",
  targetLang: "Target language",
  targetLangDesc: "Selected text is translated into this language by default.",
  sourceLang: "Source language",
  sourceLangDesc: "Keep automatic detection unless you need a fixed source.",
  trigger: "Trigger",
  triggerDesc: "Translate as soon as you select text, or only via right-click / shortcut.",
  triggerAuto: "Show translation after selecting",
  triggerButton: "Only translate with right-click or Alt+T",
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
  errorTimeout: "Translation timed out. Please try again.",
  errorSpeak: "Could not play speech. Please try again.",
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
