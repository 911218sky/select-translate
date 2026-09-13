import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canPreHideByScript,
  contrastText,
  DEFAULTS,
  googleTtsUrl,
  isMixedScript,
  languageBanner,
  languageName,
  mixHex,
  normalizeHex,
  normalizeLang,
  normalizePos,
  parseGoogleResult,
  rgbToHex,
  resolveTheme,
  sameLanguage,
  sanitizeHttpUrl,
  shouldHideTranslation,
  stripTags,
  textLooksLikeLanguage,
  truncateCodePoints,
  ttsLang,
  unique
} from "../src/lib/shared.ts";
import { chatCompletionsUrl, modelsListUrl, resolveLlmConfig } from "../src/lib/llm.ts";
import { t } from "../src/lib/i18n.ts";

test("language helpers", () => {
  assert.equal(normalizeLang("zh"), "zh-CN");
  assert.equal(normalizeLang("zh_hant"), "zh-TW");
  assert.equal(normalizeLang("en"), "en");
  assert.equal(ttsLang("zh-TW"), "zh-TW");
  assert.equal(languageName("ja", "zh-TW"), "日本語");
  assert.equal(languageName("ja", "en"), "Japanese");
  assert.equal(languageBanner("ja", "en"), "JAPANESE");
  assert.equal(languageBanner("ja", "zh-TW"), "日本語");
  assert.equal(normalizePos("名詞"), "noun");
  assert.equal(normalizePos("形容詞"), "adjective");
  assert.equal(normalizePos("Adjective"), "adjective");
  assert.equal(stripTags("<b>hello</b> &nbsp;world"), "hello  world");
  assert.equal(JSON.stringify(unique(["a", "a", "", "b"])), JSON.stringify(["a", "b"]));
  assert.equal(sameLanguage("en", "en"), true);
  assert.equal(sameLanguage("zh-TW", "zh_tw"), true);
  assert.equal(sameLanguage("auto", "zh-TW"), false);
  assert.equal(sameLanguage("en", "zh-TW"), false);
  assert.equal(shouldHideTranslation("zh-TW", "zh-TW"), true);
  assert.equal(shouldHideTranslation("en", "zh-TW", "hello", "hello"), true);
  assert.equal(shouldHideTranslation("en", "zh-TW", "hello", "你好"), false);
  assert.equal(textLooksLikeLanguage("這是一段中文內容", "zh-TW"), true);
  assert.equal(textLooksLikeLanguage("這是一段中文內容", "en"), false);
  assert.equal(textLooksLikeLanguage("This is English text", "en"), true);
  assert.equal(textLooksLikeLanguage("This is English text", "zh-TW"), false);
  assert.equal(truncateCodePoints("hello😀world", 6), "hello😀");
  assert.equal(truncateCodePoints("hi", 10), "hi");
  assert.equal(sanitizeHttpUrl("https://api.example.com/v1/chat"), "https://api.example.com/v1/chat");
  assert.equal(sanitizeHttpUrl("javascript:alert(1)"), "");
});

test("shouldHideTranslation pre-hide only for script-distinct targets", () => {
  assert.equal(canPreHideByScript("ja"), true);
  assert.equal(canPreHideByScript("en"), false);
  assert.equal(canPreHideByScript("zh-TW"), false);
  assert.equal(canPreHideByScript("zh-CN"), false);
  // Latin↔Latin must not pre-hide (would block fr→en, en→es, …).
  assert.equal(shouldHideTranslation("auto", "en", "Bonjour tout le monde"), false);
  assert.equal(shouldHideTranslation("auto", "es", "This is English text"), false);
  // Han targets must not pre-hide (zh-CN ↔ zh-TW conversion).
  assert.equal(shouldHideTranslation("auto", "zh-TW", "这是一段简体中文内容"), false);
  assert.equal(shouldHideTranslation("auto", "zh-CN", "這是一段繁體中文內容"), false);
  assert.equal(shouldHideTranslation("auto", "zh-TW", "這是中文"), false);
  // Script-distinct targets can still pre-hide.
  assert.equal(shouldHideTranslation("auto", "ja", "これは日本語の文章です"), true);
  assert.equal(shouldHideTranslation("auto", "ko", "이것은 한국어 문장입니다"), true);
  assert.equal(shouldHideTranslation("auto", "en", "これは日本語です"), false);
  // After translate: identical text still hides.
  assert.equal(shouldHideTranslation("fr", "en", "hello", "hello"), true);
});

test("shouldHideTranslation keeps mixed Latin+Han glossary selections", () => {
  const mixed =
    "phospholipid bilayer（磷脂雙層）＋ proteins（蛋白質）＋ cholesterol（膽固醇）";
  assert.equal(isMixedScript(mixed), true);
  assert.equal(isMixedScript("這是一段純繁體中文內容"), false);
  assert.equal(isMixedScript("This is English text only"), false);
  assert.equal(isMixedScript("A 級"), false);
  // Google often detects mixed glossary text as zh when target is zh-TW.
  assert.equal(shouldHideTranslation("zh-TW", "zh-TW", mixed, mixed), false);
  assert.equal(shouldHideTranslation("en", "zh-TW", mixed, mixed), false);
  // Pure target-language / plain no-op still hide.
  assert.equal(shouldHideTranslation("zh-TW", "zh-TW", "這是一段純繁體中文內容", "這是一段純繁體中文內容"), true);
  assert.equal(shouldHideTranslation("en", "zh-TW", "hello", "hello"), true);
});

