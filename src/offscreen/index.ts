import type { OffscreenSpeakMessage } from "../lib/types.ts";
import { ttsLang } from "../lib/shared.ts";

let currentAudio: HTMLAudioElement | null = null;

chrome.runtime.onMessage.addListener((message: OffscreenSpeakMessage, _sender, sendResponse) => {
  if (message?.type !== "OFFSCREEN_SPEAK") return;
  void play(message).then(
    () => sendResponse({ ok: true }),
    () => sendResponse({ ok: false })
  );
  return true;
});

async function play(message: OffscreenSpeakMessage): Promise<void> {
  stop();
  if (message.audio) {
    currentAudio = new Audio(message.audio);
    await currentAudio.play();
    return;
  }
  const text = String(message.text || "").trim();
  if (!text || !window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = ttsLang(message.lang);
  window.speechSynthesis.speak(utterance);
}

function stop(): void {
  currentAudio?.pause();
  currentAudio = null;
  window.speechSynthesis?.cancel();
}
