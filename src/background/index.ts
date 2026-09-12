import type { ExtensionMessage, MessageResponse, Secrets, Settings, TranslateResult } from "../lib/types.ts";
import { DEFAULTS, GOOGLE_TTS_LIMIT, googleTtsUrl, normalizeLang, parseGoogleResult, toStorage, ttsLang } from "../lib/shared.ts";
import { llmOrigin, resolveLlmConfig, translateWithLlm } from "../lib/llm.ts";
import { t } from "../lib/i18n.ts";

const MENU_ID = "select-translate-selection";
const OFFSCREEN_PATH = "src/offscreen/index.html";
let creatingOffscreen: Promise<void> | null = null;
let menuQueue: Promise<void> = Promise.resolve();

async function readSettings(): Promise<Settings> {
  return { ...DEFAULTS, ...((await chrome.storage.sync.get(toStorage(DEFAULTS))) as unknown as Partial<Settings>) };
}

async function readSecrets(): Promise<Secrets> {
  const stored = (await chrome.storage.local.get(["llmApiKey"])) as { llmApiKey?: string };
  return { llmApiKey: String(stored.llmApiKey || "") };
}

function queueContextMenu(): void {
  menuQueue = menuQueue.then(createContextMenu, createContextMenu);
}

chrome.runtime.onInstalled.addListener((details) => {
  void (async () => {
    const current = await readSettings();
    const next: Settings = { ...DEFAULTS, ...current };
    if (details.reason === "install" || details.previousVersion === "1.0.0") {
      next.trigger = "auto";
    }
    if (current.uiLocale !== "en" && current.uiLocale !== "zh-TW") next.uiLocale = "en";
    await chrome.storage.sync.set(toStorage(next));
    queueContextMenu();
  })();
});

chrome.runtime.onStartup.addListener(() => {
  queueContextMenu();
});

if (chrome.theme?.onChanged) {
  chrome.theme.onChanged.addListener(() => {
    void chrome.storage.local.set({ chromeThemeStamp: Date.now() });
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.uiLocale) queueContextMenu();
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

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id || !info.selectionText) return;
  await sendToTab(tab.id, {
    type: "TRANSLATE_SELECTION",
    text: info.selectionText
  });
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "translate-selection") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  await sendToTab(tab.id, { type: "TRANSLATE_SELECTION" });
});

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  if (message?.type === "OFFSCREEN_SPEAK") return;
  const task = handleMessage(message, sender);
  task
    .then((result) => sendResponse(result))
    .catch((error: Error) => {
      sendResponse({ ok: false, error: error.message || String(error) } satisfies MessageResponse);
    });
  return true;
});

async function handleMessage(message: ExtensionMessage, sender: chrome.runtime.MessageSender): Promise<MessageResponse> {
  const settings = await readSettings();
  if (message?.type === "TRANSLATE") {
    const result = await translateText(message.text, message.sourceLang, message.targetLang, settings);
    return { ok: true, result };
  }
  if (message?.type === "SPEAK") {
    await speakText(message.text, message.lang, settings);
    return { ok: true };
  }
  if (message?.type === "GET_SETTINGS") {
    return { ok: true, settings: { ...DEFAULTS, ...settings } };
  }
  if (message?.type === "OPEN_OPTIONS") {
    await chrome.runtime.openOptionsPage();
    return { ok: true };
  }
  if (message?.type === "PING") {
    return { ok: true, tabId: sender.tab?.id || null };
  }
  if (message?.type === "GET_CHROME_THEME") {
    try {
      const theme = "theme" in chrome ? await chrome.theme.getCurrent() : null;
      return { ok: true, theme };
    } catch {
      return { ok: true, theme: null };
    }
  }
  if (message?.type === "GET_SECRETS") {
    return { ok: true, secrets: await readSecrets() };
  }
  if (message?.type === "SAVE_SECRETS") {
    await chrome.storage.local.set({ llmApiKey: String(message.llmApiKey || "") });
    return { ok: true, secrets: await readSecrets() };
  }
  throw new Error(t("errorUnknown", settings));
}

