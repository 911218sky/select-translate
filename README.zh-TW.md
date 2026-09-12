# 選字翻譯

[English](README.md) · [繁體中文](README.zh-TW.md)

在網頁上選取文字後，跳出類似 Google 翻譯的氣泡：原文、譯文、詞性、喇叭，以及語言選單。

<p align="center">
  <img src="icons/icon128.png" width="96" height="96" alt="選字翻譯圖示">
</p>

## 功能

- 選取後自動翻譯，或改成只用右鍵／`Alt+T`
- 氣泡可改來源語言與目標語言
- 來源語言和目標語言相同，或譯文與原文相同時不彈窗
- 喇叭使用 Google 翻譯的語音（`translate.google.com/translate_tts`）
- 可改接自己的 OpenAI、Claude 或 Gemini 相容 LLM 節點
- 淺色、深色、跟隨系統、跟隨 Chrome 主題，也可自訂強調色
- 介面只有英文與繁體中文，預設英文
- 工具列彈窗、右鍵選單、`Alt+T`

翻譯來源是 Google 的公開 `translate.googleapis.com` 端點。這個 API 沒有官方保證，失敗時會改走 MyMemory。單字通常會帶詞性；長句通常只有譯文。

## 從 GitHub 安裝

1. 打開最新的 [Release](https://github.com/911218sky/select-translate/releases/latest)
2. 下載 `select-translate-*.zip`
3. 解壓縮
4. 開啟 `chrome://extensions`
5. 打開「開發人員模式」
6. 按「載入未封裝項目」，選解壓後的資料夾

推送 `v*` 標籤後，GitHub Actions 會自動打包，並把 zip 掛到 Release。

## 從原始碼載入

```bash
git clone https://github.com/911218sky/select-translate.git
cd select-translate
npm install
npm test
npm run icons
npm run pack
```

然後在 `chrome://extensions` 載入 `dist/extension`。

本機開發也可在 `npm run build` 後直接載入專案根目錄。改過程式後，重新載入擴充功能並刷新網頁。

## 使用方式

1. 在網頁反白文字
2. 在氣泡裡看譯文
3. 可改語言或點喇叭
4. 在設定頁改主題、介面語言與觸發方式

來源語言和目標語言相同時，氣泡不會出現。

## 權限

- `storage`：記住語言、主題與觸發方式
- `contextMenus`：右鍵翻譯
- `activeTab` / `scripting`：在目前分頁顯示氣泡
- `offscreen`：朗讀
- `translate.googleapis.com`、`translate.google.com`、`api.mymemory.translated.net`：翻譯與 Google 語音

## 開發

```bash
npm test
npm run typecheck
npm run build
npm run pack
npm run icons
```

### 目錄結構

```text
src/                 擴充功能原始碼
  background/        service worker
  content/           網頁氣泡
  popup/             工具列彈窗
  options/           設定頁
  offscreen/         語音播放
  lib/               共用型別、i18n、主題、LLM、工具函式
  styles/            共用 CSS
icons/               正式圖示
_locales/            Chrome 語系字串
scripts/             建置與圖示工具
tests/               單元測試
examples/            本機示範頁
design/              設計草稿（不會打包）
```

原始碼由 `esbuild` 打包成 Chrome 可載入的 IIFE。`_locales/` 與 `icons/` 留在專案根目錄，因為 Chrome 要求它們與 `manifest.json` 同層。

## 授權

[MIT](LICENSE)
