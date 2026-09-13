import type { LlmProvider, Settings, TranslateResult } from "./types.ts";
import { llmDefaults, originPattern, sanitizeHttpUrl } from "./shared.ts";
import { t } from "./i18n.ts";

export function resolveLlmConfig(settings: Settings): { provider: LlmProvider; endpoint: string; model: string } {
  const provider = settings.llmProvider || "openai";
  const defaults = llmDefaults(provider);
  const rawEndpoint = String(settings.llmEndpoint || "").trim();
  // Empty = official default. Non-empty but invalid must not silently fall back.
  const endpoint = rawEndpoint ? sanitizeHttpUrl(rawEndpoint) : defaults.endpoint;
  const model = String(settings.llmModel || "").trim() || defaults.model;
  return { provider, endpoint, model };
}

/** Rough output budget from input length (Claude/Gemini need max_tokens). */
export function llmMaxOutputTokens(settings: Settings, inputChars = 0): number {
  const limit = Math.min(Math.max(Number(settings.maxChars) || 5000, 1), 5000);
  const chars = Math.min(Math.max(inputChars || limit, 1), limit);
  return Math.max(256, Math.min(4096, Math.ceil(chars * 1.5) + 64));
}

export function llmOrigin(endpoint: string): string {
  return originPattern(endpoint);
}

/** Normalize a base or chat URL into the provider chat/completions request URL. */
export function chatCompletionsUrl(provider: LlmProvider, endpoint: string): string {
  if (provider === "gemini") return endpoint;
  const url = new URL(endpoint);
  let path = url.pathname.replace(/\/+$/, "");
  if (provider === "claude") {
    if (!/\/messages$/i.test(path)) {
      path = path.replace(/\/(chat\/completions|models)$/i, "");
      path = `${path || "/v1"}/messages`;
    }
  } else if (!/\/chat\/completions$/i.test(path)) {
    path = path.replace(/\/(messages|models)$/i, "");
    path = `${path || "/v1"}/chat/completions`;
  }
  url.pathname = path;
  return url.toString();
}

/** Derive the provider models-list URL from a chat/completions-style endpoint. */
export function modelsListUrl(provider: LlmProvider, endpoint: string): string {
  const url = new URL(endpoint);
  if (provider === "gemini") {
    const base = url.pathname
      .replace(/\/+$/, "")
      .replace(/\/models\/[^/]+(?::[\w]+)?$/, "")
      .replace(/\/models$/i, "");
    url.pathname = `${base || "/v1beta"}/models`;
    return url.toString();
  }
  let path = url.pathname.replace(/\/+$/, "");
  // Azure OpenAI: …/openai/deployments/{name}/chat/completions → …/openai/models
  path = path.replace(/\/openai\/deployments\/[^/]+\/chat\/completions$/i, "/openai");
  path = path
    .replace(/\/chat\/completions$/i, "")
    .replace(/\/messages$/i, "")
    .replace(/\/models$/i, "");
  url.pathname = `${path || "/v1"}/models`;
  return url.toString();
}

export async function listLlmModels(settings: Settings, apiKey: string): Promise<string[]> {
  const { provider, endpoint } = resolveLlmConfig(settings);
  if (!endpoint) throw new Error(t("errorLlmConfig", settings));
  const listUrl = modelsListUrl(provider, endpoint);
  if (provider === "claude") {
    return listClaudeModels(listUrl, apiKey, settings);
  }
  if (provider === "gemini") {
    return listGeminiModels(listUrl, apiKey, settings);
  }
  return listOpenAiModels(listUrl, apiKey, settings);
}

export async function testLlmConnection(
  settings: Settings,
  apiKey: string
): Promise<{ translated: string; provider: string }> {
  const sample = "Hello";
  const result = await translateWithLlm(sample, "en", settings.targetLang || "zh-TW", settings, apiKey);
  return { translated: result.translated, provider: result.provider };
}

export async function translateWithLlm(
  text: string,
  sl: string,
  tl: string,
  settings: Settings,
  apiKey: string,
  signal?: AbortSignal
): Promise<TranslateResult> {
  const { provider, endpoint, model } = resolveLlmConfig(settings);
  if (!endpoint) throw new Error(t("errorLlmConfig", settings));
  const chatUrl = chatCompletionsUrl(provider, endpoint);
  const prompt = translationPrompt(text, sl, tl);
  const translated =
    provider === "claude"
      ? await translateClaude(chatUrl, model, apiKey, prompt, settings, text.length, signal)
      : provider === "gemini"
        ? await translateGemini(endpoint, model, apiKey, prompt, settings, text.length, signal)
        : await translateOpenAi(chatUrl, model, apiKey, prompt, settings, text.length, signal);
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
  settings: Settings,
  inputChars: number,
  signal?: AbortSignal
): Promise<string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const data = await postJson(
    endpoint,
    {
      model,
      temperature: 0,
      max_tokens: llmMaxOutputTokens(settings, inputChars),
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user }
      ]
    },
    headers,
    settings,
    signal
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
  settings: Settings,
  inputChars: number,
  signal?: AbortSignal
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
      max_tokens: llmMaxOutputTokens(settings, inputChars),
      temperature: 0,
      system: prompt.system,
      messages: [{ role: "user", content: prompt.user }]
    },
    headers,
    settings,
    signal
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
  settings: Settings,
  inputChars: number,
  signal?: AbortSignal
): Promise<string> {
  const url = geminiUrl(endpoint, model, apiKey);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey && !url.searchParams.has("key")) headers.Authorization = `Bearer ${apiKey}`;
  const data = await postJson(
    url.toString(),
    {
      systemInstruction: { parts: [{ text: prompt.system }] },
      contents: [{ role: "user", parts: [{ text: prompt.user }] }],
      generationConfig: { temperature: 0, maxOutputTokens: llmMaxOutputTokens(settings, inputChars) }
    },
    headers,
    settings,
    signal
  );
  const parts = (data as { candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }> }).candidates?.[0]
    ?.content?.parts;
  return Array.isArray(parts) ? parts.map((part) => extractText(part?.text)).join("").trim() : "";
}

