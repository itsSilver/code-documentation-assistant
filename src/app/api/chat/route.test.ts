import { describe, expect, it, vi } from "vitest";
import { openDb } from "@/server/db";

const db = openDb(":memory:");
vi.mock("@/server/db", async (orig) => ({ ...(await orig<object>()), getDb: () => db }));

const { POST } = await import("./route");

const post = (body: unknown) =>
  POST(new Request("http://x/api/chat", { method: "POST", body: JSON.stringify(body) }));

describe("POST /api/chat", () => {
  it("rejects a missing question and a missing repoId", async () => {
    expect((await post({ repoId: 1 })).status).toBe(400);
    expect((await post({ question: "hi" })).status).toBe(400);
  });

  it("reports missing LLM configuration as 503", async () => {
    vi.stubEnv("LLM_PROVIDER", "openrouter");
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const res = await post({ repoId: 1, question: "hi" });
    expect(res.status).toBe(503);
    vi.unstubAllEnvs();
  });
});
