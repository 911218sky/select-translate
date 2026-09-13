# AGENTS.md — select-translate

Guidance for humans and coding agents working on this repo.

## What this is

Chrome MV3 extension: select text → compact Google Translate–style bubble (dictionary rows, TTS, language menus). Optional OpenAI / Claude / Gemini-compatible LLM. UI: English + Traditional Chinese.

Unofficial Google Translate HTTP API primary; MyMemory fallback; LLM optional via options.

## Prerequisites

- **Node.js ≥ 22** (`package.json` `engines`). Tests use `node --experimental-strip-types` and fail on Node 20.
- `npm install`
- `python3` required for `npm run pack` (zip via `shutil.make_archive`)

## Commands

| Command | Purpose |
|---------|---------|
| `npm test` | Unit tests (`tests/*.test.ts`) |
| `npm run typecheck` | `tsc --noEmit` on `src/` only |
| `npm run build` | Bundle each `src/*/index.ts` → `src/*/index.js` (gitignored) |
| `npm run icons` | PNG icons from `icons/icon.svg` |
| `npm run pack` | Bundle + copy to `dist/extension` + zip |

Load **`dist/extension`** for release-like testing, or repo root after `npm run build` for local reload. After TS edits: rebuild, reload extension, refresh the page.

## Layout

```
manifest.json          # MV3; points at src/*/index.js (and HTML under src/)
src/
  background/          # SW: translate, TTS, menus, inject, offscreen
  content/             # Selection bubble (closed shadow DOM)
  popup/ options/ offscreen/
  lib/                 # shared, llm, theme, i18n, i18n-content, types
  styles/ui.css        # popup/options (not content bubble CSS)
_locales/              # chrome.i18n for store name/description
scripts/build.mjs      # esbuild + pack
tests/shared.test.ts   # mostly pure helpers in shared/llm/i18n
.agents-teams/         # LOCAL ONLY (gitignored) — agent team scratchpads
```

Keep the entry-per-context shape. Prefer small splits inside `lib/` over new deep trees.

## Source of truth

- Edit **`.ts`**, never the generated `src/**/*.js` (gitignored build output).
- Keep `package.json` `version` and `manifest.json` `version` in sync (release workflow checks tags; PRs do not yet).
- Content bubble strings: `src/lib/i18n-content.ts`. Popup/options/background: `src/lib/i18n.ts`. Overlapping keys must stay identical.
- Content styles live as a string in `src/content/index.ts` (closed shadow). Popup/options use `src/styles/ui.css`.

## Messaging & runtime notes

- Translate / speak go through the background service worker; content/popup send messages.
- One global in-flight translate abort (`activeTranslate`) and one TTS audio slot (`pendingTtsAudio`) — concurrent tabs/popup can race (see known issues).
- Content scripts: `all_frames: false` — auto-select does not run inside iframes; context menu / `Alt+T` can still target a frame with selection.
- Host permissions cover Google / MyMemory / major LLM hosts; custom LLM base URLs need optional host permission grants.

## Testing expectations

- Prefer extracting pure functions and testing them (pattern in `tests/shared.test.ts`).
- `typecheck` does **not** include `tests/` — keep test imports valid manually or extend tsconfig when adding tests.
- Do not assume Node 20 works for `npm test`.

## Agent team scratchpads

Parallel agent discussion and review logs belong in **`.agents-teams/`** (gitignored). Append-only shared markdown (e.g. `REVIEW_LOG.md`) so interrupted subagents leave recoverable progress. Never commit that folder.

## Known issues / tech debt (remaining)

Fixed in the 2026-09 review follow-up: Latin/Han auto-hide, TTS audioId, keyed translate abort, LLM fetch timeout merge, popup `enableTts`, language-pick window, AbortError UI, truncation display, chrome theme stamp, options escape imports.

Still open (non-blocking):

1. Build still writes bundles into `src/` — prefer `dist/`-only long-term.
2. `shared.ts` / `content/index.ts` size — split lightly when next touching those areas.
3. Tests still cover mostly pure helpers; background/content HTTP untested.
4. Content scripts `all_frames: false` — auto-select ignores iframe text (context menu / Alt+T can still reach frames).
5. CI could assert version sync and icon PNG drift.

## Change preferences

- Match existing style: plain TypeScript, no framework, esbuild IIFE bundles.
- Small, focused diffs; avoid drive-by refactors unless asked.
- Do not commit secrets, `node_modules`, `dist/`, or `.agents-teams/`.
- Do not force-add `src/**/*.js`.
- User-facing copy: keep EN + zh-TW in sync across both i18n modules when keys overlap.
