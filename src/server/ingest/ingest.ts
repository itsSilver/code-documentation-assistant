import ignore from "ignore";
import type { Repository } from "../db/repository";
import { IngestError } from "./errors";
import {
  DEFAULT_LIMITS,
  countLines,
  detectLanguage,
  isSkippedPath,
  looksBinary,
  type Limits,
} from "./rules";
import type { RawFile } from "./zip";

export type Progress = { stage: "reading" | "storing"; message: string };

export type IngestResult = { repoId: number; files: number; skipped: number };

/**
 * Filters the files with the skip rules and the repo's root .gitignore, then stores the
 * survivors. Reports progress only; the caller sends the final done. Ingesting a `source` that already exists replaces that repo.
 */
export function ingestFiles(
  repository: Repository,
  opts: { name: string; source: string; files: RawFile[]; limits?: Limits },
  onProgress: (p: Progress) => void = () => {},
): IngestResult {
  const limits = opts.limits ?? DEFAULT_LIMITS;
  const gitignore = opts.files.find((f) => f.path === ".gitignore");
  const ig = ignore().add(gitignore ? gitignore.content.toString("utf8") : "");

  const kept = [];
  let skipped = 0;
  for (const f of opts.files) {
    if (
      isSkippedPath(f.path) ||
      ig.ignores(f.path) ||
      f.content.length > limits.maxFileBytes ||
      looksBinary(f.content)
    ) {
      skipped++;
      continue;
    }
    const text = f.content.toString("utf8");
    kept.push({
      path: f.path,
      language: detectLanguage(f.path),
      lineCount: countLines(text),
      content: text,
    });
  }
  if (kept.length === 0) throw new IngestError("No indexable files found in this repository");

  onProgress({ stage: "storing", message: `Storing ${kept.length} files (${skipped} skipped)` });
  const repoId = repository.replaceRepo(opts.name, opts.source, kept);
  return { repoId, files: kept.length, skipped };
}
