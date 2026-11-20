import { afterEach, describe, expect, it, vi } from "vitest";
import { answerQuestion } from "../chat/chat";
import type { Chunk } from "../db/repository";
import { openAiLlm } from "../llm/providers";
import type { Llm } from "../llm/types";
import { estimateCost } from "./cost";
import { log, redact } from "./log";
import { Trace, finishTrace } from "./trace";

afterEach(() => vi.restoreAllMocks());

describe("estimateCost", () => {
  it("is 0 for free and local models and null (unknown) for paid ones", () => {
    expect(estimateCost("meta-llama/llama-3.3-70b-instruct:free", 5000, 500)).toBe(0);
    expect(estimateCost("llama3.1", 5000, 500, true)).toBe(0);
    expect(estimateCost("anthropic/claude-sonnet-5-5", 5000, 500)).toBeNull();
    expect(estimateCost(undefined, 5000, 500)).toBeNull();
  });
});

describe("logging", () => {
  function logged(fields: Record<string, unknown>): string {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    log("info", "x", fields);
    return spy.mock.calls[0]![0] as string;
  }

  it("writes one JSON line with time, level and message", () => {
    const o = JSON.parse(logged({ requestId: "r1" }));
    expect(o).toMatchObject({ level: "info", msg: "x", requestId: "r1" });
    expect(typeof o.time).toBe("string");
  });

  it("never logs secrets", () => {
    const line = logged({
      OPENROUTER_API_KEY: "sk-or-secret",
      headers: { authorization: "Bearer sk-live", "x-api-key": "abc" },
      nested: { password: "hunter2" },
    });
    expect(line).not.toMatch(/sk-or-secret|sk-live|abc|hunter2/);
    expect(line).toContain("[redacted]");
  });

  it("never logs file contents, prompts or answers, only their size", () => {
    const code = "function secretAlgorithm() { return 42; }";
    const line = logged({
      chunk: { path: "a.ts", content: code },
      messages: [{ role: "user", content: code }],
      answer: code,
      question: "how does secretAlgorithm work",
    });
    expect(line).not.toContain("secretAlgorithm");
    expect(line).toContain("a.ts");
    expect(line).toContain(`[${code.length} chars]`);
  });

  it("truncates long strings and logs only an error's message", () => {
    const out = redact({ note: "x".repeat(1000), error: new Error("boom") }) as Record<
      string,
      string
    >;
    expect(out.note.length).toBeLessThan(260);
    expect(out.error).toBe("boom");
  });
});

const chunk = (id: number): Chunk => ({
  id,
  path: "src/cart.ts",
  startLine: 1,
  endLine: 3,
  symbol: "total",
  content: "function total() { return 1 }",
});

function llmWith(over: Partial<Llm> & { usage?: [number, number] }): Llm {
  return {
    model: "nvidia/nemotron-3-ultra-550b-a55b:free",
    async *stream(req) {
      yield "It sums [src/cart.ts:1-3].";
      if (over.usage) req.onUsage?.({ inputTokens: over.usage[0], outputTokens: over.usage[1] });
    },
    ...over,
  };
}

describe("answer trace", () => {
  const retrieve = async () => [{ chunk: chunk(7), score: 1 }];
  async function run(llm: Llm, history: { role: "user" | "assistant"; content: string }[] = []) {
    const trace = new Trace(llm.model, llm.local, "req-1");
    let done;
    for await (const e of answerQuestion({ llm, retrieve, trace }, "What does total do?", history))
      if (e.type === "done") done = e;
    return done!.trace;
  }

  it("records spans, chunk ids, reported tokens and cost", async () => {
    const t = await run(llmWith({ usage: [1000, 200] }));
    expect(t.requestId).toBe("req-1");
    expect(t.spans.map((s) => s.name)).toEqual(["condense", "retrieve", "generate"]);
    expect(t.chunkIds).toEqual([7]);
    expect(t).toMatchObject({ tokensIn: 1000, tokensOut: 200, tokensEstimated: false });
    expect(t.costUsd).toBe(0); // a :free model
    expect(t.totalMs).toBeGreaterThanOrEqual(0);
  });

  it("estimates tokens and says so when the provider reports none", async () => {
    const t = await run(llmWith({}));
    expect(t.tokensEstimated).toBe(true);
    expect(t.tokensIn).toBeGreaterThan(0);
    expect(t.tokensOut).toBeGreaterThan(0);
  });

  it("adds the condense call's tokens for a follow-up", async () => {
    const t = await run(llmWith({ usage: [100, 10] }), [
      { role: "user", content: "a" },
      { role: "assistant", content: "b" },
    ]);
    expect(t.tokensIn).toBe(200);
    expect(t.tokensOut).toBe(20);
  });

  it("contains no text from the question, chunks or answer", async () => {
    const json = JSON.stringify(await run(llmWith({ usage: [1, 1] })));
    expect(json).not.toMatch(/function total|sums|What does/);
  });
});

describe("provider usage", () => {
  const sse = (events: object[]) =>
    new Response(events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(""));

  it("reads OpenAI-compatible usage and marks localhost as local", async () => {
    const fetchFn = vi.fn(async () =>
      sse([
        { choices: [{ delta: { content: "hi" } }] },
        { choices: [], usage: { prompt_tokens: 30, completion_tokens: 4 } },
      ]),
    );
    const onUsage = vi.fn();
    const llm = openAiLlm(
      "http://localhost:11434/v1",
      undefined,
      "m",
      fetchFn as unknown as typeof fetch,
    );
    expect(llm.local).toBe(true);
    for await (const _ of llm.stream({ system: "", messages: [], maxTokens: 1, onUsage })) void _;
    expect(onUsage).toHaveBeenCalledWith({ inputTokens: 30, outputTokens: 4 });
  });
});

describe("finishTrace", () => {
  it("logs the trace as one JSON line", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const t = new Trace("nvidia/nemotron-3-ultra-550b-a55b:free", false, "abcd-1234");
    t.setChunkIds([1]);
    t.addUsage({ inputTokens: 10, outputTokens: 5 });
    finishTrace(t);
    expect(JSON.parse(spy.mock.calls[0]![0] as string)).toMatchObject({
      msg: "answer trace",
      requestId: "abcd-1234",
      tokensIn: 10,
      costUsd: 0,
    });
  });
});
