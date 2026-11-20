/** `pnpm seed`: indexes the sample repo into DATABASE_PATH. Run it to pre-index the sample before the first start. */
import path from "node:path";
import { embedder, getRepository } from "../src/server/container";
import { sampleFromQuestions, seedSample } from "../src/server/seed/seed";

const root = path.resolve(import.meta.dirname, "..");
const sample = sampleFromQuestions(root);
console.log(`Seeding ${sample.name} (the first run downloads the embedding model)...`);
const seeded = await seedSample(getRepository(), embedder, sample);
console.log(seeded ? "Seeded." : "Already seeded.");
