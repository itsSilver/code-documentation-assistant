import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

afterEach(() => vi.unstubAllEnvs());

describe("GET /api/status", () => {
  it("reports the configured model and whether it runs locally", async () => {
    vi.stubEnv("LLM_PROVIDER", "ollama");
    vi.stubEnv("LLM_MODEL", "qwen2.5:7b");
    expect(await GET().json()).toEqual({ llm: { ready: true, model: "qwen2.5:7b", local: true } });
  });

  it("explains how to configure a model when none is set", async () => {
    vi.stubEnv("LLM_PROVIDER", "openrouter");
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const { llm } = await GET().json();
    expect(llm.ready).toBe(false);
    expect(llm.help).toContain("OPENROUTER_API_KEY");
  });
});
