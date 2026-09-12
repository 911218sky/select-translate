import type { Appearance, LlmProvider, Settings, Translator } from "../lib/types.ts";
import { ACCENT_PRESETS, DEFAULTS, languageOptionsHtml, llmDefaults, normalizeHex, sanitizeHttpUrl, toStorage } from "../lib/shared.ts";
import { applyDomI18n, t } from "../lib/i18n.ts";
import { apply as applyTheme, watch } from "../lib/theme.ts";

const sourceLang = must(document.getElementById("sourceLang") as HTMLSelectElement | null);
const targetLang = must(document.getElementById("targetLang") as HTMLSelectElement | null);
const trigger = must(document.getElementById("trigger") as HTMLSelectElement | null);
const translator = must(document.getElementById("translator") as HTMLSelectElement | null);
const llmProvider = must(document.getElementById("llmProvider") as HTMLSelectElement | null);
const llmEndpoint = must(document.getElementById("llmEndpoint") as HTMLInputElement | null);
const llmModel = must(document.getElementById("llmModel") as HTMLInputElement | null);
const llmModelSelect = must(document.getElementById("llmModelSelect") as HTMLSelectElement | null);
const llmApiKey = must(document.getElementById("llmApiKey") as HTMLInputElement | null);
const llmSettings = must(document.getElementById("llmSettings"));
const llmFetchModels = must(document.getElementById("llmFetchModels") as HTMLButtonElement | null);
const llmTest = must(document.getElementById("llmTest") as HTMLButtonElement | null);
const llmStatus = must(document.getElementById("llmStatus"));
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
let modelChoices: string[] = [];
let llmBusy = false;

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
  void (async () => {
    const next = translator.value as Translator;
    const granted = next === "llm" ? await requestLlmOriginNow() : true;
    await save({ translator: next });
    if (next === "llm" && !granted) {
      setLlmStatus("error", t("errorLlmPermission", settings));
    }
  })();
});
llmProvider.addEventListener("change", () => {
  const provider = llmProvider.value as LlmProvider;
  const defaults = llmDefaults(provider);
  if (!llmEndpoint.value.trim()) llmEndpoint.placeholder = defaults.endpoint;
  if (!llmModel.value.trim()) llmModel.placeholder = defaults.model;
  modelChoices = [];
  setLlmStatus("info", "");
  paintModelList();
  void (async () => {
    const granted = await requestLlmOriginNow();
    await save({ llmProvider: provider });
    if (!granted) setLlmStatus("error", t("errorLlmPermission", settings));
  })();
});
llmEndpoint.addEventListener("change", () => {
  modelChoices = [];
  setLlmStatus("info", "");
  paintModelList();
  void (async () => {
    const endpoint = sanitizeHttpUrl(llmEndpoint.value);
    const granted = await requestLlmOriginNow();
    await save({ llmEndpoint: endpoint });
    if ((translator.value as Translator) === "llm" && !granted) {
      setLlmStatus("error", t("errorLlmPermission", settings));
    }
  })();
});
llmModelSelect.addEventListener("change", () => {
  const value = llmModelSelect.value.trim();
  if (!value) return;
  llmModel.value = value;
  void save({ llmModel: value });
});
llmModel.addEventListener("change", () => {
  const value = llmModel.value.trim();
  void save({ llmModel: value });
  syncModelSelect(value);
});
llmApiKey.addEventListener("change", () => void saveSecrets(llmApiKey.value.trim()));
uiLocale.addEventListener("change", () => void save({ uiLocale: uiLocale.value as Settings["uiLocale"] }));
skipInputs.addEventListener("change", () => void save({ skipInputs: skipInputs.checked }));
enableTts.addEventListener("change", () => void save({ enableTts: enableTts.checked }));
maxChars.addEventListener("change", () => {
  void save({ maxChars: Number(maxChars.value) || 5000 });
});
llmFetchModels.addEventListener("click", () => void runLlmAction("list"));
llmTest.addEventListener("click", () => void runLlmAction("test"));

async function save(patch: Partial<Settings>): Promise<void> {
  settings = { ...settings, ...patch };
  paint();
  await chrome.storage.sync.set(toStorage(patch));
  await applyTheme();
  showToast();
}

/** Request host access as the first await so the user gesture is still valid. */
async function requestLlmOriginNow(): Promise<boolean> {
  if ((translator.value as Translator) !== "llm") return true;
  const endpoint =
    sanitizeHttpUrl(llmEndpoint.value) || llmDefaults(llmProvider.value as LlmProvider).endpoint;
  try {
    const origin = `${new URL(endpoint).origin}/*`;
    return Boolean(await chrome.permissions.request({ origins: [origin] }));
  } catch {
    return false;
  }
}

async function saveSecrets(value: string): Promise<void> {
  secrets = { llmApiKey: value };
  await chrome.runtime.sendMessage({ type: "SAVE_SECRETS", llmApiKey: value });
  showToast();
}

