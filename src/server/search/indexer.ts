import { setImmediate as yieldToEventLoop } from "node:timers/promises";
import { chunkFile } from "../chunk/chunker";
import type { Repository } from "../db/repository";
import type { Embedder } from "../embed/embedder";

export type IndexProgress = { stage: "indexing"; message: string; done: number; total: number };

const EMBED_BATCH = 64;

/**
 * Chunks every stored file of a repo, embeds the chunks and stores them for search, replacing
 * any chunks it had. Each batch is searchable as soon as it is stored; the repo is marked
 * indexed after the last one. Returns the chunk count.
 */
export async function indexRepo(
  repository: Repository,
  embedder: Embedder,
  repoId: number,
  onProgress: (p: IndexProgress) => void = () => {},
): Promise<number> {
  repository.clearChunks(repoId);
  const chunks = [];
  for (const file of repository.readFiles(repoId)) {
    chunks.push(...(await chunkFile(file.path, file.content)));
    await yieldToEventLoop(); // parsing is synchronous; let requests through between files
  }

  for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
    onProgress({
      stage: "indexing",
      message: `Embedding chunks ${i + 1}-${Math.min(i + EMBED_BATCH, chunks.length)} of ${chunks.length}`,
      done: i,
      total: chunks.length,
    });
    const batch = chunks.slice(i, i + EMBED_BATCH);
    await yieldToEventLoop();
    const embeddings = await embedder.embedDocuments(batch.map((c) => c.content));
    repository.addChunks(
      repoId,
      batch.map((c, j) => ({
        path: c.path,
        startLine: c.startLine,
        endLine: c.endLine,
        symbol: c.symbol,
        content: c.content,
        embedding: embeddings[j],
      })),
    );
  }
  onProgress({
    stage: "indexing",
    message: `Embedded ${chunks.length} chunks`,
    done: chunks.length,
    total: chunks.length,
  });
  repository.markIndexed(repoId);
  return chunks.length;
}
