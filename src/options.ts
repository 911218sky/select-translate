import type { Appearance, LlmProvider, Settings, Translator } from "./types.ts";
import { ACCENT_PRESETS, DEFAULTS, languageOptionsHtml, llmDefaults, normalizeHex, sanitizeHttpUrl, toStorage } from "./shared.ts";
import { applyDomI18n, t } from "./i18n.ts";
import { apply as applyTheme, watch } from "./theme.ts";

const sourceLang = must(document.getElementById("sourceLang") as HTMLSelectElement | null);
const targetLang = must(document.getElementById("targetLang") as HTMLSelectElement | null);
const trigger = must(document.getElementById("trigger") as HTMLSelectElement | null);
const translator = must(document.getElementById("translator") as HTMLSelectElement | null);
const llmProvider = must(document.getElementById("llmProvider") as HTMLSelectElement | null);
const llmEndpoint = must(document.getElementById("llmEndpoint") as HTMLInputElement | null);
const llmModel = must(document.getElementById("llmModel") as HTMLInputElement | null);
const llmApiKey = must(document.getElementById("llmApiKey") as HTMLInputElement | null);
const llmSettings = must(document.getElementById("llmSettings"));
const skipInputs = must(document.getElementById("skipInputs") as HTMLInputElement | null);
const enableTts = must(document.getElementById("enableTts") as HTMLInputElement | null);
const maxChars = must(document.getElementById("maxChars") as HTMLInputElement | null);
const uiLocale = must(document.getElementById("uiLocale") as HTMLSelectElement | null);
const swatches = must(document.getElementById("swatches"));
const toast = must(document.getElementById("toast"));
const accentSetting = must(document.getElementById("accentSetting"));

let settings: Settings = { ...DEFAULTS };
let toastTimer = 0;
let secrets = { llmApiKey: "" };

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

void chrome.storage.sync.get(toStorage(DEFAULTS)).then(async (stored) => {
  settings = { ...DEFAULTS, ...(stored as unknown as Partial<Settings>) };
  if (settings.uiLocale !== "en" && settings.uiLocale !== "zh-TW") settings.uiLocale = "en";
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_SECRETS" });
    if (response?.ok && response.secrets) secrets = response.secrets;
  } catch {
    secrets = { llmApiKey: "" };
  }
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
translator.addEventListener("change", () => {
  void save({ translator: translator.value as Translator }).then(() => requestLlmOrigin());
});
llmProvider.addEventListener("change", () => {
  const provider = llmProvider.value as LlmProvider;
  const defaults = llmDefaults(provider);
  if (!llmEndpoint.value.trim()) llmEndpoint.placeholder = defaults.endpoint;
  if (!llmModel.value.trim()) llmModel.placeholder = defaults.model;
  void save({ llmProvider: provider }).then(() => requestLlmOrigin());
});
llmEndpoint.addEventListener("change", () => {
  void save({ llmEndpoint: sanitizeHttpUrl(llmEndpoint.value) }).then(() => requestLlmOrigin());
});
llmModel.addEventListener("change", () => void save({ llmModel: llmModel.value.trim() }));
llmApiKey.addEventListener("change", () => void saveSecrets(llmApiKey.value.trim()));
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

async function requestLlmOrigin(): Promise<void> {
  if (settings.translator !== "llm") return;
  const endpoint = sanitizeHttpUrl(settings.llmEndpoint) || llmDefaults(settings.llmProvider).endpoint;
  try {
    const origin = `${new URL(endpoint).origin}/*`;
    const has = await chrome.permissions.contains({ origins: [origin] });
    if (!has) await chrome.permissions.request({ origins: [origin] });
  } catch {
    /* ignore invalid URLs */
  }
}

async function saveSecrets(value: string): Promise<void> {
  secrets = { llmApiKey: value };
  await chrome.runtime.sendMessage({ type: "SAVE_SECRETS", llmApiKey: value });
  showToast();
}

function paint(): void {
  applyDomI18n(document, settings);
  document.documentElement.lang = settings.uiLocale === "zh-TW" ? "zh-Hant" : "en";
  document.title = t("optionsTitle", settings);
  toast.textContent = t("saved", settings);
  sourceLang.innerHTML = languageOptionsHtml(true, settings.uiLocale);
  targetLang.innerHTML = languageOptionsHtml(false, settings.uiLocale);
  trigger.options[0].textContent = t("triggerAuto", settings);
  trigger.options[1].textContent = t("triggerButton", settings);
  translator.options[0].textContent = t("providerGoogle", settings);
  translator.options[1].textContent = t("providerLlm", settings);
  uiLocale.options[0].textContent = t("uiLanguageEn", settings);
  uiLocale.options[1].textContent = t("uiLanguageZh", settings);
  targetLang.value = settings.targetLang;
  sourceLang.value = settings.sourceLang;
  trigger.value = settings.trigger;
  translator.value = settings.translator;
  llmProvider.value = settings.llmProvider;
  const defaults = llmDefaults(settings.llmProvider);
  llmEndpoint.value = settings.llmEndpoint;
  llmEndpoint.placeholder = defaults.endpoint;
  llmModel.value = settings.llmModel;
  llmModel.placeholder = defaults.model;
  llmApiKey.value = secrets.llmApiKey;
  llmApiKey.placeholder = t("llmApiKeyPlaceholder", settings);
  llmSettings.hidden = settings.translator !== "llm";
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