async function runLlmAction(kind: "list" | "test"): Promise<void> {
  if (llmBusy) return;
  llmBusy = true;
  setLlmBusy(true);
  setLlmStatus("info", t("llmBusy", settings));
  try {
    const patch: Partial<Settings> = {
      translator: translator.value as Translator,
      llmProvider: llmProvider.value as LlmProvider,
      llmEndpoint: sanitizeHttpUrl(llmEndpoint.value),
      llmModel: llmModel.value.trim()
    };
    settings = { ...settings, ...patch };
    const key = llmApiKey.value.trim();

    const granted = await requestLlmOriginNow();
    if (!granted) throw new Error(t("errorLlmPermission", settings));

    await chrome.storage.sync.set(toStorage(patch));
    if (key !== secrets.llmApiKey) {
      secrets = { llmApiKey: key };
      await chrome.runtime.sendMessage({ type: "SAVE_SECRETS", llmApiKey: key });
    }

    const response = await chrome.runtime.sendMessage({
      type: kind === "list" ? "LIST_LLM_MODELS" : "TEST_LLM"
    });
    if (!response?.ok) throw new Error(response?.error || t("popupFailed", settings));
    if (kind === "list") {
      modelChoices = Array.isArray(response.models) ? response.models.map(String) : [];
      paintModelList();
      if (!modelChoices.length) {
        setLlmStatus("error", t("llmFetchEmpty", settings));
      } else {
        const current = llmModel.value.trim();
        const next = current && modelChoices.includes(current) ? current : modelChoices[0];
        llmModel.value = next;
        syncModelSelect(next);
        if (next !== settings.llmModel) {
          settings.llmModel = next;
          await chrome.storage.sync.set({ llmModel: next });
        }
        setLlmStatus("ok", t("llmFetchOk", settings, { COUNT: String(modelChoices.length) }));
        llmModelSelect.focus();
      }
      return;
    }
    const translated = String((response.result as { translated?: string } | undefined)?.translated || "").trim();
    setLlmStatus("ok", t("llmTestOk", settings, { RESULT: translated || "…" }));
  } catch (error) {
    setLlmStatus("error", error instanceof Error ? error.message : String(error));
  } finally {
    llmBusy = false;
    setLlmBusy(false);
  }
}

function setLlmBusy(busy: boolean): void {
  llmFetchModels.disabled = busy;
  llmTest.disabled = busy;
}

function setLlmStatus(kind: "ok" | "error" | "info", message: string): void {
  llmStatus.hidden = !message;
  llmStatus.textContent = message;
  llmStatus.classList.toggle("ok", kind === "ok");
  llmStatus.classList.toggle("error", kind === "error");
  llmStatus.classList.toggle("info", kind === "info");
}

function paintModelList(): void {
  const current = (document.activeElement === llmModel ? llmModel.value : settings.llmModel || llmModel.value || "").trim();
  llmModelSelect.hidden = modelChoices.length === 0;
  if (!modelChoices.length) {
    llmModelSelect.innerHTML = "";
    return;
  }
  llmModelSelect.innerHTML = [
    `<option value="">${escapeHtml(t("llmModelCustom", settings))}</option>`,
    ...modelChoices.map((model) => `<option value="${escapeAttr(model)}">${escapeHtml(model)}</option>`)
  ].join("");
  syncModelSelect(current);
}

function syncModelSelect(value: string): void {
  if (!modelChoices.length) {
    llmModelSelect.hidden = true;
    return;
  }
  llmModelSelect.hidden = false;
  llmModelSelect.value = value && modelChoices.includes(value) ? value : "";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setIfBlurred(el: HTMLInputElement | HTMLSelectElement, value: string): void {
  if (document.activeElement === el) return;
  el.value = value;
}

function paint(): void {
  applyDomI18n(document, settings);
  document.documentElement.lang = settings.uiLocale === "zh-TW" ? "zh-Hant" : "en";
  document.title = t("optionsTitle", settings);
  toast.textContent = t("saved", settings);
  const keepSource = document.activeElement === sourceLang ? sourceLang.value : "";
  const keepTarget = document.activeElement === targetLang ? targetLang.value : "";
  sourceLang.innerHTML = languageOptionsHtml(true, settings.uiLocale);
  targetLang.innerHTML = languageOptionsHtml(false, settings.uiLocale);
  trigger.options[0].textContent = t("triggerAuto", settings);
  trigger.options[1].textContent = t("triggerButton", settings);
  translator.options[0].textContent = t("providerGoogle", settings);
  translator.options[1].textContent = t("providerLlm", settings);
  uiLocale.options[0].textContent = t("uiLanguageEn", settings);
  uiLocale.options[1].textContent = t("uiLanguageZh", settings);
  setIfBlurred(targetLang, keepTarget || settings.targetLang);
  setIfBlurred(sourceLang, keepSource || settings.sourceLang);
  setIfBlurred(trigger, settings.trigger);
  setIfBlurred(translator, settings.translator);
  setIfBlurred(llmProvider, settings.llmProvider);
  const defaults = llmDefaults(settings.llmProvider);
  setIfBlurred(llmEndpoint, settings.llmEndpoint);
  llmEndpoint.placeholder = defaults.endpoint;
  setIfBlurred(llmModel, settings.llmModel);
  llmModel.placeholder = defaults.model;
  paintModelList();
  llmModelSelect.setAttribute("aria-label", t("llmModel", settings));
  setIfBlurred(llmApiKey, secrets.llmApiKey);
  llmApiKey.placeholder = t("llmApiKeyPlaceholder", settings);
  llmSettings.hidden = settings.translator !== "llm";
  setIfBlurred(uiLocale, settings.uiLocale);
  skipInputs.checked = Boolean(settings.skipInputs);
  enableTts.checked = Boolean(settings.enableTts);
  setIfBlurred(maxChars, String(settings.maxChars));
  if (document.activeElement !== accentColor) {
    accentColor.value = normalizeHex(settings.accentColor) || DEFAULTS.accentColor;
  }
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

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function must<T>(value: T | null): T {
  if (!value) throw new Error("Missing options element");
  return value;
}
