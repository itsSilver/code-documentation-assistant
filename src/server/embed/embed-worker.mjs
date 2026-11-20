// Runs the embedding model on its own thread. onnxruntime-node blocks the thread it runs on,
// so on the main thread a background embed would stall every request. Plain .mjs so Node can
// start it directly; it is not part of the Next bundle.
import { parentPort, workerData } from "node:worker_threads";

const extractor = import("@huggingface/transformers").then((m) =>
  m.pipeline("feature-extraction", workerData.model, { dtype: "q8" }),
);

// One inference at a time: a query and a document batch must not run on the session at once.
let queue = Promise.resolve();

parentPort.on("message", ({ id, texts }) => {
  queue = queue.then(async () => {
    try {
      const run = await extractor;
      const { data, dims } = await run(texts, { pooling: "cls", normalize: true });
      const out = Float32Array.from(data);
      parentPort.postMessage({ id, data: out, dims }, [out.buffer]);
    } catch (e) {
      parentPort.postMessage({ id, error: e instanceof Error ? e.message : String(e) });
    }
  });
});
