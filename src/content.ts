import type { Settings, TranslateResult } from "./types.ts";
import {
  DEFAULTS,
  escapeAttr,
  escapeHtml,
  googleTranslateUrl,
  languageBanner,
  languageOptionsHtml,
  sameLanguage
} from "./shared.ts";
import { t } from "./i18n.ts";
import { watch } from "./theme.ts";

if (!window.__SELECT_TRANSLATE_LOADED__) {
  window.__SELECT_TRANSLATE_LOADED__ = true;
  boot();
}

function boot(): void {
  const HOST_ID = "select-translate-root";
  const state = {
    settings: { ...DEFAULTS } as Settings,
    lastText: "",
    lastRangeRect: null as DOMRect | null,
    hideTimer: 0,
    requestId: 0
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
    <button class="fab" hidden>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5h9v2H9.7A12.4 12.4 0 0 0 13 12.1l1.6-1.6 1.4 1.4-4 4-1.4-1.4 1.7-1.7A10.4 10.4 0 0 1 8.3 7H4V5zm12.5 3H21v2h-2.2l-2.6 7h-2.2l2.3-6.1L14.2 8h2.3z"/>
      </svg>
    </button>
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

  const fab = must(shadow.querySelector<HTMLButtonElement>(".fab"));
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
    paintChrome();
    watch(host);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    for (const [key, value] of Object.entries(changes)) {
      (state.settings as unknown as Record<string, unknown>)[key] = value.newValue;
    }
    if (changes.sourceLang) sourceSelect.value = String(changes.sourceLang.newValue || "auto");
    if (changes.targetLang) targetSelect.value = String(changes.targetLang.newValue || "zh-TW");
    if (changes.uiLocale) paintChrome();
  });

  document.addEventListener("mouseup", onMouseUp, true);
  document.addEventListener("keyup", onKeyUp, true);
  document.addEventListener("mousedown", onMouseDown, true);
  document.addEventListener("scroll", onScroll, true);
  window.addEventListener("resize", hideUi);
  document.addEventListener("selectionchange", () => {
    if (!selectedText()) scheduleHide();
  });

  fab.addEventListener("mousedown", (event) => event.preventDefault());
  fab.addEventListener("click", () => void translateNow(state.lastText));
  closeBtn.addEventListener("click", hideUi);
  optionsBtn.addEventListener("click", () => {
    void chrome.runtime.sendMessage({ type: "OPEN_OPTIONS" });
  });
  sourceSelect.addEventListener("change", async () => {
    state.settings.sourceLang = sourceSelect.value;
    await chrome.storage.sync.set({ sourceLang: sourceSelect.value });
    if (state.lastText) await translateNow(state.lastText);
  });
  targetSelect.addEventListener("change", async () => {
    state.settings.targetLang = targetSelect.value;
    await chrome.storage.sync.set({ targetLang: targetSelect.value });
    if (state.lastText) await translateNow(state.lastText);
  });
  swapBtn.addEventListener("click", async () => {
    if (sourceSelect.value === "auto") return;
    const nextSource = targetSelect.value;
    const nextTarget = sourceSelect.value;
    sourceSelect.value = nextSource;
    targetSelect.value = nextTarget;
    state.settings.sourceLang = nextSource;
    state.settings.targetLang = nextTarget;
    await chrome.storage.sync.set({ sourceLang: nextSource, targetLang: nextTarget });
    if (state.lastText) await translateNow(state.lastText);
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== "TRANSLATE_SELECTION") return;
    const text = String(message.text || selectedText()).trim();
    if (!text) return;
    captureSelection();
    void translateNow(text);
  });

  function paintChrome(): void {
    const locale = state.settings.uiLocale;
    fab.title = t("bubbleTranslate", locale);
    fab.setAttribute("aria-label", t("bubbleTranslate", locale));
    sourceSelect.setAttribute("aria-label", t("bubbleSourceLang", locale));
    targetSelect.setAttribute("aria-label", t("bubbleTargetLang", locale));
    swapBtn.title = t("bubbleSwap", locale);
    swapBtn.setAttribute("aria-label", t("bubbleSwap", locale));
    closeBtn.title = t("bubbleClose", locale);
    closeBtn.setAttribute("aria-label", t("bubbleClose", locale));
    optionsBtn.textContent = t("bubbleOptions", locale);
    moreLink.textContent = t("bubbleMore", locale);
    fillLanguageSelects();
  }

  function fillLanguageSelects(): void {
    const locale = state.settings.uiLocale;
    const sourceValue = sourceSelect.value || state.settings.sourceLang || "auto";
    const targetValue = targetSelect.value || state.settings.targetLang || "zh-TW";
    sourceSelect.innerHTML = languageOptionsHtml(true, locale);
    targetSelect.innerHTML = languageOptionsHtml(false, locale);
    sourceSelect.value = sourceValue;
    targetSelect.value = targetValue;
  }

  function isInUi(event: Event): boolean {
    return event.target === host || Boolean(event.composedPath?.().includes(host));
  }

  function onMouseUp(event: MouseEvent): void {
    if (event.button !== 0) return;
    if (isInUi(event)) return;
    window.setTimeout(() => handleSelection(event), 10);
  }

  function onKeyUp(event: KeyboardEvent): void {
    if (event.key !== "Shift" && event.key !== "Control" && event.key !== "Meta" && event.key !== "Alt") {
      return;
    }
    handleSelection();
  }

  function onMouseDown(event: MouseEvent): void {
    if (isInUi(event)) return;
    hideUi();
  }

  function onScroll(event: Event): void {
    if (isInUi(event)) return;
    hideUi();
  }

  function handleSelection(event?: MouseEvent): void {
    const text = selectedText();
    if (!text) {
      hideUi();
      return;
    }
    if (state.settings.skipInputs && isEditable(document.activeElement)) return;
    captureSelection();
    state.lastText = text;
    if (sameLanguage(sourceSelect.value, targetSelect.value)) {
      hideUi();
      return;
    }
    if (state.settings.trigger === "auto") {
      void translateNow(text);
      return;
    }
    showFab(event);
  }

  function selectedText(): string {
    const selection = window.getSelection();
    return selection ? selection.toString().replace(/\s+/g, " ").trim() : "";
  }

  function captureSelection(): void {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    state.lastRangeRect = selection.getRangeAt(0).getBoundingClientRect();
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

  function showFab(event?: MouseEvent): void {
    card.hidden = true;
    fab.hidden = false;
    const x = event?.clientX ?? (state.lastRangeRect?.right || 24);
    const y = event?.clientY ?? (state.lastRangeRect?.bottom || 24);
    place(fab, x + 8, y + 8);
  }

  async function translateNow(text: string): Promise<void> {
    const query = String(text || "").trim();
    if (!query) return;
    if (sameLanguage(sourceSelect.value, targetSelect.value)) {
      hideUi();
      return;
    }
    state.lastText = query;
    const requestId = ++state.requestId;
    fab.hidden = true;
    card.hidden = false;
    body.innerHTML = `<div class="status">${escapeHtml(t("bubbleTranslating", state.settings))}</div>`;
    moreLink.href = googleTranslateUrl(query, sourceSelect.value, targetSelect.value);
    placeCard();

    try {
      const response = await chrome.runtime.sendMessage({
        type: "TRANSLATE",
        text: query,
        sourceLang: sourceSelect.value || state.settings.sourceLang,
        targetLang: targetSelect.value || state.settings.targetLang
      });
      if (requestId !== state.requestId) return;
      if (!response?.ok) throw new Error(response?.error || t("popupFailed", state.settings));
      const result = response.result as TranslateResult;
      if (sameLanguage(result.sourceLang, result.targetLang)) {
        hideUi();
        return;
      }
      renderResult(result);
      placeCard();
    } catch (error) {
      if (requestId !== state.requestId) return;
      const message = error instanceof Error ? error.message : t("popupFailed", state.settings);
      body.innerHTML = `<div class="status error">${escapeHtml(message)}</div>`;
    }
  }

  function renderResult(result: TranslateResult): void {
    if (result.sourceLang) sourceSelect.value = result.sourceLang;
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

    body.innerHTML = `
      ${warning}
      <div class="block">
        <button class="speak" data-text="${escapeAttr(result.original)}" data-lang="${escapeAttr(result.sourceLang)}" title="${escapeAttr(t("bubbleSpeakSource", locale))}" aria-label="${escapeAttr(t("bubbleSpeakSource", locale))}">${speakerIcon()}</button>
        <div class="source">${escapeHtml(result.original)}</div>
      </div>
      ${targetLabel ? `<div class="banner">${escapeHtml(targetLabel)}</div>` : ""}
      <div class="block translated">
        <button class="speak" data-text="${escapeAttr(result.translated)}" data-lang="${escapeAttr(result.targetLang)}" title="${escapeAttr(t("bubbleSpeakTarget", locale))}" aria-label="${escapeAttr(t("bubbleSpeakTarget", locale))}">${speakerIcon()}</button>
        <div class="target">${escapeHtml(result.translated)}</div>
      </div>
      ${dictHtml}
    `;

    moreLink.href = googleTranslateUrl(result.original, result.sourceLang, result.targetLang);
    body.querySelectorAll<HTMLButtonElement>(".speak").forEach((button) => {
      button.addEventListener("click", () => {
        void chrome.runtime.sendMessage({
          type: "SPEAK",
          text: button.dataset.text,
          lang: button.dataset.lang
        });
      });
    });
  }

  function placeCard(): void {
    const rect = state.lastRangeRect || { left: 24, top: 24, right: 24, bottom: 24, width: 0, height: 0 };
    const width = 380;
    const estimatedHeight = card.scrollHeight || 220;
    let left = rect.left + rect.width / 2 - width / 2;
    left = clamp(left, 12, window.innerWidth - width - 12);
    const spaceAbove = rect.top;
    const showBelow = spaceAbove < estimatedHeight + 24;
    let top = showBelow ? rect.bottom + 14 : rect.top - estimatedHeight - 14;
    top = clamp(top, 12, window.innerHeight - Math.min(estimatedHeight, window.innerHeight - 12));
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
    card.classList.toggle("below", showBelow);
    card.classList.toggle("above", !showBelow);
    const arrowLeft = rect.left + rect.width / 2 - left - 8;
    arrow.style.left = `${clamp(arrowLeft, 18, width - 28)}px`;
  }

  function place(el: HTMLElement, clientX: number, clientY: number): void {
    el.style.left = `${clamp(clientX, 8, window.innerWidth - 44)}px`;
    el.style.top = `${clamp(clientY, 8, window.innerHeight - 44)}px`;
  }

  function hideUi(): void {
    fab.hidden = true;
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
      const response = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
      if (response?.ok) state.settings = { ...DEFAULTS, ...response.settings };
    } catch {
      state.settings = { ...DEFAULTS };
    }
    sourceSelect.value = state.settings.sourceLang || "auto";
    targetSelect.value = state.settings.targetLang || "zh-TW";
  }
}

function must<T>(value: T | null): T {
  if (!value) throw new Error("Missing bubble element");
  return value;
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
      .fab, .card {
        position: fixed;
        z-index: 2147483647;
        pointer-events: auto;
      }
      .fab {
        width: 32px;
        height: 32px;
        border: 0;
        border-radius: 4px;
        background: var(--st-surface);
        box-shadow: var(--st-shadow);
        cursor: pointer;
        display: grid;
        place-items: center;
        padding: 0;
      }
      .fab svg { width: 20px; height: 20px; fill: var(--st-accent); }
      .fab:hover { background: var(--st-surface2); }
      .card {
        width: 380px;
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
      .body { padding: 10px 2px 6px; }
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
      .source, .target { font-size: 16px; line-height: 1.4; word-break: break-word; }
      .target { color: var(--st-success); font-weight: 500; }
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
