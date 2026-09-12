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
  // Offscreen documents cannot use chrome.storage — pull audio from the service worker instead.
  if (!audio && message.hasAudio) {
    const response = (await chrome.runtime.sendMessage({ type: "GET_TTS_AUDIO" })) as
      | { ok?: boolean; audio?: string; error?: string }
      | undefined;
    if (!response?.ok) {
      throw new Error(response?.error || "No audio available");
    }
    audio = typeof response.audio === "string" && response.audio ? response.audio : undefined;
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
