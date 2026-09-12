import type { Settings, TranslateResult } from "../lib/types.ts";
import {
  DEFAULTS,
  escapeAttr,
  escapeHtml,
  googleTranslateUrl,
  languageBanner,
  languageOptionsHtml,
  shouldHideTranslation,
  toStorage
} from "../lib/shared.ts";
import { t } from "../lib/i18n-content.ts";
import { unwatch, watch } from "../lib/theme.ts";

const EXTENSION_VERSION = chrome.runtime.getManifest().version;
const TRANSLATE_TIMEOUT_MS = 30_000;
const AUTO_TRANSLATE_DEBOUNCE_MS = 180;

if (window.__SELECT_TRANSLATE_LOADED__ !== EXTENSION_VERSION) {
  window.__SELECT_TRANSLATE_CLEANUP__?.();
  document.getElementById("select-translate-root")?.remove();
  window.__SELECT_TRANSLATE_LOADED__ = EXTENSION_VERSION;
  boot();
}

function boot(): void {
  const HOST_ID = "select-translate-root";
  const lifecycle = new AbortController();
  const { signal } = lifecycle;
  const state = {
    settings: { ...DEFAULTS } as Settings,
    lastText: "",
    lastRangeRect: null as DOMRect | null,
    hideTimer: 0,
    mouseUpTimer: 0,
    autoTimer: 0,
    scrollRaf: 0,
    requestId: 0,
    commandGuardUntil: 0,
    cachedCardHeight: 220,
    languagesFilled: false,
    pointer: { x: 0, y: 0, selection: "" },
    blockedSelection: ""
  };

  const host = document.createElement("div");
  host.id = HOST_ID;
  Object.assign(host.style, {
    position: "fixed",
    left: "0",
    top: "0",
    width: "0",
    height: "0",
    zIndex: "2147483647",
    pointerEvents: "none"
  });
  const shadow = host.attachShadow({ mode: "closed" });
  shadow.innerHTML = `
    <style>${bubbleStyles()}</style>
    <div class="card" hidden>
      <div class="arrow"></div>
      <div class="toolbar">
        <select class="lang source-lang"></select>
        <button class="icon-btn swap">⇄</button>
        <select class="lang target-lang"></select>
        <button class="icon-btn close">×</button>
      </div>
      <div class="body">
        <div class="status"></div>
      </div>
      <div class="footer">
        <button class="link options"></button>
        <a class="link more" target="_blank" rel="noopener noreferrer"></a>
      </div>
    </div>
  `;

  const card = must(shadow.querySelector<HTMLDivElement>(".card"));
  const arrow = must(shadow.querySelector<HTMLDivElement>(".arrow"));
  const sourceSelect = must(shadow.querySelector<HTMLSelectElement>(".source-lang"));
  const targetSelect = must(shadow.querySelector<HTMLSelectElement>(".target-lang"));
  const swapBtn = must(shadow.querySelector<HTMLButtonElement>(".swap"));
  const body = must(shadow.querySelector<HTMLDivElement>(".body"));
  const moreLink = must(shadow.querySelector<HTMLAnchorElement>(".more"));
  const optionsBtn = must(shadow.querySelector<HTMLButtonElement>(".options"));
  const closeBtn = must(shadow.querySelector<HTMLButtonElement>(".close"));

  document.documentElement.appendChild(host);
  void loadSettings().then(() => {
    if (lifecycle.signal.aborted) return;
    paintChrome();
    watch(host);
  });

  const onStorageChanged = (
    changes: { [key: string]: chrome.storage.StorageChange },
    area: string
  ): void => {
    if (area !== "sync") return;
    for (const [key, value] of Object.entries(changes)) {
      const next = value.newValue;
      if (next === undefined) {
        if (key in DEFAULTS) {
          (state.settings as unknown as Record<string, unknown>)[key] =
            (DEFAULTS as unknown as Record<string, unknown>)[key];
        }
        continue;
      }
      (state.settings as unknown as Record<string, unknown>)[key] = next;
    }
    if (changes.sourceLang) {
      sourceSelect.value = String(state.settings.sourceLang || "auto");
      syncSwapState();
    }
    if (changes.targetLang) targetSelect.value = String(state.settings.targetLang || "zh-TW");
    if (changes.uiLocale) paintChrome();
  };
  chrome.storage.onChanged.addListener(onStorageChanged);

  document.addEventListener("mouseup", onMouseUp, { capture: true, signal });
  document.addEventListener("keyup", onKeyUp, { capture: true, signal });
  document.addEventListener("mousedown", onMouseDown, { capture: true, signal });
  document.addEventListener("pointerdown", onPointerDown, { capture: true, signal });
  document.addEventListener("click", onDocumentClick, { capture: true, signal });
  document.addEventListener("scroll", onScroll, { capture: true, signal });
  window.addEventListener("resize", onResize, { signal });
  document.addEventListener("selectionchange", onSelectionChange, { signal });
  document.addEventListener("keydown", onKeyDown, { signal });

  closeBtn.addEventListener("click", hideUi, { signal });
  optionsBtn.addEventListener("click", () => {
    void chrome.runtime.sendMessage({ type: "OPEN_OPTIONS" });
  }, { signal });
  sourceSelect.addEventListener("change", async () => {
    syncSwapState();
    state.settings.sourceLang = sourceSelect.value;
    await chrome.storage.sync.set({ sourceLang: sourceSelect.value });
    if (state.lastText) await translateNow(state.lastText);
  }, { signal });
  targetSelect.addEventListener("change", async () => {
    state.settings.targetLang = targetSelect.value;
    await chrome.storage.sync.set({ targetLang: targetSelect.value });
    if (state.lastText) await translateNow(state.lastText);
  }, { signal });
  swapBtn.addEventListener("click", async () => {
    if (sourceSelect.value === "auto") return;
    const nextSource = targetSelect.value;
    const nextTarget = sourceSelect.value;
    sourceSelect.value = nextSource;
    targetSelect.value = nextTarget;
    state.settings.sourceLang = nextSource;
    state.settings.targetLang = nextTarget;
    syncSwapState();
    await chrome.storage.sync.set({ sourceLang: nextSource, targetLang: nextTarget });
    if (state.lastText) await translateNow(state.lastText);
  }, { signal });

  function syncSwapState(): void {
    const disabled = sourceSelect.value === "auto";
    swapBtn.disabled = disabled;
    swapBtn.style.opacity = disabled ? "0.4" : "1";
    swapBtn.setAttribute("aria-disabled", disabled ? "true" : "false");
  }
  syncSwapState();

  const onRuntimeMessage = (message: { type?: string; text?: string }): void => {
    if (message?.type !== "TRANSLATE_SELECTION") return;
    const text = String(message.text || selectedText()).trim();
    if (!text) return;
    state.commandGuardUntil = Date.now() + 500;
    clearAutoTimer();
    captureSelection();
    void translateNow(text);
  };
  chrome.runtime.onMessage.addListener(onRuntimeMessage);

  window.__SELECT_TRANSLATE_CLEANUP__ = () => {
    lifecycle.abort();
    chrome.storage.onChanged.removeListener(onStorageChanged);
    chrome.runtime.onMessage.removeListener(onRuntimeMessage);
    unwatch(host);
    clearAutoTimer();
    window.clearTimeout(state.hideTimer);
    window.clearTimeout(state.mouseUpTimer);
    if (state.scrollRaf) window.cancelAnimationFrame(state.scrollRaf);
    host.remove();
    if (window.__SELECT_TRANSLATE_CLEANUP__) delete window.__SELECT_TRANSLATE_CLEANUP__;
  };

  function paintChrome(): void {
    const locale = state.settings.uiLocale;
    sourceSelect.setAttribute("aria-label", t("bubbleSourceLang", locale));
    targetSelect.setAttribute("aria-label", t("bubbleTargetLang", locale));
    swapBtn.title = t("bubbleSwap", locale);
    swapBtn.setAttribute("aria-label", t("bubbleSwap", locale));
    closeBtn.title = t("bubbleClose", locale);
    closeBtn.setAttribute("aria-label", t("bubbleClose", locale));
    optionsBtn.textContent = t("bubbleOptions", locale);
    moreLink.textContent = t("bubbleMore", locale);
    if (state.languagesFilled || !card.hidden) fillLanguageSelects();
  }

  function fillLanguageSelects(): void {
    const locale = state.settings.uiLocale;
    const sourceValue = sourceSelect.value || state.settings.sourceLang || "auto";
    const targetValue = targetSelect.value || state.settings.targetLang || "zh-TW";
    sourceSelect.innerHTML = languageOptionsHtml(true, locale);
    targetSelect.innerHTML = languageOptionsHtml(false, locale);
    sourceSelect.value = sourceValue;
    targetSelect.value = targetValue;
    state.languagesFilled = true;
    syncSwapState();
  }

  function ensureLanguagesReady(): void {
    if (!state.languagesFilled) fillLanguageSelects();
  }

  function isInUi(event: Event): boolean {
    return event.target === host || Boolean(event.composedPath?.().includes(host));
  }

  function onMouseUp(event: MouseEvent): void {
    if (event.button !== 0) return;
    if (isInUi(event)) return;
    const dx = event.clientX - state.pointer.x;
    const dy = event.clientY - state.pointer.y;
    const moved = dx * dx + dy * dy > 36;
    if (isInteractive(event.target)) {
      const editable = isEditableTarget(event.target);
      if (!editable || state.settings.skipInputs) {
        hideUi();
        return;
      }
    }
    window.clearTimeout(state.mouseUpTimer);
    state.mouseUpTimer = window.setTimeout(() => {
      state.mouseUpTimer = 0;
      const next = selectedText();
      if (!next) {
        hideUi();
        return;
      }
      if (!moved && next === state.pointer.selection) return;
      handleSelection();
    }, 10);
  }

  function onKeyUp(event: KeyboardEvent): void {
    if (event.key !== "Shift" && event.key !== "Control" && event.key !== "Meta" && event.key !== "Alt") {
      return;
    }
    if (Date.now() < state.commandGuardUntil) return;
    handleSelection();
  }

  function onMouseDown(event: MouseEvent): void {
    if (isInUi(event)) return;
    state.pointer = {
      x: event.clientX,
      y: event.clientY,
      selection: selectedText()
    };
    if (isInteractive(event.target)) {
      state.blockedSelection = selectedText();
      hideUi();
      return;
    }
    state.blockedSelection = "";
    hideUi();
  }

  function onPointerDown(event: PointerEvent): void {
    if (isInUi(event) || !isInteractive(event.target)) return;
    state.blockedSelection = selectedText();
    hideUi();
  }

  function onDocumentClick(event: MouseEvent): void {
    if (isInUi(event) || !isInteractive(event.target)) return;
    state.blockedSelection = selectedText() || state.lastText;
    hideUi();
    window.setTimeout(() => {
      if (state.blockedSelection && selectedText() === state.blockedSelection) {
        window.getSelection()?.removeAllRanges();
      }
      state.blockedSelection = "";
      state.lastText = "";
    }, 0);
  }

  function onScroll(event: Event): void {
    if (isInUi(event) || card.hidden) return;
    if (state.scrollRaf) return;
    state.scrollRaf = window.requestAnimationFrame(() => {
      state.scrollRaf = 0;
      if (card.hidden) return;
      if (refreshSelectionRect()) placeCard(true);
      else hideUi();
    });
  }

  function onResize(): void {
    if (!card.hidden) placeCard(true);
  }

  function onSelectionChange(): void {
    if (card.hidden && !state.autoTimer) return;
    if (state.blockedSelection && selectedText() === state.blockedSelection) return;
    if (!selectedText()) scheduleHide();
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape" && !card.hidden) hideUi();
  }

  function handleSelection(): void {
    const text = selectedText();
    if (state.blockedSelection && text === state.blockedSelection) {
      hideUi();
      return;
    }
    if (!text) {
      hideUi();
      return;
    }
    if (state.settings.skipInputs && isEditable(document.activeElement)) return;
    captureSelection();
    state.lastText = text;
    if (shouldHideTranslation(sourceSelect.value || state.settings.sourceLang, targetSelect.value || state.settings.targetLang)) {
      hideUi();
      return;
    }
    if (state.settings.trigger !== "auto") return;
    scheduleAutoTranslate(text);
  }

  function scheduleAutoTranslate(text: string): void {
    clearAutoTimer();
    state.autoTimer = window.setTimeout(() => {
      state.autoTimer = 0;
      const current = selectedText();
      if (!current || current !== text) return;
      void translateNow(current);
    }, AUTO_TRANSLATE_DEBOUNCE_MS);
  }

  function clearAutoTimer(): void {
    if (state.autoTimer) {
      window.clearTimeout(state.autoTimer);
      state.autoTimer = 0;
    }
  }

  function selectedText(): string {
    const active = document.activeElement;
    if (
      (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) &&
      typeof active.selectionStart === "number" &&
      typeof active.selectionEnd === "number" &&
      active.selectionStart !== active.selectionEnd
    ) {
      return active.value.slice(active.selectionStart, active.selectionEnd).replace(/\s+/g, " ").trim();
    }
    const selection = window.getSelection();
    return selection ? selection.toString().replace(/\s+/g, " ").trim() : "";
  }

  function captureSelection(): void {
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
      state.lastRangeRect = active.getBoundingClientRect();
      return;
    }
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    state.lastRangeRect = selection.getRangeAt(0).getBoundingClientRect();
  }

  function refreshSelectionRect(): boolean {
    const active = document.activeElement;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
      if (!selectedText()) return false;
      state.lastRangeRect = active.getBoundingClientRect();
      return true;
    }
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !selectedText()) return false;
    state.lastRangeRect = selection.getRangeAt(0).getBoundingClientRect();
    return true;
  }

  function isInteractive(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest("button, a, input, textarea, select, summary, [role='button'], [role='link'], [role='menuitem']"));
  }

  function isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;
    const el = target.closest("input, textarea, select, [contenteditable='true'], [contenteditable='']");
    return Boolean(el && isEditable(el));
  }

  function isEditable(el: Element | null): boolean {
    if (!el) return false;
    const tag = el.tagName;
    return (
      (el as HTMLElement).isContentEditable ||
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT"
    );
  }

  async function translateNow(text: string): Promise<void> {
    const query = String(text || "").trim();
    if (!query) return;
    if (shouldHideTranslation(sourceSelect.value || state.settings.sourceLang, targetSelect.value || state.settings.targetLang)) {
      hideUi();
      return;
    }
    clearAutoTimer();
    ensureLanguagesReady();
    state.lastText = query;
    const requestId = ++state.requestId;
    card.hidden = false;
    body.innerHTML = `
      <div class="block" data-no-speak="1">
        <div class="source">${escapeHtml(query)}</div>
      </div>
      <div class="status" role="status" aria-live="polite">${escapeHtml(t("bubbleTranslating", state.settings))}</div>
    `;
    moreLink.href = googleTranslateUrl(query, sourceSelect.value, targetSelect.value);
    placeCard();

    try {
      const response = await withTimeout(
        chrome.runtime.sendMessage({
          type: "TRANSLATE",
          text: query,
          sourceLang: sourceSelect.value || state.settings.sourceLang,
          targetLang: targetSelect.value || state.settings.targetLang,
          requestId
        }),
        TRANSLATE_TIMEOUT_MS,
        t("errorTimeout", state.settings)
      );
      if (requestId !== state.requestId) return;
      if (!response?.ok) throw new Error(response?.error || t("popupFailed", state.settings));
      const result = response.result as TranslateResult;
      if (!result?.translated?.trim()) throw new Error(t("errorMissing", state.settings));
      if (shouldHideTranslation(result.sourceLang, result.targetLang, result.original, result.translated)) {
        hideUi();
        return;
      }
      if (requestId !== state.requestId || card.hidden) return;
      renderResult(result);
      placeCard();
    } catch (error) {
      if (requestId !== state.requestId || card.hidden) return;
      const message = error instanceof Error ? error.message : t("popupFailed", state.settings);
      body.innerHTML = `
        <div class="block" data-no-speak="1">
          <div class="source">${escapeHtml(query)}</div>
        </div>
        <div class="status error" role="status" aria-live="polite">${escapeHtml(message)}</div>
      `;
    }
  }

  function renderResult(result: TranslateResult): void {
    if (result.targetLang) targetSelect.value = result.targetLang;
    const locale = state.settings.uiLocale;
    const targetLabel = languageBanner(result.targetLang);
    const dictionary = (result.dictionary || [])
      .filter((item) => item.pos && item.terms?.length)
      .slice(0, 4);
    const warning = result.warning ? `<div class="warning">${escapeHtml(result.warning)}</div>` : "";
    const dictHtml = dictionary
      .map((item) => {
        const terms = item.terms.slice(0, 4).join(", ");
        return `<div class="row"><span class="pos">${escapeHtml(item.pos)}</span><span class="terms">${escapeHtml(terms)}</span></div>`;
      })
      .join("");
    const showSpeak = state.settings.enableTts !== false;

    body.innerHTML = `
      ${warning}
      <div class="block" ${showSpeak ? "" : 'data-no-speak="1"'}>
        ${showSpeak ? `<button class="speak" data-text="${escapeAttr(result.original)}" data-lang="${escapeAttr(result.sourceLang)}" title="${escapeAttr(t("bubbleSpeakSource", locale))}" aria-label="${escapeAttr(t("bubbleSpeakSource", locale))}">${speakerIcon()}</button>` : `<span class="speak-spacer"></span>`}
        <div class="source">${escapeHtml(result.original)}</div>
      </div>
      ${targetLabel ? `<div class="banner">${escapeHtml(targetLabel)}</div>` : ""}
      <div class="block translated" ${showSpeak ? "" : 'data-no-speak="1"'}>
        ${showSpeak ? `<button class="speak" data-text="${escapeAttr(result.translated)}" data-lang="${escapeAttr(result.targetLang)}" title="${escapeAttr(t("bubbleSpeakTarget", locale))}" aria-label="${escapeAttr(t("bubbleSpeakTarget", locale))}">${speakerIcon()}</button>` : `<span class="speak-spacer"></span>`}
        <div class="target" role="status" aria-live="polite">${escapeHtml(result.translated)}</div>
      </div>
      ${dictHtml}
    `;
    state.cachedCardHeight = card.scrollHeight || state.cachedCardHeight;

    moreLink.href = googleTranslateUrl(result.original, result.sourceLang, result.targetLang);
    body.querySelectorAll<HTMLButtonElement>(".speak").forEach((button) => {
      button.addEventListener("click", () => {
        void speakFromButton(button);
      });
    });
  }

  async function speakFromButton(button: HTMLButtonElement): Promise<void> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "SPEAK",
        text: button.dataset.text,
        lang: button.dataset.lang
      });
      if (response && response.ok === false) {
        throw new Error(response.error || t("errorSpeak", state.settings));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t("errorSpeak", state.settings);
      body.insertAdjacentHTML(
        "afterbegin",
        `<div class="status error" role="status" aria-live="polite">${escapeHtml(message)}</div>`
      );
      window.setTimeout(() => {
        body.querySelector(".status.error")?.remove();
      }, 2500);
    }
  }

  function placeCard(reuseHeight = false): void {
    const rect = state.lastRangeRect || { left: 24, top: 24, right: 24, bottom: 24, width: 0, height: 0 };
    const width = Math.min(380, Math.max(200, window.innerWidth - 24));
    const estimatedHeight = reuseHeight
      ? state.cachedCardHeight || 220
      : card.scrollHeight || state.cachedCardHeight || 220;
    if (!reuseHeight) state.cachedCardHeight = estimatedHeight;
    card.style.width = `${width}px`;
    let left = rect.left + rect.width / 2 - width / 2;
    left = clamp(left, 12, Math.max(12, window.innerWidth - width - 12));
    const spaceAbove = rect.top;
    const showBelow = spaceAbove < estimatedHeight + 24;
    let top = showBelow ? rect.bottom + 14 : rect.top - estimatedHeight - 14;
    top = clamp(top, 12, Math.max(12, window.innerHeight - Math.min(estimatedHeight, window.innerHeight - 24)));
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
    card.classList.toggle("below", showBelow);
    card.classList.toggle("above", !showBelow);
    const arrowLeft = rect.left + rect.width / 2 - left - 8;
    arrow.style.left = `${clamp(arrowLeft, 18, Math.max(18, width - 28))}px`;
  }

  function hideUi(): void {
    state.requestId += 1;
    clearAutoTimer();
    window.clearTimeout(state.mouseUpTimer);
    state.mouseUpTimer = 0;
    if (state.scrollRaf) {
      window.cancelAnimationFrame(state.scrollRaf);
      state.scrollRaf = 0;
    }
    card.hidden = true;
  }

  function scheduleHide(): void {
    window.clearTimeout(state.hideTimer);
    state.hideTimer = window.setTimeout(() => {
      if (!selectedText()) hideUi();
    }, 200);
  }

  async function loadSettings(): Promise<void> {
    try {
      const stored = (await chrome.storage.sync.get(toStorage(DEFAULTS))) as Partial<Settings>;
      state.settings = { ...DEFAULTS, ...stored };
    } catch {
      try {
        const response = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
        if (response?.ok) state.settings = { ...DEFAULTS, ...response.settings };
      } catch {
        state.settings = { ...DEFAULTS };
      }
    }
    sourceSelect.value = state.settings.sourceLang || "auto";
    targetSelect.value = state.settings.targetLang || "zh-TW";
    syncSwapState();
  }
}

