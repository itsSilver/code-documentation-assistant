import path from "node:path";
import { workerExtractor } from "./workerExtractor";

/** Turns text into unit-length vectors of EMBEDDING_DIMS numbers. */
export interface Embedder {
  /** Chunks to be stored. */
  embedDocuments(texts: string[]): Promise<Float32Array[]>;
  /** A user's question; some models embed queries differently from documents. */
  embedQuery(text: string): Promise<Float32Array>;
}

/** Must match `chunks_vec` in the migrations. */
export const EMBEDDING_DIMS = 384;

export const EMBEDDING_MODEL = "Xenova/bge-small-en-v1.5";

/** bge's documented instruction for short queries against longer passages. */
const QUERY_PREFIX = "Represent this sentence for searching relevant passages: ";

const BATCH_SIZE = 16;

export type Extractor = (
  texts: string[],
  opts: { pooling: "cls"; normalize: boolean },
) => Promise<{ data: Float32Array | ArrayLike<number>; dims: number[] }>;

/** The model runs in a worker thread (see embed-worker.mjs), so embedding never blocks requests. */
async function loadModel(): Promise<Extractor> {
  const file = path.join(process.cwd(), "src/server/embed/embed-worker.mjs");
  return workerExtractor(file, { model: EMBEDDING_MODEL });
}

/** Builds an embedder around a model loader. The model loads once; a failed load is retried on the next call. */
export function createEmbedder(load: () => Promise<Extractor>): Embedder {
  let extractor: Promise<Extractor> | undefined;

  function loadExtractor(): Promise<Extractor> {
    if (!extractor) {
      const attempt = load();
      extractor = attempt;
      // Forget a failed load so a transient error (e.g. a dropped download) does not stick until restart.
      attempt.catch(() => {
        if (extractor === attempt) extractor = undefined;
      });
    }
    return extractor;
  }

  async function embed(texts: string[]): Promise<Float32Array[]> {
    const run = await loadExtractor();
    const out: Float32Array[] = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const { data } = await run(texts.slice(i, i + BATCH_SIZE), {
        pooling: "cls",
        normalize: true,
      });
      const rows = data.length / EMBEDDING_DIMS;
      // Copy, not subarray(): each vector must own its buffer, because it is stored from `.buffer`.
      for (let r = 0; r < rows; r++) {
        out.push(
          Float32Array.from(
            Array.prototype.slice.call(data, r * EMBEDDING_DIMS, (r + 1) * EMBEDDING_DIMS),
          ),
        );
      }
    }
    return out;
  }

  return {
    embedDocuments: embed,
    async embedQuery(text) {
      return (await embed([QUERY_PREFIX + text]))[0];
    },
  };
}

/** In-process embeddings from a small open model; needs no API key. The first run downloads about 35 MB. */
export const localEmbedder: Embedder = createEmbedder(loadModel);
