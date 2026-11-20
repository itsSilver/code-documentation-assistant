import { describe, expect, it } from "vitest";
import { createLlm } from "./providers";
import { LlmConfigError, describeLlmError, type Llm } from "./types";

const sse = (events: string[]) =>
  new Response(events.map((e) => `data: ${e}\n\n`).join(""), { status: 200 });

async function collect(llm: Llm) {
  let text = "";
  for await (const t of llm.stream({ system: "s", messages: [], maxTokens: 10 })) text += t;
  return text;
}

describe("describeLlmError", () => {
  const fail = async (status: number) => {
    const llm = createLlm(
      { LLM_PROVIDER: "ollama" },
      async () => new Response('{"error":"x"}', { status }),
    );
    try {
      await collect(llm);
    } catch (e) {
      return describeLlmError(e, llm.model);
    }
    throw new Error("expected failure");
  };

  it("names the missing model and how to fix it on 404", async () => {
    const message = await fail(404);
    expect(message).toContain("llama3.1");
    expect(message).toContain("LLM_MODEL");
    expect(message).toContain("ollama pull");
  });

  it("points at the key on 401 and at the endpoint when unreachable", async () => {
    expect(await fail(401)).toContain("API key");
    expect(describeLlmError(new TypeError("fetch failed"))).toContain("Ollama");
  });
});

describe("createLlm", () => {
  it("defaults to OpenRouter with the key and a free model", async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    const llm = createLlm({ OPENROUTER_API_KEY: "k" }, async (url, init) => {
      seen = { url: String(url), init: init! };
      return sse([
        '{"choices":[{"delta":{"content":"Hel"}}]}',
        '{"choices":[{"delta":{"content":"lo"}}]}',
        "[DONE]",
      ]);
    });
    expect(await collect(llm)).toBe("Hello");
    expect(seen!.url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect((seen!.init.headers as Record<string, string>).authorization).toBe("Bearer k");
    expect(JSON.parse(seen!.init.body as string)).toMatchObject({
      model: "nvidia/nemotron-3-ultra-550b-a55b:free",
      messages: [{ role: "system", content: "s" }],
    });
    expect(llm.local).toBe(false);
  });

  it("runs Ollama locally with no key, on localhost by default", async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    const llm = createLlm({ LLM_PROVIDER: "ollama", LLM_MODEL: "m" }, async (url, init) => {
      seen = { url: String(url), init: init! };
      return sse(['{"choices":[{"delta":{"content":"Hi"}}]}', "[DONE]"]);
    });
    expect(await collect(llm)).toBe("Hi");
    expect(seen!.url).toBe("http://localhost:11434/v1/chat/completions");
    expect(seen!.init.headers).not.toHaveProperty("authorization");
    expect(llm.local).toBe(true);
    expect(
      createLlm({ LLM_PROVIDER: "ollama", OLLAMA_BASE_URL: "http://127.0.0.1:9999/v1/" }).model,
    ).toBe("llama3.1");
  });

  it("throws on an HTTP error", async () => {
    const llm = createLlm(
      { OPENROUTER_API_KEY: "k" },
      async () => new Response("no", { status: 401 }),
    );
    await expect(collect(llm)).rejects.toThrow(/401/);
  });

  it("rejects missing or unknown configuration", () => {
    expect(() => createLlm({})).toThrow(LlmConfigError);
    expect(() => createLlm({ LLM_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "k" })).toThrow(
      LlmConfigError,
    );
  });
});

describe("missing configuration message", () => {
  it("tells the reader what to set, including the Ollama option", () => {
    expect(() => createLlm({})).toThrow(/OPENROUTER_API_KEY.*LLM_PROVIDER=ollama/s);
  });
});
