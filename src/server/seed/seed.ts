import fs from "node:fs";
import path from "node:path";
import type { Repository } from "../db/repository";
import type { Embedder } from "../embed/embedder";
import { ingestFiles } from "../ingest/ingest";
import type { RawFile } from "../ingest/zip";
import { indexRepo } from "../search/indexer";

export type SampleRepo = { name: string; dir: string; source: string };

export function readTree(dir: string, base = dir): RawFile[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory()
      ? readTree(full, base)
      : [
          {
            path: path.relative(base, full).split(path.sep).join("/"),
            content: fs.readFileSync(full),
          },
        ];
  });
}

/** The pinned sample repo named in the eval question set, so the app and the eval share one repo. */
export function sampleFromQuestions(root: string): SampleRepo {
  const set = JSON.parse(fs.readFileSync(path.join(root, "evals/questions.json"), "utf8"));
  return { ...set.sample, dir: path.join(root, set.sample.dir) };
}

/**
 * Indexes the sample repo unless it is already fully indexed. Returns false when it was, so
 * running it on every start is cheap. A half-indexed copy (an earlier run failed or was
 * interrupted) is replaced, and a failed run removes its partial rows.
 */
export async function seedSample(
  repository: Repository,
  embedder: Embedder,
  sample: SampleRepo,
  /** Runs the embedding; the app passes its job queue so the sample shows progress. */
  index: (repoId: number) => Promise<unknown> = (repoId) => indexRepo(repository, embedder, repoId),
): Promise<boolean> {
  if (repository.listRepos().some((r) => r.source === sample.source && repository.isIndexed(r.id)))
    return false;
  const { repoId } = ingestFiles(repository, {
    name: sample.name,
    source: sample.source,
    files: readTree(sample.dir),
  });
  try {
    await index(repoId);
  } catch (e) {
    repository.deleteRepo(repoId);
    throw e;
  }
  return true;
}
