import evals from "../../../evals/questions.json";

const SAMPLE_STARTER_IDS = ["q12", "q07", "q02", "q09"];

/** The bundled sample's source, so the UI can tell it apart from a user's repo. */
export const SAMPLE_SOURCE = evals.sample.source;

function sampleStarters(): string[] {
  return SAMPLE_STARTER_IDS.map((id) => evals.questions.find((q) => q.id === id)!.question);
}

/**
 * Starter questions for a repo. The sample gets curated questions from the eval set; any other
 * repo gets questions picked from what its files suggest, each only when the files make it
 * answerable. No model call.
 */
export function starterQuestions(paths: string[], source?: string): string[] {
  if (source === SAMPLE_SOURCE) return sampleStarters();
  const has = (re: RegExp) => paths.some((p) => re.test(p));
  const out = ["What does this project do, and how is it structured?"];
  const depth = (p: string) => p.split("/").length;
  const entry = paths
    .filter((p) => /(^|\/)(main|index|app|server|cli)\.(ts|tsx|js|jsx|py|go)$/.test(p))
    .filter((p) => !/(^|\/)(examples?|tests?|docs?|fixtures?)\//.test(p))
    .sort((a, b) => depth(a) - depth(b))[0];
  if (entry) out.push(`What happens when ${entry} runs?`);
  // Directories only: a file like router/route.js is a framework, not an app with endpoints.
  if (has(/(^|\/)(routes|api|controllers|handlers|endpoints)\//))
    out.push("Which HTTP endpoints does it expose, and where are they defined?");
  if (has(/(^|\/)(db|models?|schema|migrations?)(\/|\.)/))
    out.push("How is data stored and modelled?");
  if (has(/(^|\/)(auth|login|session)/i)) out.push("How does authentication work?");
  if (has(/(^|\/)(package\.json|pyproject\.toml|requirements\.txt|go\.mod|Cargo\.toml)$/))
    out.push("What are the main dependencies, and what is each used for?");
  if (has(/(\.test\.|\.spec\.|(^|\/)tests?\/|_test\.)/)) out.push("How are the tests organised?");
  return out.slice(0, 4);
}
