import type { ChromeThemeLike, Settings, ThemeTokens } from "./types.ts";
import { DEFAULTS, applyTheme, toStorage } from "./shared.ts";

let media: MediaQueryList | null = null;

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
  void apply(root);
  if (globalThis.chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "sync" && (changes.appearance || changes.accentColor)) void apply(root);
      if (area === "local" && changes.chromeThemeStamp) void apply(root);
    });
  }
  if ("theme" in chrome && chrome.theme.onChanged) {
    chrome.theme.onChanged.addListener(() => {
      void apply(root);
    });
  }
  if (window.matchMedia) {
    media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      void apply(root);
    };
    if (media.addEventListener) media.addEventListener("change", onChange);
    else media.addListener(onChange);
  }
}

export { chromeTheme };
