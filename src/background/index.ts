import type { ExtensionMessage, MessageResponse, Secrets, Settings, TranslateResult } from "../lib/types.ts";
import {
  DEFAULTS,
  GOOGLE_TTS_LIMIT,
  googleTtsUrl,
  normalizeLang,
  parseGoogleResult,
  toStorage,
  truncateCodePoints,
  ttsLang
} from "../lib/shared.ts";
import { listLlmModels, llmOrigin, resolveLlmConfig, testLlmConnection, translateWithLlm } from "../lib/llm.ts";
import { t } from "../lib/i18n.ts";

const MENU_ID = "select-translate-selection";
const OFFSCREEN_PATH = "src/offscreen/index.html";
const MAX_CHARS_HARD = 5000;
const FETCH_TIMEOUT_MS = 20_000;
const BACKUP_TIMEOUT_MS = 8_000;
const OFFSCREEN_READY_ATTEMPTS = 5;
const OFFSCREEN_IDLE_MS = 5 * 60_000;
const TTS_SESSION_KEY = "stTtsAudio";

let creatingOffscreen: Promise<void> | null = null;
let menuQueue: Promise<void> = Promise.resolve();
let closeOffscreenTimer = 0;
let cachedSettings: Settings | null = null;
let settingsLoad: Promise<Settings> | null = null;
let activeTranslate: { key: string; controller: AbortController } | null = null;

async function readSettings(): Promise<Settings> {
  if (cachedSettings) return cachedSettings;
  if (!settingsLoad) {
    settingsLoad = chrome.storage.sync
      .get(toStorage(DEFAULTS))
      .then((stored) => {
        cachedSettings = { ...DEFAULTS, ...(stored as unknown as Partial<Settings>) };
        return cachedSettings;
      })
      .finally(() => {
        settingsLoad = null;
      });
  }
  return settingsLoad;
}

function invalidateSettingsCache(): void {
  cachedSettings = null;
}

async function readSecrets(): Promise<Secrets> {
  const stored = (await chrome.storage.local.get(["llmApiKey"])) as { llmApiKey?: string };
  return { llmApiKey: String(stored.llmApiKey || "") };
}

/** Options / popup pages only — not content scripts on arbitrary sites. */
function isTrustedExtensionPage(sender: chrome.runtime.MessageSender): boolean {
  const url = sender.url || "";
  return url.startsWith(chrome.runtime.getURL("/"));
}

function queueContextMenu(): void {
  menuQueue = menuQueue.then(createContextMenu, createContextMenu);
}

chrome.runtime.onInstalled.addListener((details) => {
  void (async () => {
    invalidateSettingsCache();
    const current = await readSettings();
    const next: Settings = { ...DEFAULTS, ...current };
    if (details.reason === "install" || details.previousVersion === "1.0.0") {
      next.trigger = "auto";
    }
    if (current.uiLocale !== "en" && current.uiLocale !== "zh-TW") next.uiLocale = "en";
    await chrome.storage.sync.set(toStorage(next));
    cachedSettings = next;
    queueContextMenu();
  })();
});

chrome.runtime.onStartup.addListener(() => {
  queueContextMenu();
});

queueContextMenu();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync") {
    invalidateSettingsCache();
    if (changes.uiLocale) queueContextMenu();
  }
});

async function createContextMenu(): Promise<void> {
  const settings = await readSettings();
  await chrome.contextMenus.removeAll();
  await new Promise<void>((resolve) => {
    chrome.contextMenus.create(
      {
        id: MENU_ID,
        title: t("contextMenu", settings),
        contexts: ["selection"]
      },
      () => {
        void chrome.runtime.lastError;
        resolve();
      }
    );
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id || !info.selectionText) return;
  void sendToTab(
    tab.id,
    {
      type: "TRANSLATE_SELECTION",
      text: info.selectionText
    },
    typeof info.frameId === "number" ? info.frameId : undefined
  ).catch(() => {
    /* unsupported page (chrome://, PDF viewer, etc.) */
  });
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== "translate-selection") return;
  void (async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    const frameId = await findFrameWithSelection(tab.id);
    await sendToTab(tab.id, { type: "TRANSLATE_SELECTION" }, frameId);
  })().catch(() => {
    /* unsupported page */
  });
});

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  if (message?.type === "OFFSCREEN_SPEAK" || message?.type === "OFFSCREEN_PING") return;
  const task = handleMessage(message, sender);
  task
    .then((result) => sendResponse(result))
    .catch((error: Error) => {
      sendResponse({ ok: false, error: error.message || String(error) } satisfies MessageResponse);
    });
  return true;
});

