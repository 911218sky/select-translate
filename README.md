# Select Translate

[English](README.md) · [繁體中文](README.zh-TW.md)

A Chrome extension that translates selected text in a compact Google Translate-style bubble.

Select a word or sentence on any page. The bubble shows the original text, translation, part of speech, speaker buttons, and language menus.

<p align="center">
  <img src="icons/icon128.png" width="96" height="96" alt="Select Translate icon">
</p>

## Features

- Translate as soon as you select text, or only via right-click / `Alt+T`
- Choose source and target languages in the bubble
- Skip the bubble when the source and target languages match, or the text is already in the target language
- Speak with Google Translate’s voice (`translate.google.com/translate_tts`)
- Optional OpenAI, Claude, or Gemini-compatible LLM endpoint
- Light, dark, system, or Chrome theme colors, plus a custom accent
- English and Traditional Chinese UI (English by default)
- Toolbar popup, right-click menu, and `Alt+T`

Translation uses Google’s public `translate.googleapis.com` endpoint. That API is unofficial, so the extension falls back to MyMemory if Google is unavailable. Single words usually include dictionary rows; longer sentences usually return only the translation.

## Install from GitHub

1. Open the latest [Release](https://github.com/911218sky/select-translate/releases/latest)
2. Download `select-translate-*.zip`
3. Unzip it
4. Open `chrome://extensions`
5. Turn on **Developer mode**
6. Click **Load unpacked** and choose the unzipped folder

Pushing a `v*` tag runs GitHub Actions, packs the extension, and attaches the zip to the release.

## Load from source

```bash
git clone https://github.com/911218sky/select-translate.git
cd select-translate
npm install
npm test
npm run icons
npm run pack
```

Then load `dist/extension` in `chrome://extensions`.

For local development you can also load the repository root after `npm run build`. Reload the extension and refresh the page after code changes.

## Usage

1. Select text on a page
2. Read the translation in the bubble
3. Change languages or tap a speaker
4. Open **Extension options** for theme, UI language, and trigger settings

If the source and target languages are the same, the bubble stays hidden.

## Permissions

- `storage` remembers languages, theme, and trigger settings
- `contextMenus` adds the right-click translate action
- `activeTab` / `scripting` inject the bubble on the current tab when needed
- `offscreen` plays speech
- Host access to `translate.googleapis.com`, `translate.google.com`, and `api.mymemory.translated.net`

## Development

```bash
npm test          # parser, theme, i18n, and TTS URL tests
npm run typecheck # TypeScript
npm run build     # bundle src/*/index.ts into src/*/index.js
npm run pack      # release zip in dist/
npm run icons     # regenerate PNG icons from icons/icon.svg
```

### Layout

```text
src/                 extension source
  background/        service worker
  content/           page bubble
  popup/             toolbar popup
  options/           settings page
  offscreen/         TTS playback
  lib/               shared types, i18n, theme, LLM, helpers
  styles/            shared CSS
icons/               shipped extension icons
_locales/            Chrome store / manifest strings
scripts/             build + icon tooling
tests/               unit tests
examples/            local demo page
design/              design drafts (not packaged)
```

`esbuild` bundles each entry into an IIFE that Chrome can load. `_locales/` and `icons/` stay at the repo root because Chrome expects them next to `manifest.json`.

## License

[MIT](LICENSE)
