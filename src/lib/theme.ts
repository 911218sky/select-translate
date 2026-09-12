import type { ChromeThemeLike, Settings, ThemeTokens } from "./types.ts";
import { DEFAULTS, applyTheme, toStorage } from "./shared.ts";

type WatchHandles = {
  onStorage?: (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => void;
  onTheme?: () => void;
  onMedia?: () => void;
  media?: MediaQueryList;
};

const watches = new WeakMap<HTMLElement, WatchHandles>();

async function chromeTheme(): Promise<ChromeThemeLike | null> {
  try {
    if ("theme" in chrome) {
      return await chrome.theme.getCurrent();
    }
  } catch {
    /* ignore */
  }
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_CHROME_THEME" });
    if (response?.ok) return response.theme ?? null;
  } catch {
    /* ignore */
  }
  return null;
}

async function currentSettings(): Promise<Settings> {
  if (!globalThis.chrome?.storage?.sync) return { ...DEFAULTS };
  return { ...DEFAULTS, ...((await chrome.storage.sync.get(toStorage(DEFAULTS))) as unknown as Partial<Settings>) };
}

export async function apply(root: HTMLElement = document.documentElement): Promise<ThemeTokens> {
  const settings = await currentSettings();
  const theme = settings.appearance === "chrome" ? await chromeTheme() : null;
  return applyTheme(settings, theme, root);
}

export function watch(root: HTMLElement = document.documentElement): void {
  unwatch(root);
  void apply(root);
  const handles: WatchHandles = {};
  const hasThemeApi = "theme" in chrome && Boolean(chrome.theme?.onChanged);

  if (globalThis.chrome?.storage?.onChanged) {
    handles.onStorage = (changes, area) => {
      if (area === "sync" && (changes.appearance || changes.accentColor)) void apply(root);
      // Stamp is only needed when this context cannot listen to chrome.theme directly.
      if (!hasThemeApi && area === "local" && changes.chromeThemeStamp) void apply(root);
    };
    chrome.storage.onChanged.addListener(handles.onStorage);
  }

  if (hasThemeApi) {
    handles.onTheme = () => {
      void apply(root);
    };
    chrome.theme.onChanged.addListener(handles.onTheme);
  }

  if (window.matchMedia) {
    handles.media = window.matchMedia("(prefers-color-scheme: dark)");
    handles.onMedia = () => {
      void currentSettings().then((settings) => {
        if (settings.appearance === "system") void apply(root);
      });
    };
    if (handles.media.addEventListener) handles.media.addEventListener("change", handles.onMedia);
    else handles.media.addListener(handles.onMedia);
  }

  watches.set(root, handles);
}

export function unwatch(root: HTMLElement = document.documentElement): void {
  const handles = watches.get(root);
  if (!handles) return;
  if (handles.onStorage && globalThis.chrome?.storage?.onChanged) {
    chrome.storage.onChanged.removeListener(handles.onStorage);
  }
  if (handles.onTheme && "theme" in chrome && chrome.theme?.onChanged) {
    chrome.theme.onChanged.removeListener(handles.onTheme);
  }
  if (handles.media && handles.onMedia) {
    if (handles.media.removeEventListener) handles.media.removeEventListener("change", handles.onMedia);
    else handles.media.removeListener(handles.onMedia);
  }
  watches.delete(root);
}

export { chromeTheme };