async function sendToTab(tabId: number, payload: ExtensionMessage): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, payload);
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["src/content/index.js"]
    });
    await chrome.tabs.sendMessage(tabId, payload);
  }
}

async function translateText(
  rawText: string,
  sourceLang: string | undefined,
  targetLang: string | undefined,
  settings: Settings
): Promise<TranslateResult> {
  const text = String(rawText || "").replace(/\s+/g, " ").trim();
  if (!text) throw new Error(t("errorEmpty", settings));

  const sl = normalizeLang(sourceLang || settings.sourceLang);
  const tl = normalizeLang(targetLang || settings.targetLang);
  const limited = text.slice(0, settings.maxChars || 5000);

  if (settings.translator === "llm") {
    const secrets = await readSecrets();
    const { endpoint } = resolveLlmConfig(settings);
    await ensureHostAccess(endpoint, settings);
    return translateWithLlm(limited, sl, tl, settings, secrets.llmApiKey);
  }

  try {
    return await translateWithGoogle(limited, sl, tl);
  } catch (googleError) {
    const fallback = await translateWithBackup(limited, sl, tl, settings);
    fallback.warning = googleError instanceof Error ? googleError.message : t("warningFallback", settings);
    return fallback;
  }
}

async function ensureHostAccess(endpoint: string, settings: Settings): Promise<void> {
  const origin = llmOrigin(endpoint);
  const has = await chrome.permissions.contains({ origins: [origin] });
  if (!has) throw new Error(t("errorLlmPermission", settings));
}

async function translateWithGoogle(text: string, sl: string, tl: string): Promise<TranslateResult> {
  const params = new URLSearchParams();
  params.set("client", "gtx");
  params.set("sl", sl);
  params.set("tl", tl);
  params.set("hl", tl);
  params.set("ie", "UTF-8");
  params.set("oe", "UTF-8");
  ["t", "bd", "md", "ss", "ex", "at", "rm"].forEach((dt) => params.append("dt", dt));
  params.set("q", text);

  const response = await fetch("https://translate.googleapis.com/translate_a/single", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
    },
    body: params.toString()
  });
  if (!response.ok) {
    const settings = await readSettings();
    throw new Error(t("errorGoogle", settings, { STATUS: String(response.status) }));
  }
  const data = await response.json();
  return parseGoogleResult(data, text, sl, tl);
}

async function translateWithBackup(
  text: string,
  sl: string,
  tl: string,
  settings: Settings
): Promise<TranslateResult> {
  const langpair = `${sl === "auto" ? "Autodetect" : sl}|${tl}`;
  const url = `https://api.mymemory.translated.net/get?${new URLSearchParams({
    q: text,
    langpair
  }).toString()}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(t("errorBackup", settings));
  const data = (await response.json()) as { responseData?: { translatedText?: string } };
  const translated = data?.responseData?.translatedText;
  if (!translated) throw new Error(t("errorMissing", settings));

  return {
    original: text,
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
  await ensureOffscreen();
  await chrome.runtime.sendMessage({
    type: "OFFSCREEN_SPEAK",
    audio,
    text: utterance.slice(0, GOOGLE_TTS_LIMIT),
    lang: ttsLang(lang)
  });
}

async function fetchGoogleTts(text: string, lang: string | undefined): Promise<string | undefined> {
  const urls = [
    googleTtsUrl(text, lang || "en"),
    googleTtsUrl(text, lang || "en").replace("https://translate.google.com/translate_tts", "https://translate.googleapis.com/translate_tts").replace("client=tw-ob", "client=gtx")
  ];
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "audio/mpeg",
          Referer: "https://translate.google.com/"
        }
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
  const existing = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT" as chrome.runtime.ContextType]
  });
  if (existing.length) return;
  if (!creatingOffscreen) {
    creatingOffscreen = chrome.offscreen.createDocument({
      url: OFFSCREEN_PATH,
      reasons: ["AUDIO_PLAYBACK" as chrome.offscreen.Reason],
      justification: "Play Google Translate text-to-speech"
    });
  }
  try {
    await creatingOffscreen;
  } finally {
    creatingOffscreen = null;
  }
}