async function handleMessage(message: ExtensionMessage, sender: chrome.runtime.MessageSender): Promise<MessageResponse> {
  if (message?.type === "PING") {
    return { ok: true, tabId: sender.tab?.id || null };
  }
  if (message?.type === "OPEN_OPTIONS") {
    await chrome.runtime.openOptionsPage();
    return { ok: true };
  }
  if (message?.type === "GET_CHROME_THEME") {
    try {
      const theme = "theme" in chrome ? await chrome.theme.getCurrent() : null;
      return { ok: true, theme };
    } catch {
      return { ok: true, theme: null };
    }
  }

  const settings = await readSettings();
  if (message?.type === "TRANSLATE") {
    const result = await translateText(
      message.text,
      message.sourceLang,
      message.targetLang,
      settings,
      translateKey(sender, message.requestId)
    );
    return { ok: true, result };
  }
  if (message?.type === "SPEAK") {
    await speakText(message.text, message.lang, settings);
    return { ok: true };
  }
  if (message?.type === "GET_SETTINGS") {
    return { ok: true, settings: { ...DEFAULTS, ...settings } };
  }
  if (message?.type === "GET_SECRETS") {
    if (!isTrustedExtensionPage(sender)) throw new Error(t("errorUnknown", settings));
    return { ok: true, secrets: await readSecrets() };
  }
  if (message?.type === "SAVE_SECRETS") {
    if (!isTrustedExtensionPage(sender)) throw new Error(t("errorUnknown", settings));
    if (typeof message.llmApiKey !== "string") throw new Error(t("errorUnknown", settings));
    await chrome.storage.local.set({ llmApiKey: message.llmApiKey });
    return { ok: true, secrets: await readSecrets() };
  }
  if (message?.type === "LIST_LLM_MODELS") {
    if (!isTrustedExtensionPage(sender)) throw new Error(t("errorUnknown", settings));
    const secrets = await readSecrets();
    const { endpoint } = resolveLlmConfig(settings);
    if (!endpoint) throw new Error(t("errorLlmConfig", settings));
    await ensureHostAccess(endpoint, settings);
    const models = await listLlmModels(settings, secrets.llmApiKey);
    return { ok: true, models };
  }
  if (message?.type === "TEST_LLM") {
    if (!isTrustedExtensionPage(sender)) throw new Error(t("errorUnknown", settings));
    const secrets = await readSecrets();
    const { endpoint } = resolveLlmConfig(settings);
    if (!endpoint) throw new Error(t("errorLlmConfig", settings));
    await ensureHostAccess(endpoint, settings);
    const result = await testLlmConnection(settings, secrets.llmApiKey);
    return { ok: true, result };
  }
  throw new Error(t("errorUnknown", settings));
}

function translateKey(sender: chrome.runtime.MessageSender, requestId?: number): string {
  const tab = sender.tab?.id ?? "ext";
  const frame = sender.frameId ?? 0;
  return `${tab}:${frame}:${requestId ?? Date.now()}`;
}

async function sendToTab(tabId: number, payload: ExtensionMessage, frameId?: number): Promise<void> {
  const options = typeof frameId === "number" ? { frameId } : undefined;
  try {
    await chrome.tabs.sendMessage(tabId, payload, options);
  } catch {
    // Inject only into the target frame (or top frame) — avoid waking every iframe.
    await chrome.scripting.executeScript({
      target: typeof frameId === "number" ? { tabId, frameIds: [frameId] } : { tabId },
      files: ["src/content/index.js"]
    });
    await chrome.tabs.sendMessage(tabId, payload, options);
  }
}

async function findFrameWithSelection(tabId: number): Promise<number | undefined> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: () => {
        const active = document.activeElement;
        if (
          (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) &&
          typeof active.selectionStart === "number" &&
          typeof active.selectionEnd === "number" &&
          active.selectionStart !== active.selectionEnd
        ) {
          return active.value.slice(active.selectionStart, active.selectionEnd).replace(/\s+/g, " ").trim();
        }
        return window.getSelection()?.toString().replace(/\s+/g, " ").trim() || "";
      }
    });
    const hit = results?.find((entry) => typeof entry.result === "string" && entry.result.length > 0);
    return typeof hit?.frameId === "number" ? hit.frameId : undefined;
  } catch {
    return undefined;
  }
}

