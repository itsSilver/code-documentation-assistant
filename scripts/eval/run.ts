/**
 * `pnpm eval`: indexes the pinned sample repo in memory, scores retrieval on the fixed question
 * set, and, when an LLM is configured, scores the answers too. Writes evals/results/<date>.{json,md}.
 * Pass --no-llm to score retrieval only.
 */
import fs from "node:fs";
import path from "node:path";
import { answerQuestion } from "../../src/server/chat/chat";
import { openDb } from "../../src/server/db";
import { Repository } from "../../src/server/db/repository";
import { EMBEDDING_MODEL, localEmbedder } from "../../src/server/embed/embedder";
import { ingestFiles } from "../../src/server/ingest/ingest";
import type { RawFile } from "../../src/server/ingest/zip";
import { createLlm } from "../../src/server/llm/providers";
import type { Llm } from "../../src/server/llm/types";
import { indexRepo } from "../../src/server/search/indexer";
import { search } from "../../src/server/search/search";
import { readTree } from "../../src/server/seed/seed";
import { gradeAnswer } from "./judge";
import { citationPrecision, firstHitRank, type Span } from "./metrics";
import { summarize, toMarkdown, type AnswerResult, type QuestionResult } from "./report";

/** Same as TOP_K in the chat route, so retrieval is measured as the app uses it. */
const TOP_K = 12;

type Question = { id: string; question: string; expect: Span[] };
type QuestionSet = { sample: { name: string; dir: string; source: string }; questions: Question[] };

const root = path.resolve(import.meta.dirname, "../..");

function reference(files: RawFile[], expect: Span[]): string {
  return expect
    .map((s) => {
      const lines = files
        .find((f) => f.path === s.path)!
        .content.toString("utf8")
        .split("\n");
      return `${s.path}:${s.startLine}-${s.endLine}\n${lines.slice(s.startLine - 1, s.endLine).join("\n")}`;
    })
    .join("\n\n");
}

function tryLlm(): Llm | null {
  if (process.argv.includes("--no-llm")) return null;
  try {
    return createLlm();
  } catch (e) {
    console.log(`Skipping answer scoring: ${(e as Error).message}`);
    return null;
  }
}

async function main() {
  const set: QuestionSet = JSON.parse(
    fs.readFileSync(path.join(root, "evals/questions.json"), "utf8"),
  );
  const files = readTree(path.join(root, set.sample.dir));

  const repository = new Repository(openDb(":memory:"));
  const { repoId } = ingestFiles(repository, {
    name: set.sample.name,
    source: set.sample.source,
    files,
  });
  console.log("Indexing the sample repo (the first run downloads the embedding model)...");
  const chunkCount = await indexRepo(repository, localEmbedder, repoId);
  const retrieve = (q: string) => search({ repository, embedder: localEmbedder }, repoId, q, TOP_K);

  const llm = tryLlm();
  const results: QuestionResult[] = [];
  for (const q of set.questions) {
    const hits = await retrieve(q.question);
    const retrieved = hits.map((h) => ({
      path: h.chunk.path,
      startLine: h.chunk.startLine,
      endLine: h.chunk.endLine,
    }));
    const answerable = q.expect.length > 0;
    const result: QuestionResult = {
      id: q.id,
      question: q.question,
      answerable,
      rank: answerable ? firstHitRank(retrieved, q.expect) : null,
      retrieved,
    };
    if (llm) result.answer = await answer(llm, q, answerable, files, retrieve);
    results.push(result);
    console.log(`${q.id} rank=${answerable ? (result.rank ?? "miss") : "n/a"}`);
  }

  const summary = summarize(results);
  const info = {
    date: new Date().toISOString(),
    sample: set.sample.source,
    chunks: chunkCount,
    "top k": TOP_K,
    embeddings: EMBEDDING_MODEL,
    llm: llm
      ? `${process.env.LLM_PROVIDER || "openrouter"} ${process.env.LLM_MODEL || "(default)"}`
      : "none",
  };
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "-");
  const outDir = path.join(root, "evals/results");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, `${stamp}.json`),
    JSON.stringify({ info, summary, results }, null, 2) + "\n",
  );
  const md = toMarkdown(info, results, summary);
  fs.writeFileSync(path.join(outDir, `${stamp}.md`), md);
  console.log("\n" + md + `\nWrote evals/results/${stamp}.{json,md}`);
}

async function answer(
  llm: Llm,
  q: Question,
  answerable: boolean,
  files: RawFile[],
  retrieve: Parameters<typeof answerQuestion>[0]["retrieve"],
): Promise<AnswerResult> {
  try {
    let text = "";
    let done: { citations: Span[]; answered: boolean } = { citations: [], answered: false };
    for await (const ev of answerQuestion({ llm, retrieve }, q.question, [])) {
      if (ev.type === "delta") text += ev.text;
      if (ev.type === "done") done = ev;
    }
    const grade = answerable
      ? await gradeAnswer(llm, {
          question: q.question,
          reference: reference(files, q.expect),
          answer: text,
        })
      : null;
    return {
      text,
      answered: done.answered,
      citations: done.citations,
      citationPrecision: answerable ? citationPrecision(done.citations, q.expect) : null,
      grade,
    };
  } catch (e) {
    return {
      text: "",
      answered: false,
      citations: [],
      citationPrecision: null,
      grade: null,
      error: (e as Error).message,
    };
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
