import { describe, expect, it, vi } from "vitest";
import { createEmbedder, EMBEDDING_DIMS, type Extractor } from "./embedder";

const fakeExtractor: Extractor = async (texts) => ({
  data: new Float32Array(texts.length * EMBEDDING_DIMS).fill(0.5),
  dims: [texts.length, EMBEDDING_DIMS],
});

describe("createEmbedder", () => {
  it("loads the model once across calls", async () => {
    const load = vi.fn(async () => fakeExtractor);
    const e = createEmbedder(load);
    await e.embedDocuments(["a"]);
    await e.embedQuery("b");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("retries after a failed load instead of caching the rejection", async () => {
    const load = vi
      .fn<() => Promise<Extractor>>()
      .mockRejectedValueOnce(new Error("download failed"))
      .mockResolvedValue(fakeExtractor);
    const e = createEmbedder(load);
    await expect(e.embedDocuments(["a"])).rejects.toThrow("download failed");
    const out = await e.embedDocuments(["a", "b"]);
    expect(out).toHaveLength(2);
    expect(out[0]).toHaveLength(EMBEDDING_DIMS);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
