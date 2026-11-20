import fs from "node:fs";
import path from "node:path";
import { embedder, getRepository } from "../container";
import { log } from "../obs/log";
import { indexQueue } from "../search/queue";
import { sampleFromQuestions, seedSample } from "./seed";

/** Seeds the sample repo on a fresh data file (pnpm dev). A failure is logged, never fatal. */
export async function seedOnStart(root = process.cwd()): Promise<void> {
  if (!fs.existsSync(path.join(root, "evals/questions.json"))) return;
  try {
    const sample = sampleFromQuestions(root);
    if (!fs.existsSync(sample.dir)) return;
    const seeded = await seedSample(getRepository(), embedder, sample, (id) =>
      indexQueue().enqueue(id),
    );
    if (seeded) log("info", "sample repo indexed", { name: sample.name });
  } catch (e) {
    log("error", "sample seeding failed", { error: e });
  }
}