test("google parser", () => {
  const sample = [
    [
      ["工程", "engineering", null, null, 0],
      [null, null, null, null, 0]
    ],
    [
      ["名詞", ["工程", "工程學"], [["工程", ["engineering"], 0, 0.9]]],
      ["形容詞", ["工程的"], [["工程的", ["engineering"], 0, 0.4]]]
    ],
    "en",
    null,
    null,
    [["engineering", null, [["工程", 0, true, false], ["工程學", 0, true, false]]]]
  ];
  const parsed = parseGoogleResult(sample, "engineering", "auto", "zh-TW");
  assert.equal(parsed.translated, "工程");
  assert.equal(parsed.original, "engineering");
  assert.equal(parsed.sourceLang, "en");
  assert.equal(parsed.targetLang, "zh-TW");
  assert.equal(parsed.dictionary[0].pos, "noun");
  assert.equal(JSON.stringify(parsed.dictionary[0].terms), JSON.stringify(["工程", "工程學"]));
  assert.equal(parsed.dictionary[1].pos, "adjective");
  assert.equal(JSON.stringify(parsed.alternatives), JSON.stringify(["工程", "工程學"]));
  const empty = parseGoogleResult(null, "hello", "auto", "zh-TW");
  assert.equal(empty.translated, "");
});

test("theme and tts helpers", () => {
  assert.equal(normalizeHex("#ABC"), "#aabbcc");
  assert.equal(rgbToHex([26, 115, 232]), "#1a73e8");
  assert.equal(contrastText("#ffffff"), "#1f1f1f");
  assert.equal(contrastText("#1a73e8"), "#ffffff");
  assert.equal(mixHex("#000000", "#ffffff", 0.5), "#808080");
  const light = resolveTheme({ appearance: "light", accentColor: "#137333" });
  assert.equal(light.scheme, "light");
  assert.equal(light.accent, "#137333");
  const chromeTheme = resolveTheme(
    { appearance: "chrome", accentColor: "#1a73e8" },
    {
      colors: {
        ntp_background: [32, 33, 36],
        toolbar: [48, 49, 52],
        ntp_text: [232, 234, 237],
        button_background: [138, 180, 248]
      }
    }
  );
  assert.equal(chromeTheme.scheme, "dark");
  assert.equal(chromeTheme.bg, "#202124");
  assert.equal(chromeTheme.accent, "#8ab4f8");
  assert.match(googleTtsUrl("你好", "zh-TW"), /translate_tts/);
  assert.match(googleTtsUrl("你好", "zh-TW"), /tl=zh-TW/);
  assert.match(googleTtsUrl("你好", "zh-TW"), /client=tw-ob/);
});

test("i18n", () => {
  assert.equal(t("extName", "zh-TW"), "選字翻譯");
  assert.equal(t("extName", "en"), "Select Translate");
  assert.equal(t("errorGoogle", "en", { STATUS: 429 }), "Google Translate is unavailable (429)");
  assert.equal(t("extName", "auto"), "Select Translate");
});

test("llm config", () => {
  const openai = resolveLlmConfig({
    ...DEFAULTS,
    translator: "llm",
    llmProvider: "openai",
    llmEndpoint: "",
    llmModel: ""
  });
  assert.equal(openai.endpoint, "https://api.openai.com/v1/chat/completions");
  assert.equal(openai.model, "gpt-4o-mini");
  const custom = resolveLlmConfig({
    ...DEFAULTS,
    translator: "llm",
    llmProvider: "openai",
    llmEndpoint: "https://llm.example.com/v1/chat/completions",
    llmModel: "local-model"
  });
  assert.equal(custom.endpoint, "https://llm.example.com/v1/chat/completions");
  assert.equal(custom.model, "local-model");
  const invalid = resolveLlmConfig({
    ...DEFAULTS,
    translator: "llm",
    llmProvider: "openai",
    llmEndpoint: "127.0.0.1:11434/v1",
    llmModel: "llama"
  });
  assert.equal(invalid.endpoint, "");
  assert.equal(
    modelsListUrl("openai", "https://llm.example.com/v1/chat/completions"),
    "https://llm.example.com/v1/models"
  );
  assert.equal(modelsListUrl("claude", "https://api.anthropic.com/v1/messages"), "https://api.anthropic.com/v1/models");
  assert.equal(
    modelsListUrl("gemini", "https://generativelanguage.googleapis.com/v1beta"),
    "https://generativelanguage.googleapis.com/v1beta/models"
  );
  assert.equal(
    modelsListUrl(
      "openai",
      "https://example.openai.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2024-01-01"
    ),
    "https://example.openai.azure.com/openai/models?api-version=2024-01-01"
  );
  assert.equal(
    chatCompletionsUrl("openai", "https://llm.example.com/v1"),
    "https://llm.example.com/v1/chat/completions"
  );
  assert.equal(
    chatCompletionsUrl("openai", "https://llm.example.com/v1/chat/completions"),
    "https://llm.example.com/v1/chat/completions"
  );
  assert.equal(
    chatCompletionsUrl("claude", "https://api.anthropic.com/v1"),
    "https://api.anthropic.com/v1/messages"
  );
  assert.equal(
    modelsListUrl("gemini", "https://generativelanguage.googleapis.com/v1beta/models"),
    "https://generativelanguage.googleapis.com/v1beta/models"
  );
  assert.equal(
    modelsListUrl("openai", "https://llm.example.com/v1/chat/completions?api-version=2024-01-01"),
    "https://llm.example.com/v1/models?api-version=2024-01-01"
  );
});