function geminiUrl(endpoint: string, model: string, apiKey: string): URL {
  const url = new URL(endpoint);
  const modelId = String(model || "")
    .trim()
    .replace(/^models\//i, "");
  // Prefer non-streaming generateContent; rewrite stream URLs so readJson gets JSON.
  if (/:streamGenerateContent$/.test(url.pathname)) {
    url.pathname = url.pathname.replace(/:streamGenerateContent$/, ":generateContent");
  } else if (!/:generateContent$/.test(url.pathname)) {
    const base = url.pathname
      .replace(/\/+$/, "")
      .replace(/\/models\/[^/]+(?::[\w]+)?$/, "")
      .replace(/\/models$/i, "");
    url.pathname = `${base || "/v1beta"}/models/${encodeURIComponent(modelId)}:generateContent`;
  }
  if (apiKey && !url.searchParams.has("key") && url.hostname.endsWith("googleapis.com")) {
    url.searchParams.set("key", apiKey);
  }
  return url;
}

async function listOpenAiModels(url: string, apiKey: string, settings: Settings): Promise<string[]> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const data = await getJson(url, headers, settings);
  const rows = Array.isArray((data as { data?: unknown[] }).data) ? (data as { data: Array<{ id?: unknown }> }).data : [];
  return uniqueIds(rows.map((row) => String(row?.id || "").trim()));
}

async function listClaudeModels(url: string, apiKey: string, settings: Settings): Promise<string[]> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "anthropic-version": "2023-06-01"
  };
  if (apiKey) headers["x-api-key"] = apiKey;
  const data = await getJson(url, headers, settings);
  const rows = Array.isArray((data as { data?: unknown[] }).data) ? (data as { data: Array<{ id?: unknown }> }).data : [];
  return uniqueIds(rows.map((row) => String(row?.id || "").trim()));
}

async function listGeminiModels(url: string, apiKey: string, settings: Settings): Promise<string[]> {
  const parsed = new URL(url);
  if (apiKey && !parsed.searchParams.has("key") && parsed.hostname.endsWith("googleapis.com")) {
    parsed.searchParams.set("key", apiKey);
  }
  const headers: Record<string, string> = { Accept: "application/json" };
  if (apiKey && !parsed.searchParams.has("key")) headers.Authorization = `Bearer ${apiKey}`;
  const data = await getJson(parsed.toString(), headers, settings);
  const rows = Array.isArray((data as { models?: unknown[] }).models)
    ? (data as { models: Array<{ name?: unknown }> }).models
    : [];
  return uniqueIds(
    rows.map((row) =>
      String(row?.name || "")
        .replace(/^models\//, "")
        .trim()
    )
  );
}

function fetchSignal(signal?: AbortSignal, timeoutMs = 25_000): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  if (!signal) return timeout;
  if (typeof AbortSignal.any === "function") return AbortSignal.any([signal, timeout]);
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  for (const entry of [signal, timeout]) {
    if (entry.aborted) {
      controller.abort();
      break;
    }
    entry.addEventListener("abort", onAbort, { once: true });
  }
  return controller.signal;
}

async function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string>,
  settings: Settings,
  signal?: AbortSignal
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: fetchSignal(signal)
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new Error(t("errorLlmNetwork", settings));
  }
  return readJson(response, settings);
}

async function getJson(url: string, headers: Record<string, string>, settings: Settings): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, { method: "GET", headers, signal: AbortSignal.timeout(25_000) });
  } catch {
    throw new Error(t("errorLlmNetwork", settings));
  }
  return readJson(response, settings);
}

async function readJson(response: Response, settings: Settings): Promise<unknown> {
  const raw = await response.text();
  if (!response.ok) {
    const detail = summarizeHttpError(raw);
    const status = String(response.status);
    throw new Error(
      detail
        ? t("errorLlmHttpDetail", settings, { STATUS: status, DETAIL: detail })
        : t("errorLlmHttp", settings, { STATUS: status })
    );
  }
  const trimmed = raw.trim();
  if (!trimmed) throw new Error(t("errorLlmEmpty", settings));
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    throw new Error(t("errorLlmNotJson", settings));
  }
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function extractText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map((part) => extractText(part)).join("").trim();
  if (value && typeof value === "object" && "text" in value) return extractText((value as { text: unknown }).text);
  return "";
}

function summarizeHttpError(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    const data = JSON.parse(trimmed) as {
      error?: { message?: unknown } | string;
      message?: unknown;
    };
    const nested = data.error;
    const message =
      typeof nested === "string"
        ? nested
        : nested && typeof nested === "object"
          ? nested.message
          : data.message;
    return String(message || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 160);
  } catch {
    return trimmed.replace(/\s+/g, " ").slice(0, 120);
  }
}
