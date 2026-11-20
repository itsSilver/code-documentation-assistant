import { describe, expect, it, vi } from "vitest";
import { openDb } from "@/server/db";
import { Repository } from "@/server/db/repository";
import { IndexQueue } from "@/server/search/jobs";

const db = openDb(":memory:");
vi.mock("@/server/db", async (orig) => ({ ...(await orig<object>()), getDb: () => db }));

vi.mock("@/server/embed/embedder", () => ({
  localEmbedder: {
    embedDocuments: async (texts: string[]) => texts.map(() => new Float32Array(384)),
    embedQuery: async () => new Float32Array(384),
  },
}));

const list = await import("./route");
const one = await import("./[id]/route");
const reindex = await import("./[id]/reindex/route");
const { indexQueue } = await import("@/server/search/queue");
const files = await import("./[id]/files/route");
const file = await import("./[id]/file/route");

const repo = new Repository(db);
const id = repo.replaceRepo("acme/demo", "zip:demo.zip", [
  { path: "src/a.ts", language: "typescript", lineCount: 2, content: "one\ntwo\n" },
]);
const pending = repo.replaceRepo("acme/pending", "zip:pending.zip", [
  { path: "b.ts", language: "typescript", lineCount: 1, content: "x\n" },
]);
repo.addChunks(id, [
  {
    path: "src/a.ts",
    startLine: 1,
    endLine: 2,
    content: "one\ntwo\n",
    embedding: new Float32Array(384),
  },
]);
repo.markIndexed(id);
const ctx = (v: string) => ({ params: Promise.resolve({ id: v }) });

describe("repo read routes", () => {
  it("lists every repo with its status; one with stored files but no chunks is incomplete", async () => {
    const body = await list.GET().json();
    expect(body.repos).toEqual([
      {
        id: pending,
        name: "acme/pending",
        source: "zip:pending.zip",
        fileCount: 1,
        status: "incomplete",
      },
      { id, name: "acme/demo", source: "zip:demo.zip", fileCount: 1, status: "ready" },
    ]);
  });

  it("re-indexes an incomplete repo in the queue until it is ready", async () => {
    const res = await reindex.POST(new Request("http://x"), ctx(String(pending)));
    expect(res.status).toBe(202);
    const during = (await list.GET().json()).repos.find((r: { id: number }) => r.id === pending);
    expect(["queued", "indexing"]).toContain(during.status);
    await indexQueue().idle();
    const after = (await list.GET().json()).repos.find((r: { id: number }) => r.id === pending);
    expect(after.status).toBe("ready");
    expect((await reindex.POST(new Request("http://x"), ctx("999"))).status).toBe(404);
  });

  it("removes a repo, but not while it is embedding", async () => {
    const extra = repo.replaceRepo("acme/x", "zip:x.zip", [
      { path: "x.ts", language: "typescript", lineCount: 1, content: "x\n" },
    ]);
    const holder = globalThis as { __indexQueue?: unknown };
    const real = holder.__indexQueue;
    holder.__indexQueue = new IndexQueue(() => new Promise(() => {})); // never finishes
    void indexQueue().enqueue(extra);
    expect((await one.DELETE(new Request("http://x"), ctx(String(extra)))).status).toBe(409);
    holder.__indexQueue = real;
    expect((await one.DELETE(new Request("http://x"), ctx(String(extra)))).status).toBe(204);
    expect(repo.listRepos().some((r) => r.id === extra)).toBe(false);
  });

  it("lists files of a repo and rejects a bad id", async () => {
    const ok = await (await files.GET(new Request("http://x"), ctx(String(id)))).json();
    expect(ok.files.map((f: { path: string }) => f.path)).toEqual(["src/a.ts"]);
    expect((await files.GET(new Request("http://x"), ctx("abc"))).status).toBe(400);
  });

  it("returns file content, 404 for unknown paths, 400 without a path", async () => {
    const url = (q: string) => new Request(`http://x/api?${q}`);
    const ok = await file.GET(url("path=src/a.ts"), ctx(String(id)));
    expect((await ok.json()).content).toBe("one\ntwo\n");
    expect((await file.GET(url("path=nope.ts"), ctx(String(id)))).status).toBe(404);
    expect((await file.GET(url(""), ctx(String(id)))).status).toBe(400);
  });
});
