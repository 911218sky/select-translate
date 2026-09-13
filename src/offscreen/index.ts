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
    const response = (await chrome.runtime.sendMessage({
      type: "GET_TTS_AUDIO",
      audioId: message.audioId
    })) as { ok?: boolean; audio?: string; error?: string } | undefined;
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
  await speakWithSynthesis(text, ttsLang(message.lang));
}

function speakWithSynthesis(text: string, lang: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = () => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.onend = () => resolve();
      utterance.onerror = () => reject(new Error("Speech failed"));
      window.speechSynthesis.speak(utterance);
    };
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      start();
      return;
    }
    const timer = window.setTimeout(() => {
      window.speechSynthesis.removeEventListener("voiceschanged", onVoices);
      start();
    }, 500);
    const onVoices = () => {
      window.clearTimeout(timer);
      window.speechSynthesis.removeEventListener("voiceschanged", onVoices);
      start();
    };
    window.speechSynthesis.addEventListener("voiceschanged", onVoices);
  });
}

function stop(): void {
  currentAudio?.pause();
  currentAudio = null;
  window.speechSynthesis?.cancel();
}
