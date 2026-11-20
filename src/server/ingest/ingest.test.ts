import { zipSync, strToU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { openDb } from "../db";
import { Repository } from "../db/repository";
import { IngestError } from "./errors";
import { downloadGithubZip, parseGithubUrl } from "./github";
import { ingestFiles } from "./ingest";
import { DEFAULT_LIMITS, countLines, detectLanguage, isSkippedPath } from "./rules";
import { readZip, safeEntryPath, type RawFile } from "./zip";

const zip = (files: Record<string, string | Uint8Array>) =>
  Buffer.from(
    zipSync(
      Object.fromEntries(
        Object.entries(files).map(([k, v]) => [k, typeof v === "string" ? strToU8(v) : v]),
      ),
    ),
  );
const raw = (path: string, content: string | Uint8Array): RawFile => ({
  path,
  content: Buffer.from(typeof content === "string" ? strToU8(content) : content),
});

describe("skip rules", () => {
  it.each([
    "node_modules/a/index.js",
    "packages/x/vendor/lib.go",
    "dist/main.js",
    ".git/config",
    "pnpm-lock.yaml",
    "app/package-lock.json",
    "logo.png",
    "bundle.min.js",
  ])("skips %s", (p) => expect(isSkippedPath(p)).toBe(true));

  it.each(["src/index.ts", "README.md", "Dockerfile", "src/build.ts", "lib/vendorish.ts"])(
    "keeps %s",
    (p) => expect(isSkippedPath(p)).toBe(false),
  );

  it("detects language and counts lines", () => {
    expect(detectLanguage("a/b.tsx")).toBe("typescript");
    expect(detectLanguage("Dockerfile")).toBe("dockerfile");
    expect(detectLanguage("notes.xyz")).toBe("text");
    expect(countLines("a\nb\n")).toBe(2);
    expect(countLines("a\nb")).toBe(2);
    expect(countLines("")).toBe(0);
  });
});

describe("ingestFiles", () => {
  const setup = () => {
    const repository = new Repository(openDb(":memory:"));
    return repository;
  };

  it("stores path, language and line count, applying skip rules, .gitignore, binaries and size", () => {
    const repository = setup();
    const progress: string[] = [];
    const result = ingestFiles(
      repository,
      {
        name: "demo",
        source: "zip:demo.zip",
        limits: { ...DEFAULT_LIMITS, maxFileBytes: 100 },
        files: [
          raw("src/a.ts", "one\ntwo\n"),
          raw(".gitignore", "secret.txt\ngenerated/\n"),
          raw("secret.txt", "hidden"),
          raw("generated/x.ts", "x"),
          raw("node_modules/p/i.js", "x"),
          raw("data.txt", new Uint8Array([104, 0, 105])),
          raw("big.ts", "x".repeat(101)),
        ],
      },
      (p) => progress.push(p.stage),
    );
    expect(result).toMatchObject({ files: 2, skipped: 5 });
    expect(repository.listFiles(result.repoId)).toEqual([
      { path: ".gitignore", language: "text", lineCount: 2 },
      { path: "src/a.ts", language: "typescript", lineCount: 2 },
    ]);
    expect(progress).toEqual(["storing"]);
  });

  it("replaces a repo ingested twice from the same source", () => {
    const repository = setup();
    const opts = { name: "demo", source: "github:o/r" };
    ingestFiles(repository, { ...opts, files: [raw("a.ts", "1")] });
    const second = ingestFiles(repository, { ...opts, files: [raw("b.ts", "1\n2")] });
    expect(repository.listFiles(second.repoId).map((f) => f.path)).toEqual(["b.ts"]);
    const db = (repository as unknown as { db: ReturnType<typeof openDb> }).db;
    expect(db.prepare("SELECT COUNT(*) AS n FROM repos").get()).toEqual({ n: 1 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM files").get()).toEqual({ n: 1 });
  });

  it("rejects a repo with nothing to index", () => {
    expect(() =>
      ingestFiles(setup(), { name: "n", source: "s", files: [raw("logo.png", "x")] }),
    ).toThrow(IngestError);
  });
});

describe("readZip", () => {
  it("reads files and strips a single top-level folder", async () => {
    const files = await readZip(zip({ "repo-main/a.ts": "a", "repo-main/src/b.ts": "b" }));
    expect(files.map((f) => f.path).sort()).toEqual(["a.ts", "src/b.ts"]);
  });

  it("refuses zip-slip paths", async () => {
    await expect(readZip(zip({ "../evil.sh": "x", "ok.txt": "y" }))).rejects.toThrow(IngestError);
    await expect(readZip(zip({ "a/../../evil.sh": "x" }))).rejects.toThrow(IngestError);
    await expect(readZip(zip({ "/etc/passwd": "x" }))).rejects.toThrow(IngestError);
  });

  it("safeEntryPath rejects escapes and allows normal paths", () => {
    for (const bad of ["../x", "a/../../x", "/abs", "C:\\x", "a\\..\\..\\x"]) {
      expect(() => safeEntryPath(bad)).toThrow(/Unsafe path/);
    }
    expect(safeEntryPath("a/./b.ts")).toBe("a/b.ts");
  });

  it("refuses a non-zip", async () => {
    await expect(readZip(Buffer.from("not a zip"))).rejects.toThrow(/valid zip/);
  });

  it("refuses an archive over the size cap", async () => {
    const limits = { ...DEFAULT_LIMITS, maxArchiveBytes: 10 };
    await expect(readZip(zip({ "a.ts": "hello world" }), limits)).rejects.toThrow(/too large/);
  });

  it("refuses an archive that inflates past the uncompressed cap", async () => {
    const limits = { ...DEFAULT_LIMITS, maxFileBytes: 1000, maxUncompressedBytes: 1500 };
    const a = zip({ "a.txt": "a".repeat(900), "b.txt": "b".repeat(900) });
    await expect(readZip(a, limits)).rejects.toThrow(/too much data/);
  });

  it("refuses too many entries", async () => {
    const limits = { ...DEFAULT_LIMITS, maxEntries: 2 };
    await expect(readZip(zip({ a: "1", b: "2", c: "3" }), limits)).rejects.toThrow(
      /too many files/,
    );
  });

  it("does not read files over the per-file cap", async () => {
    const limits = { ...DEFAULT_LIMITS, maxFileBytes: 10 };
    const files = await readZip(zip({ "small.ts": "ok", "big.ts": "x".repeat(50) }), limits);
    expect(files.map((f) => f.path)).toEqual(["small.ts"]);
  });
});

describe("github", () => {
  it("parses repo URLs", () => {
    expect(parseGithubUrl("https://github.com/o/r")).toEqual({ owner: "o", repo: "r" });
    expect(parseGithubUrl("https://github.com/o/r.git")).toMatchObject({ repo: "r" });
    expect(parseGithubUrl("https://github.com/o/r/tree/dev")).toMatchObject({ ref: "dev" });
  });

  it.each(["http://github.com/o/r", "https://evil.com/o/r", "https://github.com/o", "nope"])(
    "rejects %s",
    (u) => expect(() => parseGithubUrl(u)).toThrow(IngestError),
  );

  const response = (body: string, init: ResponseInit = {}) =>
    (async () => new Response(body, init)) as unknown as typeof fetch;

  it("downloads the zip and enforces the size cap while streaming", async () => {
    const ref = { owner: "o", repo: "r" };
    expect((await downloadGithubZip(ref, DEFAULT_LIMITS, response("abc"))).toString()).toBe("abc");
    const limits = { ...DEFAULT_LIMITS, maxArchiveBytes: 2 };
    await expect(downloadGithubZip(ref, limits, response("abcdef"))).rejects.toThrow(/too large/);
  });

  it("reports a missing repo", async () => {
    await expect(
      downloadGithubZip({ owner: "o", repo: "r" }, DEFAULT_LIMITS, response("", { status: 404 })),
    ).rejects.toThrow(/not found/);
  });
});
