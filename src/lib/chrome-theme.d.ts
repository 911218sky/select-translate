export {};

declare global {
  namespace chrome {
    namespace theme {
      interface Theme {
        colors?: Record<string, number[] | string | undefined>;
      }

      const onChanged: chrome.events.Event<() => void>;
      function getCurrent(): Promise<Theme>;
    }
  }
}
