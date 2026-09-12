import type { Settings, UiLocale } from "./types.ts";

/** Keys used by the content-script bubble only (keeps the page bundle small). */
export type ContentMessageKey =
  | "bubbleSourceLang"
  | "bubbleTargetLang"
  | "bubbleSwap"
  | "bubbleClose"
  | "bubbleTranslating"
  | "bubbleSpeakSource"
  | "bubbleSpeakTarget"
  | "bubbleOptions"
  | "bubbleMore"
  | "popupFailed"
  | "errorMissing"
  | "errorTimeout"
  | "errorSpeak";

type ContentCatalog = Record<ContentMessageKey, string>;

const ZH: ContentCatalog = {
  bubbleSourceLang: "來源語言",
  bubbleTargetLang: "目標語言",
  bubbleSwap: "交換語言",
  bubbleClose: "關閉",
  bubbleTranslating: "翻譯中…",
  bubbleSpeakSource: "朗讀原文",
  bubbleSpeakTarget: "朗讀譯文",
  bubbleOptions: "擴充功能選項",
  bubbleMore: "更多 »",
  popupFailed: "翻譯失敗",
  errorMissing: "找不到譯文",
  errorTimeout: "翻譯逾時，請再試一次",
  errorSpeak: "無法朗讀，請稍後再試"
};

const EN: ContentCatalog = {
  bubbleSourceLang: "Source language",
  bubbleTargetLang: "Target language",
  bubbleSwap: "Swap languages",
  bubbleClose: "Close",
  bubbleTranslating: "Translating…",
  bubbleSpeakSource: "Speak original",
  bubbleSpeakTarget: "Speak translation",
  bubbleOptions: "EXTENSION OPTIONS",
  bubbleMore: "MORE »",
  popupFailed: "Translation failed",
  errorMissing: "No translation found",
  errorTimeout: "Translation timed out. Please try again.",
  errorSpeak: "Could not play speech. Please try again."
};

const CATALOGS: Record<"zh-TW" | "en", ContentCatalog> = {
  "zh-TW": ZH,
  en: EN
};

function resolveLocale(settings?: Pick<Settings, "uiLocale"> | UiLocale | string): "zh-TW" | "en" {
  const value = typeof settings === "string" ? settings : settings?.uiLocale;
  return value === "zh-TW" ? "zh-TW" : "en";
}

export function t(
  key: ContentMessageKey,
  settings?: Pick<Settings, "uiLocale"> | UiLocale | string
): string {
  const locale = resolveLocale(settings);
  return CATALOGS[locale][key] || CATALOGS.en[key] || key;
}
