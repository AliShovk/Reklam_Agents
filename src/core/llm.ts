import OpenAI from "openai";
import { createSubLogger } from "./logger.js";
import { getConfig } from "./config.js";
import { initGigaChat, getGigaChatClient, type GigaChatClient } from "./gigachat-client.js";

const log = createSubLogger("llm");

type LLMProvider = "openai" | "openrouter" | "groq" | "together" | "huggingface" | "ollama" | "mistral" | "gigachat";

let _client: OpenAI | null = null;
let _gigachatClient: GigaChatClient | null = null;

function detectProvider(): LLMProvider {
  // Определяем провайдера по переменным окружения
  if (process.env.GIGACHAT_AUTH_KEY) return "gigachat";
  if (process.env.GROQ_API_KEY) return "groq";
  if (process.env.TOGETHER_API_KEY) return "together";
  if (process.env.HF_API_KEY) return "huggingface";
  if (process.env.OLLAMA_BASE_URL) return "ollama";
  if (process.env.MISTRAL_API_KEY) return "mistral";
  if (process.env.OPENAI_BASE_URL?.includes("openrouter.ai")) return "openrouter";
  return "openai";
}

function isDeepSeekEndpoint(): boolean {
  const base = process.env.OPENAI_BASE_URL || "";
  return base.includes("api.deepseek.com");
}

function getClient(): OpenAI {
  if (!_client) {
    const provider = detectProvider();
    let config: any = {
      apiKey: process.env.OPENAI_API_KEY || "sk-dummy",
    };

    switch (provider) {
      case "gigachat":
        // Will be handled separately in llmChat
        config = { apiKey: "gigachat-token-placeholder" };
        break;

      case "groq":
        config = {
          apiKey: process.env.GROQ_API_KEY,
          baseURL: "https://api.groq.com/openai/v1",
        };
        log.info("LLM Provider: Groq");
        break;

      case "together":
        config = {
          apiKey: process.env.TOGETHER_API_KEY,
          baseURL: "https://api.together.xyz/v1",
        };
        log.info("LLM Provider: Together AI");
        break;

      case "huggingface":
        config = {
          apiKey: process.env.HF_API_KEY,
          baseURL: "https://api-inference.huggingface.co/v1",
        };
        log.info("LLM Provider: Hugging Face");
        break;

      case "ollama":
        config = {
          apiKey: "ollama", // Не требует ключа
          baseURL: process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1",
        };
        log.info("LLM Provider: Ollama (local)");
        break;

      case "mistral":
        config = {
          apiKey: process.env.MISTRAL_API_KEY,
          baseURL: "https://api.mistral.ai/v1",
        };
        log.info("LLM Provider: Mistral AI");
        break;

      case "openrouter":
        config = {
          apiKey: process.env.OPENAI_API_KEY,
          baseURL: process.env.OPENAI_BASE_URL || "https://openrouter.ai/api/v1",
          defaultHeaders: {
            "HTTP-Referer": process.env.OPENROUTER_REFERER || "https://reklam.farm",
            "X-Title": process.env.OPENROUTER_TITLE || "Reklam Agents",
          },
        };
        log.info("LLM Provider: OpenRouter");
        break;

      case "openai":
      default: {
        const baseURL = process.env.OPENAI_BASE_URL || undefined;
        config = {
          apiKey: process.env.OPENAI_API_KEY,
          ...(baseURL ? { baseURL } : {}),
        };
        if (baseURL) {
          log.info(`LLM Provider: OpenAI (custom endpoint: ${baseURL})`);
        } else {
          log.info("LLM Provider: OpenAI");
        }
        break;
      }
    }

    _client = new OpenAI(config);
  }
  return _client;
}

export async function initializeLLM(): Promise<void> {
  getClient();
  if (detectProvider() === "gigachat") {
    _gigachatClient = await initGigaChat();
    if (_gigachatClient) {
      log.info("GigaChat initialized");
    }
  }
}

