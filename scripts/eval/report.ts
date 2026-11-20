import { MAX_GRADE, type Grade } from "./judge";
import { mean, summarizeRetrieval, type RetrievalSummary, type Span } from "./metrics";

export type AnswerResult = {
  text: string;
  answered: boolean;
  citations: Span[];
  /** Null when nothing was cited, or the question has no answer in the repo. */
  citationPrecision: number | null;
  grade: Grade | null;
  error?: string;
};

export type QuestionResult = {
  id: string;
  question: string;
  answerable: boolean;
  rank: number | null;
  retrieved: Span[];
  answer?: AnswerResult;
};

export type AnswerSummary = {
  questions: number;
  answeredRate: number;
  abstainRate: number;
  /** Mean share of citations inside expected code, over answers that cited something. */
  citationPrecision: number | null;
  /** Mean judge score divided by the maximum, over graded answers. */
  gradeScore: number | null;
  ungraded: number;
  errors: number;
};

export type Summary = { retrieval: RetrievalSummary; answers?: AnswerSummary };

export function summarize(results: QuestionResult[]): Summary {
  const answerable = results.filter((r) => r.answerable);
  const retrieval = summarizeRetrieval(answerable.map((r) => r.rank));
  const graded = results.filter((r) => r.answer);
  if (graded.length === 0) return { retrieval };

  const rate = (xs: QuestionResult[], pick: (a: AnswerResult) => boolean) =>
    xs.length === 0
      ? 0
      : xs.filter((r) => r.answer && !r.answer.error && pick(r.answer)).length / xs.length;
  const withAnswer = answerable.filter((r) => r.answer && !r.answer.error);
  const grades = withAnswer.flatMap((r) =>
    r.answer!.grade ? [r.answer!.grade.score / MAX_GRADE] : [],
  );
  const precisions = withAnswer.flatMap((r) =>
    r.answer!.citationPrecision === null ? [] : [r.answer!.citationPrecision],
  );
  return {
    retrieval,
    answers: {
      questions: graded.length,
      answeredRate: rate(answerable, (a) => a.answered),
      abstainRate: rate(
        results.filter((r) => !r.answerable),
        (a) => !a.answered,
      ),
      citationPrecision: mean(precisions),
      gradeScore: mean(grades),
      ungraded: withAnswer.length - grades.length,
      errors: graded.filter((r) => r.answer!.error).length,
    },
  };
}

const pct = (x: number | null) => (x === null ? "n/a" : `${(x * 100).toFixed(0)}%`);

export type RunInfo = Record<string, string | number>;

export function toMarkdown(info: RunInfo, results: QuestionResult[], s: Summary): string {
  const lines = [
    "# Eval result",
    "",
    ...Object.entries(info).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Retrieval (answerable questions, no LLM needed)",
    "",
    "| Metric | Value |",
    "| --- | --- |",
    ...Object.entries(s.retrieval.hitAtK).map(([k, v]) => `| hit@${k} | ${pct(v)} |`),
    `| MRR | ${s.retrieval.mrr.toFixed(3)} |`,
    `| questions | ${s.retrieval.questions} |`,
    "",
  ];
  if (s.answers) {
    const a = s.answers;
    lines.push(
      "## Answers",
      "",
      "| Metric | Value |",
      "| --- | --- |",
      `| LLM-graded score | ${pct(a.gradeScore)} |`,
      `| citation precision | ${pct(a.citationPrecision)} |`,
      `| answers given (answerable) | ${pct(a.answeredRate)} |`,
      `| correctly declined (no answer in repo) | ${pct(a.abstainRate)} |`,
      `| ungraded / errors | ${a.ungraded} / ${a.errors} |`,
      "",
    );
  } else lines.push("## Answers", "", "Skipped: no LLM configured.", "");
  lines.push(
    "## Per question",
    "",
    "| id | rank | grade | question |",
    "| --- | --- | --- | --- |",
  );
  for (const r of results) {
    const grade = !r.answer
      ? "-"
      : !r.answerable
        ? r.answer.answered
          ? "answered"
          : "declined"
        : r.answer.grade
          ? `${r.answer.grade.score}/${MAX_GRADE}`
          : "-";
    lines.push(
      `| ${r.id} | ${r.answerable ? (r.rank ?? "miss") : "n/a"} | ${grade} | ${r.question} |`,
    );
  }
  return lines.join("\n") + "\n";
}
