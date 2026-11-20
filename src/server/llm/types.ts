export type ChatMessage = { role: "user" | "assistant"; content: string };

export type LlmRequest = {
  system: string;
  messages: ChatMessage[];
  maxTokens: number;
  signal?: AbortSignal;
  onUsage?: (usage: { inputTokens: number; outputTokens: number }) => void;
};

export interface Llm {
  model?: string;
  /** True for endpoints on this machine (Ollama): cost is 0. */
  local?: boolean;
  stream(req: LlmRequest): AsyncIterable<string>;
}

export class LlmConfigError extends Error {}

export class LlmHttpError extends Error {
  constructor(
    readonly status: number,
    detail: string,
  ) {
    super(`LLM request failed (${status}) ${detail}`.trim());
  }
}

export function describeLlmError(e: unknown, model = "the configured model"): string {
  if (e instanceof LlmHttpError) {
    if (e.status === 404)
      return `The model "${model}" was not found. Set LLM_MODEL to a model your endpoint has (Ollama: run "ollama pull ${model}" or pick one from "ollama list"), then restart.`;
    if (e.status === 401 || e.status === 403)
      return "OpenRouter rejected the API key. Check OPENROUTER_API_KEY.";
    if (e.status === 429)
      return "The model is rate limited (free OpenRouter models allow a few requests a minute). Try again shortly, or set LLM_MODEL to another model.";
    return `The model request failed (HTTP ${e.status}). Check the server log for details.`;
  }
  if (e instanceof TypeError)
    return "Could not reach the model. For Ollama, check that it is running (and OLLAMA_BASE_URL if it is not on localhost:11434).";
  return "The model request failed. Check the server log for details.";
}
