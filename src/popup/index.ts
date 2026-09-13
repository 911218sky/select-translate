import type { Settings, TranslateResult } from "../lib/types.ts";
import { DEFAULTS, escapeHtml, languageName, languageOptionsHtml, toStorage } from "../lib/shared.ts";
import { applyDomI18n, t } from "../lib/i18n.ts";
import { watch } from "../lib/theme.ts";

const sourceText = must(document.getElementById("sourceText") as HTMLTextAreaElement | null);
const sourceLang = must(document.getElementById("sourceLang") as HTMLSelectElement | null);
const targetLang = must(document.getElementById("targetLang") as HTMLSelectElement | null);
const result = must(document.getElementById("result"));
const errorBox = must(document.getElementById("error"));

let uiLocale = DEFAULTS.uiLocale;
let enableTts = DEFAULTS.enableTts;
let translating = false;

void chrome.storage.sync.get(toStorage(DEFAULTS)).then((stored) => {
  const settings = { ...DEFAULTS, ...(stored as unknown as Partial<Settings>) };
  uiLocale = settings.uiLocale === "zh-TW" ? "zh-TW" : "en";
  enableTts = settings.enableTts !== false;
  applyDomI18n(document, settings);
  document.documentElement.lang = uiLocale === "en" ? "en" : "zh-Hant";
  document.title = t("extName", settings);
  sourceLang.innerHTML = languageOptionsHtml(true, uiLocale);
  targetLang.innerHTML = languageOptionsHtml(false, uiLocale);
  sourceLang.value = settings.sourceLang || "auto";
  targetLang.value = settings.targetLang || "zh-TW";
});
watch();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  if (changes.enableTts) enableTts = changes.enableTts.newValue !== false;
  if (changes.uiLocale) {
    uiLocale = changes.uiLocale.newValue === "zh-TW" ? "zh-TW" : "en";
  }
});

document.getElementById("translate")?.addEventListener("click", () => {
  void translate();
});
document.getElementById("swap")?.addEventListener("click", () => {
  if (sourceLang.value === "auto") return;
  const currentSource = sourceLang.value;
  sourceLang.value = targetLang.value;
  targetLang.value = currentSource;
});
sourceText.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void translate();
});

async function translate(): Promise<void> {
  if (translating) return;
  const text = sourceText.value.trim();
  errorBox.hidden = true;
  result.hidden = true;
  if (!text) {
    showError(t("popupNeedText", uiLocale));
    return;
  }
  const button = document.getElementById("translate") as HTMLButtonElement | null;
  translating = true;
  if (button) button.disabled = true;
  try {
    const response = await chrome.runtime.sendMessage({
      type: "TRANSLATE",
      text,
      sourceLang: sourceLang.value,
      targetLang: targetLang.value
    });
    if (!response?.ok) throw new Error(response?.error || t("popupFailed", uiLocale));
    const data = response.result as TranslateResult;
    result.hidden = false;
    const speakButton = enableTts
      ? `<button class="speak-btn" type="button">${escapeHtml(t("popupSpeak", uiLocale))}</button>`
      : "";
    result.innerHTML = `
      <div class="translated">${escapeHtml(data.translated)}</div>
      <div class="meta">${escapeHtml(languageName(data.sourceLang, uiLocale))} → ${escapeHtml(languageName(data.targetLang, uiLocale))}</div>
      ${speakButton}
    `;
    result.querySelector(".speak-btn")?.addEventListener("click", () => {
      void (async () => {
        try {
          const speakResponse = await chrome.runtime.sendMessage({
            type: "SPEAK",
            text: data.translated,
            lang: data.targetLang
          });
          if (speakResponse && speakResponse.ok === false) {
            throw new Error(speakResponse.error || t("errorSpeak", uiLocale));
          }
        } catch (error) {
          showError(error instanceof Error ? error.message : t("errorSpeak", uiLocale));
        }
      })();
    });
    void chrome.storage.sync.set({
      sourceLang: sourceLang.value,
      targetLang: targetLang.value
    });
  } catch (error) {
    showError(error instanceof Error ? error.message : t("popupFailed", uiLocale));
  } finally {
    translating = false;
    if (button) button.disabled = false;
  }
}

function showError(message: string): void {
  errorBox.hidden = false;
  errorBox.textContent = message;
}

function must<T>(value: T | null): T {
  if (!value) throw new Error("Missing popup element");
  return value;
}
