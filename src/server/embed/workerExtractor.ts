import { Worker } from "node:worker_threads";
import type { Extractor } from "./embedder";

type Reply = { id: number; data?: Float32Array; dims?: number[]; error?: string };

/**
 * An Extractor that runs in a worker thread started from `file`. Requests are matched to
 * replies by id. If the worker dies, pending requests fail and the next call starts a new one.
 * The worker only keeps the process alive while requests are pending.
 */
export function workerExtractor(file: string, workerData: unknown): Extractor {
  let worker: Worker | undefined;
  let nextId = 0;
  const pending = new Map<number, { resolve: (r: Reply) => void; reject: (e: Error) => void }>();

  function failAll(e: Error) {
    for (const p of pending.values()) p.reject(e);
    pending.clear();
  }

  function start(): Worker {
    const w = new Worker(file, { workerData });
    w.on("message", (r: Reply) => {
      const p = pending.get(r.id);
      if (!p) return;
      pending.delete(r.id);
      if (pending.size === 0) w.unref();
      p.resolve(r);
    });
    const dead = (e: Error) => {
      if (worker === w) worker = undefined;
      failAll(e);
    };
    w.on("error", dead);
    w.on("exit", (code) => dead(new Error(`Embedding worker stopped (exit ${code})`)));
    return w;
  }

  return async (texts) => {
    worker ??= start();
    worker.ref();
    const id = nextId++;
    const reply = await new Promise<Reply>((resolve, reject) => {
      pending.set(id, { resolve, reject });
      worker!.postMessage({ id, texts });
    });
    if (reply.error !== undefined) throw new Error(reply.error);
    return { data: reply.data!, dims: reply.dims! };
  };
}
