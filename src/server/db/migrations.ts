/** Ordered, append-only. Index + 1 is the schema version stored in `PRAGMA user_version`. */
export const MIGRATIONS: string[] = [
  `
  CREATE TABLE repos (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    source TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE chunks (
    id INTEGER PRIMARY KEY,
    repo_id INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    start_line INTEGER NOT NULL,
    end_line INTEGER NOT NULL,
    content TEXT NOT NULL
  );
  CREATE INDEX chunks_repo_idx ON chunks(repo_id);
  CREATE VIRTUAL TABLE chunks_fts USING fts5(
    content, path, content='chunks', content_rowid='id'
  );
  CREATE TRIGGER chunks_ai AFTER INSERT ON chunks BEGIN
    INSERT INTO chunks_fts(rowid, content, path) VALUES (new.id, new.content, new.path);
  END;
  CREATE TRIGGER chunks_ad AFTER DELETE ON chunks BEGIN
    INSERT INTO chunks_fts(chunks_fts, rowid, content, path)
      VALUES ('delete', old.id, old.content, old.path);
  END;
  CREATE VIRTUAL TABLE chunks_vec USING vec0(embedding float[384]);
  `,
  // Deleting a chunk (e.g. via repo cascade) must also drop its vector, or reused ids collide.
  `
  DELETE FROM chunks_vec WHERE rowid NOT IN (SELECT id FROM chunks);
  DROP TRIGGER chunks_ad;
  CREATE TRIGGER chunks_ad AFTER DELETE ON chunks BEGIN
    INSERT INTO chunks_fts(chunks_fts, rowid, content, path)
      VALUES ('delete', old.id, old.content, old.path);
    DELETE FROM chunks_vec WHERE rowid = old.id;
  END;
  `,
  // Source files of an ingested repo, kept whole so the code viewer can show any cited lines.
  `
  CREATE TABLE files (
    id INTEGER PRIMARY KEY,
    repo_id INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    language TEXT NOT NULL,
    line_count INTEGER NOT NULL,
    content TEXT NOT NULL,
    UNIQUE (repo_id, path)
  );
  `,
  // Symbol name per chunk, so search can boost chunks whose symbol the query names.
  `
  ALTER TABLE chunks ADD COLUMN symbol TEXT;
  `,
  // When embedding finished. Null while a repo is still embedding or was interrupted, so a
  // partly embedded repo is not mistaken for a complete one. Existing repos with chunks count.
  `
  ALTER TABLE repos ADD COLUMN indexed_at TEXT;
  UPDATE repos SET indexed_at = datetime('now') WHERE id IN (SELECT DISTINCT repo_id FROM chunks);
  `,
];
