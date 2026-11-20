import { sseData } from "./sse";
import { LlmConfigError, LlmHttpError, type Llm, type LlmRequest } from "./types";

type Fetch = typeof fetch;
export type Env = Record<string, string | undefined>;

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
/** A free model that, in testing, answered with correct citations in about 20 s; Google-hosted free models were often rate limited upstream. */
export const DEFAULT_OPENROUTER_MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free";
export const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434/v1";
export const DEFAULT_OLLAMA_MODEL = "llama3.1";

async function open(fetchFn: Fetch, url: string, init: RequestInit): Promise<ReadableStream> {
  const res = await fetchFn(url, init);
  if (!res.ok || !res.body) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    throw new LlmHttpError(res.status, detail);
  }
  return res.body;
}

function isLocalUrl(url: string): boolean {
  try {
    return ["localhost", "127.0.0.1", "::1", "[::1]", "host.docker.internal"].includes(
      new URL(url).hostname,
    );
  } catch {
    return false;
  }
}

export function openAiLlm(
  baseUrl: string,
  apiKey: string | undefined,
  model: string,
  fetchFn: Fetch = fetch,
): Llm {
  const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
  return {
    model,
    local: isLocalUrl(baseUrl),
    async *stream(req: LlmRequest) {
      const body = await open(fetchFn, url, {
        method: "POST",
        signal: req.signal,
        headers: {
          "content-type": "application/json",
          ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model,
          max_tokens: req.maxTokens,
          messages: [{ role: "system", content: req.system }, ...req.messages],
          stream: true,
          stream_options: { include_usage: true },
        }),
      });
      for await (const data of sseData(body)) {
        if (data === "[DONE]") return;
        const event = JSON.parse(data);
        const usage = event.usage;
        if (usage) {
          req.onUsage?.({
            inputTokens: usage.prompt_tokens ?? 0,
            outputTokens: usage.completion_tokens ?? 0,
          });
        }
        const text = event.choices?.[0]?.delta?.content;
        if (text) yield text as string;
      }
    },
  };
}

const NO_LLM_HELP =
  "Set OPENROUTER_API_KEY, or LLM_PROVIDER=ollama with LLM_MODEL=<a model you pulled>, then restart.";

/**
 * Picks the model from env alone. Two options, both OpenAI-compatible:
 * - openrouter (default): OPENROUTER_API_KEY, LLM_MODEL (default a free model).
 * - ollama: local, no key; OLLAMA_BASE_URL (default localhost:11434), LLM_MODEL.
 */
export function createLlm(env: Env = process.env, fetchFn: Fetch = fetch): Llm {
  const provider = env.LLM_PROVIDER || "openrouter";
  if (provider === "openrouter") {
    if (!env.OPENROUTER_API_KEY) throw new LlmConfigError(NO_LLM_HELP);
    return openAiLlm(
      OPENROUTER_BASE_URL,
      env.OPENROUTER_API_KEY,
      env.LLM_MODEL || DEFAULT_OPENROUTER_MODEL,
      fetchFn,
    );
  }
  if (provider === "ollama") {
    return openAiLlm(
      env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL,
      undefined,
      env.LLM_MODEL || DEFAULT_OLLAMA_MODEL,
      fetchFn,
    );
  }
  throw new LlmConfigError(`LLM_PROVIDER must be "openrouter" or "ollama", got "${provider}"`);
}
