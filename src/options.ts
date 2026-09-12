import type { Appearance, Settings } from "./types.ts";
import { ACCENT_PRESETS, DEFAULTS, languageOptionsHtml, normalizeHex, toStorage } from "./shared.ts";
import { applyDomI18n, t } from "./i18n.ts";
import { apply as applyTheme, watch } from "./theme.ts";

const sourceLang = must(document.getElementById("sourceLang") as HTMLSelectElement | null);
const targetLang = must(document.getElementById("targetLang") as HTMLSelectElement | null);
const trigger = must(document.getElementById("trigger") as HTMLSelectElement | null);
const skipInputs = must(document.getElementById("skipInputs") as HTMLInputElement | null);
const enableTts = must(document.getElementById("enableTts") as HTMLInputElement | null);
const maxChars = must(document.getElementById("maxChars") as HTMLInputElement | null);
const uiLocale = must(document.getElementById("uiLocale") as HTMLSelectElement | null);
const swatches = must(document.getElementById("swatches"));
const toast = must(document.getElementById("toast"));
const accentSetting = must(document.getElementById("accentSetting"));

let settings: Settings = { ...DEFAULTS };
let toastTimer = 0;

swatches.innerHTML = `
  ${ACCENT_PRESETS.map(
    (color) =>
      `<button type="button" class="swatch" data-color="${color}" style="--swatch:${color}" aria-label="${color}"></button>`
  ).join("")}
  <label class="swatch custom" title="${t("customColor")}">
    <input id="accentColor" type="color" aria-label="${t("customColor")}" />
  </label>
`;
const accentColor = must(document.getElementById("accentColor") as HTMLInputElement | null);

void chrome.storage.sync.get(toStorage(DEFAULTS)).then((stored) => {
  settings = { ...DEFAULTS, ...(stored as unknown as Partial<Settings>) };
  paint();
  watch();
});

document.querySelectorAll<HTMLButtonElement>(".seg").forEach((button) => {
  button.addEventListener("click", () => {
    void save({ appearance: button.dataset.appearance as Appearance });
  });
});
swatches.querySelectorAll<HTMLButtonElement>(".swatch[data-color]").forEach((button) => {
  button.addEventListener("click", () => {
    const color = button.dataset.color;
    if (color) void save({ accentColor: color });
  });
});
accentColor.addEventListener("input", () => {
  void save({ accentColor: accentColor.value });
});
targetLang.addEventListener("change", () => void save({ targetLang: targetLang.value }));
sourceLang.addEventListener("change", () => void save({ sourceLang: sourceLang.value }));
trigger.addEventListener("change", () => void save({ trigger: trigger.value as Settings["trigger"] }));
uiLocale.addEventListener("change", () => void save({ uiLocale: uiLocale.value as Settings["uiLocale"] }));
skipInputs.addEventListener("change", () => void save({ skipInputs: skipInputs.checked }));
enableTts.addEventListener("change", () => void save({ enableTts: enableTts.checked }));
maxChars.addEventListener("change", () => {
  void save({ maxChars: Number(maxChars.value) || 5000 });
});

async function save(patch: Partial<Settings>): Promise<void> {
  settings = { ...settings, ...patch };
  paint();
  await chrome.storage.sync.set(toStorage(patch));
  await applyTheme();
  showToast();
}

function paint(): void {
  applyDomI18n(document, settings);
  document.documentElement.lang = settings.uiLocale === "en" ? "en" : "zh-Hant";
  document.title = t("optionsTitle", settings);
  toast.textContent = t("saved", settings);
  sourceLang.innerHTML = languageOptionsHtml(true, settings.uiLocale);
  targetLang.innerHTML = languageOptionsHtml(false, settings.uiLocale);
  trigger.options[0].textContent = t("triggerAuto", settings);
  trigger.options[1].textContent = t("triggerButton", settings);
  uiLocale.options[0].textContent = t("uiLanguageAuto", settings);
  uiLocale.options[1].textContent = t("uiLanguageZh", settings);
  uiLocale.options[2].textContent = t("uiLanguageEn", settings);
  targetLang.value = settings.targetLang;
  sourceLang.value = settings.sourceLang;
  trigger.value = settings.trigger;
  uiLocale.value = settings.uiLocale;
  skipInputs.checked = Boolean(settings.skipInputs);
  enableTts.checked = Boolean(settings.enableTts);
  maxChars.value = String(settings.maxChars);
  accentColor.value = normalizeHex(settings.accentColor) || DEFAULTS.accentColor;
  document.querySelectorAll<HTMLButtonElement>(".seg").forEach((button) => {
    button.classList.toggle("active", button.dataset.appearance === settings.appearance);
  });
  document.querySelectorAll<HTMLButtonElement>(".swatch[data-color]").forEach((button) => {
    button.classList.toggle(
      "active",
      normalizeHex(button.dataset.color) === normalizeHex(settings.accentColor)
    );
  });
  accentSetting.classList.toggle("dim", settings.appearance === "chrome");
}

function showToast(): void {
  toast.hidden = false;
  toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("show");
    toast.hidden = true;
  }, 1400);
}

function must<T>(value: T | null): T {
  if (!value) throw new Error("Missing options element");
  return value;
}
