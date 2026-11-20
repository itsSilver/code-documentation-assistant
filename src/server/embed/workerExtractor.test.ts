import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { workerExtractor } from "./workerExtractor";

// A stand-in worker: answers each text with its length, fails on "boom", exits on "die".
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "worker-"));
const file = path.join(dir, "fake.mjs");
fs.writeFileSync(
  file,
  `import { parentPort } from "node:worker_threads";
parentPort.on("message", ({ id, texts }) => {
  if (texts[0] === "die") process.exit(3);
  if (texts[0] === "boom") return parentPort.postMessage({ id, error: "bad input" });
  const data = Float32Array.from(texts.map((t) => t.length));
  setTimeout(() => parentPort.postMessage({ id, data, dims: [texts.length, 1] }), 5 * texts.length);
});`,
);
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));
const opts = { pooling: "cls" as const, normalize: true };

describe("workerExtractor", () => {
  it("matches concurrent replies to their requests", async () => {
    const run = workerExtractor(file, {});
    const [a, b] = await Promise.all([run(["aaa", "bb"], opts), run(["c"], opts)]);
    expect(Array.from(a.data)).toEqual([3, 2]);
    expect(Array.from(b.data)).toEqual([1]);
  });

  it("passes worker errors on, and starts a new worker after one dies", async () => {
    const run = workerExtractor(file, {});
    await expect(run(["boom"], opts)).rejects.toThrow("bad input");
    await expect(run(["die"], opts)).rejects.toThrow("exit 3");
    expect(Array.from((await run(["ok"], opts)).data)).toEqual([2]);
  });
});