function must<T>(value: T | null): T {
  if (!value) throw new Error("Missing bubble element");
  return value;
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function speakerIcon(): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zm-2.5-8.5v2.1A7.4 7.4 0 0 1 21 12a7.4 7.4 0 0 1-6 6.4v2.1A9.5 9.5 0 0 0 23 12a9.5 9.5 0 0 0-8-8.5z"/></svg>`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function bubbleStyles(): string {
  return `
      :host {
        --st-bg: #f0f4f9;
        --st-surface: #ffffff;
        --st-surface2: #f8fafc;
        --st-text: #1f1f1f;
        --st-muted: #5f6368;
        --st-border: #dbe1ea;
        --st-accent: #0b57d0;
        --st-accent-text: #ffffff;
        --st-success: #137333;
        --st-danger: #b3261e;
        --st-shadow: 0 8px 28px rgba(0,0,0,.28), 0 0 1px rgba(0,0,0,.18);
        color-scheme: light;
      }
      :host([data-theme="dark"]) { color-scheme: dark; }
      * { box-sizing: border-box; font-family: "Google Sans", "Noto Sans", "Segoe UI", Arial, sans-serif; }
      .card {
        position: fixed;
        z-index: 2147483647;
        pointer-events: auto;
        width: min(380px, calc(100vw - 24px));
        max-width: calc(100vw - 24px);
        overflow: visible;
        background: var(--st-surface);
        color: var(--st-text);
        border-radius: 8px;
        box-shadow: var(--st-shadow);
        padding: 10px 12px 8px;
      }
      .arrow {
        position: absolute;
        width: 14px;
        height: 14px;
        background: var(--st-surface);
        transform: rotate(45deg);
      }
      .card.below .arrow { top: -7px; box-shadow: -1px -1px 1px rgba(0,0,0,.06); }
      .card.above .arrow { bottom: -7px; box-shadow: 1px 1px 1px rgba(0,0,0,.06); }
      .toolbar { display: flex; align-items: center; gap: 8px; }
      .lang {
        flex: 1;
        min-width: 0;
        height: 32px;
        border: 1px solid var(--st-border);
        border-radius: 4px;
        background: var(--st-surface);
        color: var(--st-text);
        padding: 0 4px;
        font-size: 12px;
      }
      .swap { font-size: 16px; width: 24px; height: 28px; }
      .icon-btn {
        width: 28px;
        height: 28px;
        border: 0;
        background: transparent;
        color: var(--st-muted);
        font-size: 20px;
        line-height: 1;
        cursor: pointer;
        border-radius: 50%;
      }
      .icon-btn:hover { background: var(--st-surface2); }
      .body {
        padding: 10px 2px 6px;
        max-height: min(60vh, 420px);
        overflow-y: auto;
      }
      .status { color: var(--st-muted); font-size: 13px; padding: 8px 0; }
      .status.error { color: var(--st-danger); }
      .warning { color: #b06000; font-size: 12px; margin-bottom: 8px; }
      .block {
        display: grid;
        grid-template-columns: 24px 1fr;
        gap: 8px;
        align-items: start;
        margin-bottom: 6px;
      }
      .block[data-no-speak="1"] { grid-template-columns: 1fr; }
      .speak-spacer { display: none; }
      .icon-btn:focus-visible,
      .speak:focus-visible,
      .link:focus-visible,
      .lang:focus-visible {
        outline: 2px solid var(--st-accent);
        outline-offset: 2px;
      }
      .source, .target { font-size: 16px; line-height: 1.4; word-break: break-word; }
      .target { color: var(--st-accent); font-weight: 500; }
      .banner {
        color: var(--st-muted);
        font-size: 11px;
        letter-spacing: .4px;
        margin: 2px 0 8px 32px;
      }
      .row {
        display: grid;
        grid-template-columns: 88px 1fr;
        gap: 10px;
        padding: 4px 0 4px 32px;
        font-size: 13px;
      }
      .pos { color: var(--st-muted); font-style: italic; }
      .terms { color: var(--st-text); }
      .speak {
        width: 24px;
        height: 24px;
        border: 0;
        padding: 0;
        background: transparent;
        cursor: pointer;
        color: var(--st-muted);
      }
      .speak svg { width: 18px; height: 18px; fill: currentColor; }
      .speak:hover { color: var(--st-accent); }
      .footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-top: 8px;
        border-top: 1px solid var(--st-border);
        margin-top: 4px;
      }
      .link {
        border: 0;
        background: transparent;
        color: var(--st-muted);
        font-size: 11px;
        letter-spacing: .3px;
        text-decoration: none;
        cursor: pointer;
        padding: 0;
      }
      .link:hover { color: var(--st-accent); }
  `;
}
