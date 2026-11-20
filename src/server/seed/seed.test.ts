import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDb } from "../db";
import { Repository } from "../db/repository";
import { ingestFiles } from "../ingest/ingest";
import { EMBEDDING_DIMS, type Embedder } from "../embed/embedder";
import { readTree, sampleFromQuestions, seedSample } from "./seed";
import { seedOnStart } from "./startup";

const fakeEmbedder: Embedder = {
  embedDocuments: async (t) => t.map(() => new Float32Array(EMBEDDING_DIMS).fill(0.1)),
  embedQuery: async () => new Float32Array(EMBEDDING_DIMS).fill(0.1),
};

const dirs: string[] = [];
function tmp() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "seed-"));
  dirs.push(d);
  return d;
}
afterEach(() => dirs.splice(0).forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

function sampleDir() {
  const dir = tmp();
  fs.mkdirSync(path.join(dir, "lib"));
  fs.writeFileSync(path.join(dir, "lib/a.js"), "function a() {\n  return 1;\n}\n");
  fs.writeFileSync(path.join(dir, "index.js"), "module.exports = require('./lib/a');\n");
  return dir;
}

describe("seedSample", () => {
  it("indexes the sample once and skips it the second time", async () => {
    const repository = new Repository(openDb(":memory:"));
    const sample = { name: "s", dir: sampleDir(), source: "https://example.test/s" };
    expect(await seedSample(repository, fakeEmbedder, sample)).toBe(true);
    expect(await seedSample(repository, fakeEmbedder, sample)).toBe(false);
    const repos = repository.listRepos();
    expect(repos).toHaveLength(1);
    expect(repos[0].fileCount).toBe(2);
    expect(repository.searchKeyword(repos[0].id, "return").length).toBeGreaterThan(0);
  });

  it("removes a failed seed and indexes it fully on the next try", async () => {
    const repository = new Repository(openDb(":memory:"));
    const sample = { name: "s", dir: sampleDir(), source: "https://example.test/s" };
    const broken: Embedder = {
      ...fakeEmbedder,
      embedDocuments: async () => Promise.reject(new Error("offline")),
    };
    await expect(seedSample(repository, broken, sample)).rejects.toThrow("offline");
    expect(repository.listRepos()).toHaveLength(0);
    expect(await seedSample(repository, fakeEmbedder, sample)).toBe(true);
  });

  it("re-seeds a repo left half-indexed by an interrupted run", async () => {
    const repository = new Repository(openDb(":memory:"));
    const sample = { name: "s", dir: sampleDir(), source: "https://example.test/s" };
    ingestFiles(repository, { name: "s", source: sample.source, files: readTree(sample.dir) });
    expect(await seedSample(repository, fakeEmbedder, sample)).toBe(true);
    const repos = repository.listRepos();
    expect(repos).toHaveLength(1);
    expect(repository.isIndexed(repos[0].id)).toBe(true);
  });

  it("re-seeds a sample whose embedding stopped part-way", async () => {
    const repository = new Repository(openDb(":memory:"));
    const sample = { name: "s", dir: sampleDir(), source: "https://example.test/s" };
    const { repoId } = ingestFiles(repository, {
      name: "s",
      source: sample.source,
      files: readTree(sample.dir),
    });
    const embedding = new Float32Array(EMBEDDING_DIMS);
    repository.addChunks(repoId, [
      { path: "index.js", startLine: 1, endLine: 1, content: "x", embedding },
    ]);
    expect(repository.isIndexed(repoId)).toBe(false);
    expect(await seedSample(repository, fakeEmbedder, sample)).toBe(true);
  });

  it("reads a tree with forward-slash relative paths", () => {
    expect(
      readTree(sampleDir())
        .map((f) => f.path)
        .sort(),
    ).toEqual(["index.js", "lib/a.js"]);
  });

  it("names the pinned eval sample, which exists on disk", () => {
    const sample = sampleFromQuestions(path.resolve(import.meta.dirname, "../../.."));
    expect(sample.source).toContain("expressjs/express");
    expect(fs.existsSync(path.join(sample.dir, "lib/application.js"))).toBe(true);
  });
});

describe("seedOnStart", () => {
  it("does nothing when there is no sample to seed", async () => {
    await expect(seedOnStart(tmp())).resolves.toBeUndefined();
  });
});
