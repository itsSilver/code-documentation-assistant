import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import { MIGRATIONS } from "./migrations";

export type Db = Database.Database;

export function openDb(file: string): Db {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  sqliteVec.load(db);
  migrate(db);
  return db;
}

export function migrate(db: Db): void {
  const current = db.pragma("user_version", { simple: true }) as number;
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[v]);
      db.pragma(`user_version = ${v + 1}`);
    })();
  }
}

let shared: Db | undefined;

/** Process-wide connection, created lazily so migrations run on first use at startup. */
export function getDb(): Db {
  shared ??= openDb(process.env.DATABASE_PATH ?? "./data/app.sqlite");
  return shared;
}
