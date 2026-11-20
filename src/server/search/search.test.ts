import { describe, expect, it } from "vitest";
import { openDb } from "../db";
import { Repository } from "../db/repository";
import { EMBEDDING_DIMS, localEmbedder, type Embedder } from "../embed/embedder";
import { reciprocalRankFusion, RRF_K } from "./fusion";
import { indexRepo } from "./indexer";
import { search, toFtsQuery } from "./search";

/** Words that mean the same thing share a dimension, so paraphrases land close together. */
const CONCEPTS = [
  ["config", "configuration", "settings", "options"],
  ["load", "read", "parse", "open"],
  ["disk", "file", "path"],
  ["send", "email", "mail", "message"],
  ["cart", "basket", "total", "price"],
];

function conceptVector(text: string): Float32Array {
  const v = new Float32Array(EMBEDDING_DIMS);
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  CONCEPTS.forEach((group, i) => {
    v[i] = words.filter((w) => group.some((g) => w.includes(g))).length;
  });
  const norm = Math.hypot(...v) || 1;
  return v.map((x) => x / norm);
}

const fakeEmbedder: Embedder = {
  embedDocuments: async (texts) => texts.map(conceptVector),
  embedQuery: async (text) => conceptVector(text),
};

const FILES = {
  "src/config.ts": "export function parseConfig(text: string) {\n  return JSON.parse(text);\n}\n",
  "src/mailer.ts":
    "export function sendWelcome(to: string) {\n  return smtp.deliver(to, 'hello');\n}\n",
  "src/cart.ts":
    "export class Cart {\n  total() {\n    return this.items.reduce((s, i) => s + i.price, 0);\n  }\n}\n",
};

async function setup(embedder: Embedder = fakeEmbedder) {
  const repository = new Repository(openDb(":memory:"));
  const files = Object.entries(FILES).map(([path, content]) => ({
    path,
    language: "typescript",
    lineCount: content.split("\n").length - 1,
    content,
  }));
  const repoId = repository.replaceRepo("demo", "zip:demo", files);
  const count = await indexRepo(repository, embedder, repoId);
  return { deps: { repository, embedder }, repoId, count };
}

describe("reciprocalRankFusion", () => {
  it("rewards ids that appear in both lists", () => {
    const fused = reciprocalRankFusion([
      [1, 2, 3],
      [3, 4],
    ]);
    expect(fused[0].id).toBe(3);
    expect(fused[0].score).toBeCloseTo(1 / (RRF_K + 3) + 1 / (RRF_K + 1));
  });

  it("breaks ties on the smaller id, whatever the input order", () => {
    expect(reciprocalRankFusion([[9], [4]]).map((r) => r.id)).toEqual([4, 9]);
    expect(reciprocalRankFusion([[4], [9]]).map((r) => r.id)).toEqual([4, 9]);
  });
});

describe("toFtsQuery", () => {
  it("quotes identifiers so punctuation and operators cannot break the query", () => {
    expect(toFtsQuery('where is parseConfig() NOT "used"?')).toBe(
      '"where" OR "is" OR "parseConfig" OR "NOT" OR "used"',
    );
    expect(toFtsQuery("???")).toBe("");
  });
});

describe("search", () => {
  it("indexes files into chunks that carry their symbol", async () => {
    const { count, deps, repoId } = await setup();
    expect(count).toBeGreaterThanOrEqual(3);
    const hits = await search(deps, repoId, "parseConfig", 5);
    expect(hits[0].chunk).toMatchObject({ path: "src/config.ts", symbol: "parseConfig" });
  });

  it("finds a function named in the query through keywords alone", async () => {
    // A zero vector gives the vector side no signal, so only FTS5 can rank sendWelcome first.
    const blind: Embedder = {
      embedDocuments: async (t) => t.map(() => new Float32Array(EMBEDDING_DIMS)),
      embedQuery: async () => new Float32Array(EMBEDDING_DIMS),
    };
    const { deps, repoId } = await setup(blind);
    const hits = await search(deps, repoId, "sendWelcome", 3);
    expect(hits[0].chunk.path).toBe("src/mailer.ts");
  });

  it("finds a paraphrase through vectors when no keyword matches", async () => {
    const { deps, repoId } = await setup();
    const query = "read the settings from disk";
    expect(
      deps.repository.searchKeyword(repoId, toFtsQuery(query).replace(/"(the|from)"/g, '"zzz"')),
    ).toEqual([]);
    const hits = await search(deps, repoId, query, 3);
    expect(hits[0].chunk.path).toBe("src/config.ts");
  });

  it("boosts a chunk whose path the query names", async () => {
    const { deps, repoId } = await setup();
    const hits = await search(deps, repoId, "how does src/mailer.ts work", 3);
    expect(hits[0].chunk.path).toBe("src/mailer.ts");
  });

  it("returns the same order every time and at most k hits", async () => {
    const { deps, repoId } = await setup();
    const run = async () =>
      (await search(deps, repoId, "total price of the cart", 2)).map((h) => h.chunk.id);
    const first = await run();
    expect(first).toHaveLength(2);
    expect(await run()).toEqual(first);
  });

  it("returns nothing for a repo with no chunks", async () => {
    const { deps } = await setup();
    const empty = deps.repository.createRepo("empty", "zip:empty");
    expect(await search(deps, empty, "anything", 5)).toEqual([]);
  });
});

// Downloads the model (about 35 MB) on first run, so it is opt-in: RUN_MODEL_TESTS=1 pnpm test.
describe.skipIf(!process.env.RUN_MODEL_TESTS)("local embedder", () => {
  it("embeds to unit vectors and finds a paraphrase without shared keywords", async () => {
    const [a] = await localEmbedder.embedDocuments(["x"]);
    expect(a).toHaveLength(EMBEDDING_DIMS);
    expect(Math.hypot(...a)).toBeCloseTo(1, 3);

    const { deps, repoId } = await setup(localEmbedder);
    const hits = await search(deps, repoId, "read the settings from disk", 3);
    expect(hits[0].chunk.path).toBe("src/config.ts");
  }, 120_000);
});