function clampMaxChars(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return MAX_CHARS_HARD;
  return Math.min(Math.max(Math.floor(n), 1), MAX_CHARS_HARD);
}

async function translateText(
  rawText: string,
  sourceLang: string | undefined,
  targetLang: string | undefined,
  settings: Settings,
  key: string
): Promise<TranslateResult> {
  const text = String(rawText || "").replace(/\s+/g, " ").trim();
  if (!text) throw new Error(t("errorEmpty", settings));

  if (activeTranslate) {
    activeTranslate.controller.abort();
    activeTranslate = null;
  }
  const controller = new AbortController();
  activeTranslate = { key, controller };
  const signal = controller.signal;

  try {
    const sl = normalizeLang(sourceLang || settings.sourceLang);
    const tl = normalizeLang(targetLang || settings.targetLang);
    const limited = truncateCodePoints(text, clampMaxChars(settings.maxChars));

    if (settings.translator === "llm") {
      const secrets = await readSecrets();
      const { endpoint } = resolveLlmConfig(settings);
      if (!endpoint) throw new Error(t("errorLlmConfig", settings));
      await ensureHostAccess(endpoint, settings);
      return await translateWithLlm(limited, sl, tl, settings, secrets.llmApiKey, signal);
    }

    try {
      return await translateWithGoogle(limited, sl, tl, settings, signal);
    } catch (googleError) {
      if (signal.aborted) throw googleError;
      const fallback = await translateWithBackup(limited, sl, tl, settings, signal);
      fallback.warning = googleError instanceof Error ? googleError.message : t("warningFallback", settings);
      return fallback;
    }
  } finally {
    if (activeTranslate?.key === key) activeTranslate = null;
  }
}

async function ensureHostAccess(endpoint: string, settings: Settings): Promise<void> {
  const origin = llmOrigin(endpoint);
  const has = await chrome.permissions.contains({ origins: [origin] });
  if (!has) throw new Error(t("errorLlmPermission", settings));
}

function mergeAbortSignals(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      break;
    }
    signal.addEventListener("abort", onAbort, { once: true });
  }
  return controller.signal;
}

async function translateWithGoogle(
  text: string,
  sl: string,
  tl: string,
  settings: Settings,
  signal: AbortSignal
): Promise<TranslateResult> {
  const params = new URLSearchParams();
  params.set("client", "gtx");
  params.set("sl", sl);
  params.set("tl", tl);
  params.set("hl", tl);
  params.set("ie", "UTF-8");
  params.set("oe", "UTF-8");
  // Only request translation + dictionary — definitions/examples are unused in UI.
  ["t", "bd"].forEach((dt) => params.append("dt", dt));
  params.set("q", text);

  const response = await fetch("https://translate.googleapis.com/translate_a/single", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
    },
    body: params.toString(),
    signal: mergeAbortSignals([signal, AbortSignal.timeout(FETCH_TIMEOUT_MS)])
  });
  if (!response.ok) {
    throw new Error(t("errorGoogle", settings, { STATUS: String(response.status) }));
  }
  const data = await response.json();
  const result = parseGoogleResult(data, text, sl, tl);
  if (!result.translated.trim()) {
    throw new Error(t("errorMissing", settings));
  }
  return result;
}

async function translateWithBackup(
  text: string,
  sl: string,
  tl: string,
  settings: Settings,
  signal: AbortSignal
): Promise<TranslateResult> {
  const backupText = truncateCodePoints(text, 500);
  const langpair = `${sl === "auto" ? "Autodetect" : sl}|${tl}`;
  const url = `https://api.mymemory.translated.net/get?${new URLSearchParams({
    q: backupText,
    langpair
  }).toString()}`;

  const response = await fetch(url, {
    signal: mergeAbortSignals([signal, AbortSignal.timeout(BACKUP_TIMEOUT_MS)])
  });
  if (!response.ok) throw new Error(t("errorBackup", settings));
  const data = (await response.json()) as { responseData?: { translatedText?: string } };
  const translated = data?.responseData?.translatedText;
  if (!translated) throw new Error(t("errorMissing", settings));

  return {
    original: backupText,
    translated,
    sourceLang: sl,
    targetLang: tl,
    dictionary: [],
    definitions: [],
    examples: [],
    alternatives: [],
    provider: "mymemory"
  };
}

