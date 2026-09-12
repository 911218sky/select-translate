import type { LlmProvider, Settings, TranslateResult } from "./types.ts";
import { llmDefaults, originPattern, sanitizeHttpUrl } from "./shared.ts";
import { t } from "./i18n.ts";

export function resolveLlmConfig(settings: Settings): { provider: LlmProvider; endpoint: string; model: string } {
  const provider = settings.llmProvider || "openai";
  const defaults = llmDefaults(provider);
  const endpoint = sanitizeHttpUrl(settings.llmEndpoint) || defaults.endpoint;
  const model = String(settings.llmModel || "").trim() || defaults.model;
  return { provider, endpoint, model };
}

export function llmOrigin(endpoint: string): string {
  return originPattern(endpoint);
}

export async function translateWithLlm(
  text: string,
  sl: string,
  tl: string,
  settings: Settings,
  apiKey: string
): Promise<TranslateResult> {
  const { provider, endpoint, model } = resolveLlmConfig(settings);
  if (!endpoint) throw new Error(t("errorLlmConfig", settings));
  const prompt = translationPrompt(text, sl, tl);
  const translated =
    provider === "claude"
      ? await translateClaude(endpoint, model, apiKey, prompt, settings)
      : provider === "gemini"
        ? await translateGemini(endpoint, model, apiKey, prompt, settings)
        : await translateOpenAi(endpoint, model, apiKey, prompt, settings);
  if (!translated) throw new Error(t("errorLlmEmpty", settings));
  return {
    original: text,
    translated,
    sourceLang: sl,
    targetLang: tl,
    dictionary: [],
    definitions: [],
    examples: [],
    alternatives: [],
    provider
  };
}

function translationPrompt(text: string, sl: string, tl: string): { system: string; user: string } {
  const source = sl === "auto" ? "the detected source language" : sl;
  return {
    system: `You are a professional translator. Translate into ${tl}. Detect the source if needed (${source}). Return only the translation, with no quotes, labels, or explanation.`,
    user: text
  };
}

async function translateOpenAi(
  endpoint: string,
  model: string,
  apiKey: string,
  prompt: { system: string; user: string },
  settings: Settings
): Promise<string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const data = await postJson(
    endpoint,
    {
      model,
      temperature: 0,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user }
      ]
    },
    headers,
    settings
  );
  const choice = Array.isArray((data as { choices?: unknown[] }).choices)
    ? ((data as { choices: Array<{ message?: { content?: unknown } }> }).choices[0]?.message?.content)
    : undefined;
  return extractText(choice);
}

async function translateClaude(
  endpoint: string,
  model: string,
  apiKey: string,
  prompt: { system: string; user: string },
  settings: Settings
): Promise<string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "anthropic-version": "2023-06-01"
  };
  if (apiKey) headers["x-api-key"] = apiKey;
  const data = await postJson(
    endpoint,
    {
      model,
      max_tokens: 1024,
      temperature: 0,
      system: prompt.system,
      messages: [{ role: "user", content: prompt.user }]
    },
    headers,
    settings
  );
  const content = (data as { content?: Array<{ text?: unknown }> }).content;
  const text = Array.isArray(content) ? content.map((part) => extractText(part?.text)).join("") : "";
  return text.trim();
}

async function translateGemini(
  endpoint: string,
  model: string,
  apiKey: string,
  prompt: { system: string; user: string },
  settings: Settings
): Promise<string> {
  const url = geminiUrl(endpoint, model, apiKey);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey && !url.searchParams.has("key")) headers.Authorization = `Bearer ${apiKey}`;
  const data = await postJson(
    url.toString(),
    {
      systemInstruction: { parts: [{ text: prompt.system }] },
      contents: [{ role: "user", parts: [{ text: prompt.user }] }],
      generationConfig: { temperature: 0 }
    },
    headers,
    settings
  );
  const parts = (data as { candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }> }).candidates?.[0]
    ?.content?.parts;
  return Array.isArray(parts) ? parts.map((part) => extractText(part?.text)).join("").trim() : "";
}

function geminiUrl(endpoint: string, model: string, apiKey: string): URL {
  const url = new URL(endpoint);
  if (!/:(generateContent|streamGenerateContent)$/.test(url.pathname)) {
    const base = url.pathname.replace(/\/+$/, "");
    url.pathname = `${base}/models/${encodeURIComponent(model)}:generateContent`;
  }
  if (apiKey && !url.searchParams.has("key") && url.hostname.endsWith("googleapis.com")) {
    url.searchParams.set("key", apiKey);
  }
  return url;
}

async function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string>,
  settings: Settings
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
  } catch {
    throw new Error(t("errorLlmPermission", settings));
  }
  if (!response.ok) {
    throw new Error(t("errorLlmHttp", settings, { STATUS: String(response.status) }));
  }
  return response.json();
}

function extractText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map((part) => extractText(part)).join("").trim();
  if (value && typeof value === "object" && "text" in value) return extractText((value as { text: unknown }).text);
  return "";
}