export interface LLMRequest {
  model?: string;
  systemPrompt: string;
  userMessage: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface LLMResponse {
  content: string;
  tokensUsed: number;
  model: string;
  durationMs: number;
  finishReason?: string;
}

/** Send a chat completion request to the LLM. */
export async function llmChat(request: LLMRequest): Promise<LLMResponse> {
  const config = getConfig();
  const provider = detectProvider();

  // GigaChat требует специальной обработки
  if (provider === "gigachat") {
    return llmChatGigaChat(request);
  }

  // Выбираем модель в зависимости от провайдера
  let model = request.model || config.models.default;
  
  if (provider === "groq" && !request.model) {
    model = process.env.GROQ_MODEL || "mixtral-8x7b-32768";
  } else if (provider === "together" && !request.model) {
    model = process.env.TOGETHER_MODEL || "meta-llama/Meta-Llama-3-70B-Instruct";
  } else if (provider === "huggingface" && !request.model) {
    model = process.env.HF_MODEL || "mistralai/Mistral-7B-Instruct-v0.1";
  } else if (provider === "ollama" && !request.model) {
    model = process.env.OLLAMA_MODEL || "mistral";
  } else if (provider === "mistral" && !request.model) {
    model = "mistral-medium";
  } else if (provider === "openrouter" && !request.model) {
    model = process.env.OPENROUTER_MODEL || config.models.default;
  }

  const start = Date.now();

  const parseEnvInt = (value: string | undefined): number | null => {
    if (!value) return null;
    const n = Number.parseInt(value, 10);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  };

  const defaultMaxTokens =
    (provider === "openrouter" ? parseEnvInt(process.env.OPENROUTER_MAX_TOKENS) : null) ??
    parseEnvInt(process.env.LLM_MAX_TOKENS) ??
    2048;

  const defaultJsonMaxTokens =
    parseEnvInt(process.env.LLM_JSON_MAX_TOKENS) ??
    defaultMaxTokens;

  const maxTokens =
    request.maxTokens ??
    (request.jsonMode ? defaultJsonMaxTokens : defaultMaxTokens);

  const allowResponseFormat =
    request.jsonMode && provider !== "ollama" && !(provider === "openai" && isDeepSeekEndpoint());

  try {
    const response = await getClient().chat.completions.create({
      model,
      messages: [
        { role: "system", content: request.systemPrompt },
        { role: "user", content: request.userMessage },
      ],
      temperature: request.temperature ?? 0.7,
      max_tokens: maxTokens,
      ...(allowResponseFormat ? { response_format: { type: "json_object" } } : {}),
    });

    const content = response.choices[0]?.message?.content || "";
    const finishReason = response.choices[0]?.finish_reason;
    const tokensUsed =
      (response.usage?.prompt_tokens || 0) + (response.usage?.completion_tokens || 0);
    const durationMs = Date.now() - start;

    log.debug(`LLM response: provider=${provider}, model=${model}, tokens=${tokensUsed}, duration=${durationMs}ms`);

    if (!content && response.choices[0]?.finish_reason !== "stop") {
        log.warn(`LLM response empty. Finish reason: ${response.choices[0]?.finish_reason}. Raw message: ${JSON.stringify(response.choices[0]?.message)}`);
    }

    return { content, tokensUsed, model, durationMs, finishReason };
  } catch (error: any) {
    log.error(
      `LLM error [${provider}]: ${error.message} (model=${model}, max_tokens=${maxTokens}, jsonMode=${Boolean(
        request.jsonMode
      )}, baseURL=${process.env.OPENAI_BASE_URL || ""})`
    );
    throw error;
  }
}

/** GigaChat specific request handler. */
async function llmChatGigaChat(request: LLMRequest): Promise<LLMResponse> {
  const gigachat = getGigaChatClient();
  if (!gigachat) {
    throw new Error("GigaChat client not initialized");
  }

  const model = request.model || process.env.GIGACHAT_MODEL || "GigaChat";
  const start = Date.now();

  const parseEnvInt = (value: string | undefined): number | null => {
    if (!value) return null;
    const n = Number.parseInt(value, 10);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  };

  const defaultMaxTokens = parseEnvInt(process.env.LLM_MAX_TOKENS) ?? 2048;
  const maxTokens = request.maxTokens ?? defaultMaxTokens;

  try {
    const token = gigachat.getAccessToken();
    const baseURL = gigachat.getBaseURL();

    const response = await fetch(`${baseURL}/api/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: request.systemPrompt },
          { role: "user", content: request.userMessage },
        ],
        temperature: request.temperature ?? 0.7,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GigaChat API error: ${response.status} ${error}`);
    }

    const data: any = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const tokensUsed = data.usage?.total_tokens || 0;
    const durationMs = Date.now() - start;

    log.debug(`GigaChat response: model=${model}, tokens=${tokensUsed}, duration=${durationMs}ms`);

    return { content, tokensUsed, model, durationMs };
  } catch (error: any) {
    log.error(`GigaChat error: ${error.message}`);
    throw error;
  }
}

/** Structured output: parse LLM response as JSON. */
export async function llmJson<T = unknown>(request: LLMRequest): Promise<{
  data: T;
  tokensUsed: number;
  model: string;
  durationMs: number;
}> {
  const baseRequest: LLMRequest = {
    ...request,
    jsonMode: true,
    systemPrompt: request.systemPrompt + "\n\nRespond ONLY with valid JSON.",
  };

  const response = await llmChat(baseRequest);

  if (!response.content || response.content.trim() === "") {
      log.error(`LLM returned empty content. Model: ${response.model}, tokens: ${response.tokensUsed}`);
      throw new Error("LLM returned empty response instead of JSON");
  }

  const extractJson = (raw: string): string => {
    const trimmed = raw.trim();

    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenceMatch?.[1]) {
      return fenceMatch[1].trim();
    }

    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return trimmed.slice(firstBrace, lastBrace + 1);
    }

    const firstBracket = trimmed.indexOf("[");
    const lastBracket = trimmed.lastIndexOf("]");
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      return trimmed.slice(firstBracket, lastBracket + 1);
    }

    return trimmed;
  };

  try {
    const jsonText = extractJson(response.content);
    const data = JSON.parse(jsonText) as T;
    return { data, tokensUsed: response.tokensUsed, model: response.model, durationMs: response.durationMs };
  } catch {
    log.error(`Failed to parse LLM JSON: ${response.content.slice(0, 200)}`);

    const retryMaxTokens = Number.parseInt(process.env.LLM_JSON_RETRY_MAX_TOKENS || "", 10);
    const retryRequest: LLMRequest = {
      ...baseRequest,
      temperature: 0,
      maxTokens: Number.isFinite(retryMaxTokens) && retryMaxTokens > 0 ? retryMaxTokens : undefined,
      userMessage:
        baseRequest.userMessage +
        "\n\nThe previous response was truncated or invalid JSON. Return the FULL valid JSON only. No markdown, no code fences.",
    };

    if (response.finishReason !== "length") {
      throw new Error("LLM returned invalid JSON");
    }

    const retry = await llmChat(retryRequest);
    try {
      const jsonText = extractJson(retry.content);
      const data = JSON.parse(jsonText) as T;
      return { data, tokensUsed: retry.tokensUsed, model: retry.model, durationMs: retry.durationMs };
    } catch {
      log.error(`Failed to parse LLM JSON (retry): ${retry.content.slice(0, 200)}`);
      throw new Error("LLM returned invalid JSON");
    }
  }
}
