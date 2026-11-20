import { zipSync, strToU8 } from "fflate";
import { describe, expect, it, vi } from "vitest";
import { openDb } from "@/server/db";
import { Repository } from "@/server/db/repository";
import { readUpload } from "@/server/ingest/upload";
import { DEFAULT_LIMITS } from "@/server/ingest/rules";
import { IngestError } from "@/server/ingest/errors";

const db = openDb(":memory:");
vi.mock("@/server/db", async (orig) => ({ ...(await orig<object>()), getDb: () => db }));

vi.mock("@/server/embed/embedder", () => ({
  localEmbedder: {
    embedDocuments: async (texts: string[]) => texts.map(() => new Float32Array(384)),
    embedQuery: async () => new Float32Array(384),
  },
}));

const { POST } = await import("./route");
const { indexQueue } = await import("@/server/search/queue");

const uploadRequest = (bytes: Uint8Array, headers: Record<string, string> = {}) => {
  const form = new FormData();
  form.set("file", new File([Buffer.from(bytes)], "demo.zip"));
  return new Request("http://x/api/ingest", { method: "POST", body: form, headers });
};
const zipBytes = () => zipSync({ "a.ts": strToU8("one\ntwo\n") });

describe("POST /api/ingest", () => {
  it("answers once files are stored, then embeds them in the background", async () => {
    const res = await POST(uploadRequest(zipBytes()));
    const lines = (await res.text())
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
    const repoId = lines.at(-1).repoId;
    expect(lines.some((l) => l.stage === "storing")).toBe(true);
    await indexQueue().idle();
    const n = db.prepare("SELECT COUNT(*) AS n FROM chunks WHERE repo_id = ?").get(repoId) as {
      n: number;
    };
    expect(n.n).toBeGreaterThan(0);
    expect(new Repository(db).isIndexed(repoId)).toBe(true);
  });

  it("streams progress and sends exactly one done line, with the repoId", async () => {
    const res = await POST(uploadRequest(zipBytes()));
    const lines = (await res.text())
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
    const done = lines.filter((l) => l.stage === "done");
    expect(done).toHaveLength(1);
    expect(done[0].repoId).toEqual(expect.any(Number));
    expect(lines.at(-1)).toBe(done[0]);
  });

  it("refuses an upload whose content-length is over the cap, before parsing", async () => {
    const req = uploadRequest(zipBytes(), {
      "content-length": String(DEFAULT_LIMITS.maxArchiveBytes * 2),
    });
    const lines = (await (await POST(req)).text())
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
    expect(lines.at(-1)).toMatchObject({ stage: "error", message: "Archive is too large" });
  });
});

describe("readUpload", () => {
  it("stops reading when the streamed body exceeds the cap despite a small content-length", async () => {
    const limits = { ...DEFAULT_LIMITS, maxArchiveBytes: 10 };
    const big = new Uint8Array(200 * 1024);
    const req = uploadRequest(big, { "content-length": "5" });
    await expect(readUpload(req, limits)).rejects.toThrow(new IngestError("Archive is too large"));
  });
});
