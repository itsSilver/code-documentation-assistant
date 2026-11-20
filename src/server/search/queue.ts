import { embedder, getRepository } from "../container";
import { indexRepo } from "./indexer";
import { IndexQueue } from "./jobs";

// Kept on globalThis so Next's dev reloads and separate route bundles share one queue.
const holder = globalThis as typeof globalThis & { __indexQueue?: IndexQueue };

/** The process-wide embedding queue. */
export function indexQueue(): IndexQueue {
  holder.__indexQueue ??= new IndexQueue((repoId, onProgress) =>
    indexRepo(getRepository(), embedder, repoId, (p) => onProgress(p.done, p.total)),
  );
  return holder.__indexQueue;
}