async function speakText(text: string, lang: string | undefined, settings: Settings): Promise<void> {
  if (!settings.enableTts) return;
  const utterance = String(text || "").trim();
  if (!utterance) return;
  const audio = await fetchGoogleTts(utterance, lang);
  await ensureOffscreenReady(settings);
  // Keep large audio out of runtime.sendMessage broadcast — content frames only see a tiny envelope.
  await chrome.storage.session.set({ [TTS_SESSION_KEY]: audio || "" });
  const response = await sendOffscreenSpeak(
    {
      type: "OFFSCREEN_SPEAK",
      sessionKey: TTS_SESSION_KEY,
      text: audio ? undefined : truncateCodePoints(utterance, GOOGLE_TTS_LIMIT),
      lang: ttsLang(lang)
    },
    settings
  );
  scheduleCloseOffscreen();
  void chrome.storage.session.remove(TTS_SESSION_KEY).catch(() => {
    /* ignore */
  });
  if (!response?.ok) {
    throw new Error(response?.error || t("errorSpeak", settings));
  }
}

async function sendOffscreenSpeak(
  payload: ExtensionMessage,
  settings: Settings
): Promise<MessageResponse | undefined> {
  let last: MessageResponse | undefined;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    last = (await chrome.runtime.sendMessage(payload)) as MessageResponse | undefined;
    if (last?.ok) return last;
    if (last && last.ok === false && last.error === "forbidden") break;
    await delay(50 * (attempt + 1));
    await ensureOffscreenReady(settings);
  }
  return last;
}

async function fetchGoogleTts(text: string, lang: string | undefined): Promise<string | undefined> {
  const urls = [
    googleTtsUrl(text, lang || "en"),
    googleTtsUrl(text, lang || "en")
      .replace("https://translate.google.com/translate_tts", "https://translate.googleapis.com/translate_tts")
      .replace("client=tw-ob", "client=gtx")
  ];
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "audio/mpeg",
          Referer: "https://translate.google.com/"
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
      });
      if (!response.ok) continue;
      const buffer = await response.arrayBuffer();
      if (!buffer.byteLength) continue;
      const bytes = new Uint8Array(buffer);
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      return `data:audio/mpeg;base64,${btoa(binary)}`;
    } catch {
      /* try next endpoint */
    }
  }
  return undefined;
}

async function ensureOffscreen(): Promise<void> {
  clearCloseOffscreenTimer();
  const existing = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT" as chrome.runtime.ContextType]
  });
  if (existing.length) return;
  if (!creatingOffscreen) {
    creatingOffscreen = chrome.offscreen
      .createDocument({
        url: OFFSCREEN_PATH,
        reasons: ["AUDIO_PLAYBACK" as chrome.offscreen.Reason],
        justification: "Play Google Translate text-to-speech"
      })
      .catch(async (error: unknown) => {
        const contexts = await chrome.runtime.getContexts({
          contextTypes: ["OFFSCREEN_DOCUMENT" as chrome.runtime.ContextType]
        });
        if (contexts.length) return;
        throw error;
      })
      .finally(() => {
        creatingOffscreen = null;
      });
  }
  await creatingOffscreen;
}

async function ensureOffscreenReady(settings: Settings): Promise<void> {
  await ensureOffscreen();
  for (let attempt = 0; attempt < OFFSCREEN_READY_ATTEMPTS; attempt += 1) {
    try {
      const response = (await chrome.runtime.sendMessage({ type: "OFFSCREEN_PING" })) as
        | MessageResponse
        | undefined;
      if (response?.ok) return;
    } catch {
      /* not ready yet */
    }
    await delay(30 * (attempt + 1));
    await ensureOffscreen();
  }
  throw new Error(t("errorSpeak", settings));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clearCloseOffscreenTimer(): void {
  if (closeOffscreenTimer) {
    clearTimeout(closeOffscreenTimer);
    closeOffscreenTimer = 0;
  }
}

function scheduleCloseOffscreen(): void {
  clearCloseOffscreenTimer();
  closeOffscreenTimer = setTimeout(() => {
    closeOffscreenTimer = 0;
    void chrome.offscreen.closeDocument().catch(() => {
      /* already closed */
    });
  }, OFFSCREEN_IDLE_MS) as unknown as number;
}
