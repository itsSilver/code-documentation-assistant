import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import { openDb } from "./index";
import { MIGRATIONS } from "./migrations";
import { Repository } from "./repository";

const vec = (i: number) => {
  const v = new Float32Array(384);
  v[i] = 1;
  return v;
};

describe("database", () => {
  it("opens, migrates and loads sqlite-vec and FTS5", () => {
    const db = openDb(":memory:");
    expect(db.pragma("user_version", { simple: true })).toBe(6);
    expect(db.prepare("SELECT vec_version() AS v").get()).toHaveProperty("v");
    const row = db.prepare("SELECT name FROM sqlite_master WHERE name = 'chunks_fts'").get();
    expect(row).toBeDefined();
  });

  it("finds chunks by keyword and by vector, scoped to a repo", () => {
    const repo = new Repository(openDb(":memory:"));
    const a = repo.createRepo("a", "zip");
    const b = repo.createRepo("b", "zip");
    repo.addChunks(a, [
      {
        path: "x.ts",
        startLine: 1,
        endLine: 5,
        content: "function parseConfig() {}",
        embedding: vec(0),
      },
      { path: "y.ts", startLine: 1, endLine: 5, content: "const unrelated = 1", embedding: vec(1) },
    ]);
    repo.addChunks(b, [
      {
        path: "z.ts",
        startLine: 1,
        endLine: 2,
        content: "parseConfig elsewhere",
        embedding: vec(0),
      },
    ]);

    const kw = repo.searchKeyword(a, "parseConfig");
    expect(kw.map((c) => c.path)).toEqual(["x.ts"]);
    expect(kw[0]).toMatchObject({ startLine: 1, endLine: 5 });

    const near = repo.searchVector(a, vec(1), 5);
    expect(near[0].path).toBe("y.ts");
    expect(near.every((c) => c.path !== "z.ts")).toBe(true);
  });

  it("ranks vectors within the repo, however many closer ones other repos hold", () => {
    const repo = new Repository(openDb(":memory:"));
    const a = repo.createRepo("a", "zip");
    const b = repo.createRepo("b", "zip");
    const chunk = (p: string, i: number) => ({
      path: p,
      startLine: 1,
      endLine: 1,
      content: p,
      embedding: vec(i),
    });
    // Repo b holds five exact matches for the query; repo a holds one distant chunk.
    repo.addChunks(
      b,
      [1, 2, 3, 4, 5].map((n) => chunk(`b${n}.ts`, 0)),
    );
    repo.addChunks(a, [chunk("a.ts", 1)]);

    expect(repo.searchVector(a, vec(0), 2).map((c) => c.path)).toEqual(["a.ts"]);
  });

  it("moves existing vectors into the per-repo table when upgrading", () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "db-")), "t.sqlite");
    const old = new Database(file);
    sqliteVec.load(old);
    old.pragma("foreign_keys = ON");
    for (const sql of MIGRATIONS.slice(0, 5)) old.exec(sql);
    old.pragma("user_version = 5");
    old.prepare("INSERT INTO repos (id, name, source) VALUES (1, 'a', 'zip')").run();
    old
      .prepare(
        "INSERT INTO chunks (id, repo_id, path, start_line, end_line, content) VALUES (7, 1, 'x.ts', 1, 2, 'x')",
      )
      .run();
    old
      .prepare("INSERT INTO chunks_vec (rowid, embedding) VALUES (?, ?)")
      .run(7n, Buffer.from(vec(3).buffer));
    old.close();

    const repo = new Repository(openDb(file));
    expect(repo.searchVector(1, vec(3), 5).map((c) => c.id)).toEqual([7]);
  });

  it("reopens an already migrated file without re-running migrations", () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "db-")), "t.sqlite");
    openDb(file).close();
    const db = openDb(file);
    expect(db.pragma("user_version", { simple: true })).toBe(6);
  });

  it("deleting a repo removes its chunks, keywords and vectors so ids can be reused", () => {
    const db = openDb(":memory:");
    const repo = new Repository(db);
    const chunk = (content: string, i: number) => ({
      path: "x.ts",
      startLine: 1,
      endLine: 2,
      content,
      embedding: vec(i),
    });
    const a = repo.createRepo("a", "zip");
    repo.addChunks(a, [chunk("alpha token", 0), chunk("beta token", 1)]);

    db.prepare("DELETE FROM repos WHERE id = ?").run(a);
    expect(db.prepare("SELECT count(*) AS n FROM chunks_vec").get()).toEqual({ n: 0 });
    expect(repo.searchKeyword(a, "token")).toEqual([]);

    const b = repo.createRepo("b", "zip");
    expect(() =>
      repo.addChunks(b, [chunk("gamma token", 0), chunk("delta token", 1)]),
    ).not.toThrow();
    expect(repo.searchKeyword(b, "token")).toHaveLength(2);
    expect(repo.searchVector(b, vec(0), 5)[0].content).toBe("gamma token");
  });
});
