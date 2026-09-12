import type { ExtensionMessage, OffscreenSpeakMessage } from "../lib/types.ts";
import { ttsLang } from "../lib/shared.ts";

let currentAudio: HTMLAudioElement | null = null;

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  if (message?.type === "OFFSCREEN_PING") {
    if (sender.tab) {
      sendResponse({ ok: false, error: "forbidden" });
      return false;
    }
    sendResponse({ ok: true });
    return false;
  }
  if (message?.type !== "OFFSCREEN_SPEAK") return;
  if (sender.tab) {
    sendResponse({ ok: false, error: "forbidden" });
    return false;
  }
  void play(message).then(
    () => sendResponse({ ok: true }),
    (error: unknown) =>
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) })
  );
  return true;
});

async function play(message: OffscreenSpeakMessage): Promise<void> {
  stop();
  let audio = message.audio;
  if (!audio && message.sessionKey) {
    const stored = (await chrome.storage.session.get(message.sessionKey)) as Record<string, unknown>;
    const value = stored[message.sessionKey];
    audio = typeof value === "string" && value ? value : undefined;
  }
  if (audio) {
    currentAudio = new Audio(audio);
    await currentAudio.play();
    return;
  }
  const text = String(message.text || "").trim();
  if (!text || !window.speechSynthesis) {
    throw new Error("No audio available");
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = ttsLang(message.lang);
  window.speechSynthesis.speak(utterance);
}

function stop(): void {
  currentAudio?.pause();
  currentAudio = null;
  window.speechSynthesis?.cancel();
}
