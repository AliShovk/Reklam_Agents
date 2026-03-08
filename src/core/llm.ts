import OpenAI from "openai";
import { createSubLogger } from "./logger.js";
import { getConfig } from "./config.js";
import { initGigaChat, getGigaChatClient, type GigaChatClient } from "./gigachat-client.js";

const log = createSubLogger("llm");

type LLMProvider = "openai" | "groq" | "together" | "huggingface" | "ollama" | "mistral" | "gigachat";

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
  return "openai";
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

      case "openai":
      default:
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
  }

  const start = Date.now();

  try {
    const response = await getClient().chat.completions.create({
      model,
      messages: [
        { role: "system", content: request.systemPrompt },
        { role: "user", content: request.userMessage },
      ],
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 2048,
      ...(request.jsonMode && provider !== "ollama"
        ? { response_format: { type: "json_object" } }
        : {}),
    });

    const content = response.choices[0]?.message?.content || "";
    const tokensUsed =
      (response.usage?.prompt_tokens || 0) + (response.usage?.completion_tokens || 0);
    const durationMs = Date.now() - start;

    log.debug(`LLM response: provider=${provider}, model=${model}, tokens=${tokensUsed}, duration=${durationMs}ms`);

    return { content, tokensUsed, model, durationMs };
  } catch (error: any) {
    log.error(`LLM error [${provider}]: ${error.message}`);
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
        max_tokens: request.maxTokens ?? 2048,
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
  const response = await llmChat({
    ...request,
    jsonMode: true,
    systemPrompt: request.systemPrompt + "\n\nRespond ONLY with valid JSON.",
  });

  try {
    const data = JSON.parse(response.content) as T;
    return { data, tokensUsed: response.tokensUsed, model: response.model, durationMs: response.durationMs };
  } catch {
    log.error(`Failed to parse LLM JSON: ${response.content.slice(0, 200)}`);
    throw new Error("LLM returned invalid JSON");
  }
}
