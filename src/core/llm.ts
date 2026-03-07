import OpenAI from "openai";
import { createSubLogger } from "./logger.js";
import { getConfig } from "./config.js";

const log = createSubLogger("llm");

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return _client;
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
  const model = request.model || config.models.default;
  const start = Date.now();

  try {
    const response = await getClient().chat.completions.create({
      model,
      messages: [
        { role: "system", content: request.systemPrompt },
        { role: "user", content: request.userMessage },
      ],
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 4096,
      ...(request.jsonMode ? { response_format: { type: "json_object" } } : {}),
    });

    const content = response.choices[0]?.message?.content || "";
    const tokensUsed =
      (response.usage?.prompt_tokens || 0) + (response.usage?.completion_tokens || 0);
    const durationMs = Date.now() - start;

    log.debug(`LLM response: model=${model}, tokens=${tokensUsed}, duration=${durationMs}ms`);

    return { content, tokensUsed, model, durationMs };
  } catch (error: any) {
    log.error(`LLM error: ${error.message}`);
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
