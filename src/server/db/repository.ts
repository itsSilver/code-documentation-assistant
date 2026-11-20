import type { RepoFile, RepoSummary } from "@/shared/contracts";
import type { Db } from "./index";

export type ChunkInput = {
  path: string;
  startLine: number;
  endLine: number;
  content: string;
  symbol?: string | null;
  embedding: Float32Array;
};

export type Chunk = {
  id: number;
  path: string;
  startLine: number;
  endLine: number;
  symbol: string | null;
  content: string;
};

export type FileInput = { path: string; language: string; lineCount: number; content: string };

export type { RepoSummary };

export type StoredFile = RepoFile;

export class Repository {
  constructor(private readonly db: Db) {}

  createRepo(name: string, source: string): number {
    const r = this.db.prepare("INSERT INTO repos (name, source) VALUES (?, ?)").run(name, source);
    return Number(r.lastInsertRowid);
  }

  /** Stores a repo and its files, replacing any repo with the same source, atomically. */
  replaceRepo(name: string, source: string, files: FileInput[]): number {
    const insert = this.db.prepare(
      "INSERT INTO files (repo_id, path, language, line_count, content) VALUES (?, ?, ?, ?, ?)",
    );
    return this.db.transaction(() => {
      this.db.prepare("DELETE FROM repos WHERE source = ?").run(source);
      const id = this.createRepo(name, source);
      for (const f of files) insert.run(id, f.path, f.language, f.lineCount, f.content);
      return id;
    })();
  }

  listRepos(): RepoSummary[] {
    return this.db
      .prepare(
        `SELECT r.id, r.name, r.source, COUNT(f.id) AS fileCount
         FROM repos r LEFT JOIN files f ON f.repo_id = r.id
         GROUP BY r.id ORDER BY r.id DESC`,
      )
      .all() as RepoSummary[];
  }

  /** True once embedding finished for every chunk (indexRepo marks it at the end). */
  isIndexed(repoId: number): boolean {
    return !!this.db
      .prepare("SELECT 1 FROM repos WHERE id = ? AND indexed_at IS NOT NULL")
      .get(repoId);
  }

  markIndexed(repoId: number): void {
    this.db.prepare("UPDATE repos SET indexed_at = datetime('now') WHERE id = ?").run(repoId);
  }

  /** Drops a repo's chunks (and their keywords and vectors) so it can be embedded again. */
  clearChunks(repoId: number): void {
    this.db.transaction(() => {
      this.db.prepare("UPDATE repos SET indexed_at = NULL WHERE id = ?").run(repoId);
      this.db.prepare("DELETE FROM chunks WHERE repo_id = ?").run(repoId);
    })();
  }

  countChunks(repoId: number): number {
    return (
      this.db.prepare("SELECT COUNT(*) AS n FROM chunks WHERE repo_id = ?").get(repoId) as {
        n: number;
      }
    ).n;
  }

  deleteRepo(repoId: number): void {
    this.db.prepare("DELETE FROM repos WHERE id = ?").run(repoId);
  }

  readFile(
    repoId: number,
    path: string,
  ): { path: string; language: string; content: string } | null {
    const row = this.db
      .prepare("SELECT path, language, content FROM files WHERE repo_id = ? AND path = ?")
      .get(repoId, path);
    return (row as { path: string; language: string; content: string } | undefined) ?? null;
  }

  listFiles(repoId: number): StoredFile[] {
    return this.db
      .prepare(
        "SELECT path, language, line_count AS lineCount FROM files WHERE repo_id = ? ORDER BY path",
      )
      .all(repoId) as StoredFile[];
  }

  readFiles(repoId: number): { path: string; content: string }[] {
    return this.db
      .prepare("SELECT path, content FROM files WHERE repo_id = ? ORDER BY path")
      .all(repoId) as { path: string; content: string }[];
  }

  addChunks(repoId: number, chunks: ChunkInput[]): void {
    const insert = this.db.prepare(
      "INSERT INTO chunks (repo_id, path, start_line, end_line, symbol, content) VALUES (?, ?, ?, ?, ?, ?)",
    );
    const insertVec = this.db.prepare("INSERT INTO chunks_vec (rowid, embedding) VALUES (?, ?)");
    this.db.transaction(() => {
      for (const c of chunks) {
        const id = insert.run(
          repoId,
          c.path,
          c.startLine,
          c.endLine,
          c.symbol ?? null,
          c.content,
        ).lastInsertRowid;
        insertVec.run(BigInt(id), Buffer.from(c.embedding.buffer));
      }
    })();
  }

  searchKeyword(repoId: number, query: string, limit = 10): Chunk[] {
    return this.db
      .prepare(
        `SELECT c.id, c.path, c.start_line AS startLine, c.end_line AS endLine, c.symbol, c.content
         FROM chunks_fts JOIN chunks c ON c.id = chunks_fts.rowid
         WHERE chunks_fts MATCH ? AND c.repo_id = ?
         ORDER BY bm25(chunks_fts) LIMIT ?`,
      )
      .all(query, repoId, limit) as Chunk[];
  }

  searchVector(repoId: number, embedding: Float32Array, limit = 10): Chunk[] {
    return this.db
      .prepare(
        `SELECT c.id, c.path, c.start_line AS startLine, c.end_line AS endLine, c.symbol, c.content
         FROM (SELECT rowid, distance FROM chunks_vec WHERE embedding MATCH ? AND k = ?) v
         JOIN chunks c ON c.id = v.rowid
         WHERE c.repo_id = ?
         ORDER BY v.distance`,
      )
      .all(Buffer.from(embedding.buffer), limit, repoId) as Chunk[];
  }
}
