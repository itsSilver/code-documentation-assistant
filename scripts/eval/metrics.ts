export type Span = { path: string; startLine: number; endLine: number };

export const overlaps = (a: Span, b: Span) =>
  a.path === b.path && a.startLine <= b.endLine && a.endLine >= b.startLine;

/** 1-based rank of the first retrieved span that overlaps an expected span; null if none does. */
export function firstHitRank(retrieved: Span[], expect: Span[]): number | null {
  const i = retrieved.findIndex((r) => expect.some((e) => overlaps(r, e)));
  return i === -1 ? null : i + 1;
}

export type RetrievalSummary = { hitAtK: Record<number, number>; mrr: number; questions: number };

/** Hit@k is the share of questions with a hit in the top k; MRR is the mean of 1/rank (0 for a miss). */
export function summarizeRetrieval(
  ranks: (number | null)[],
  ks: number[] = [1, 3, 5, 10],
): RetrievalSummary {
  const n = ranks.length;
  const mean = (xs: number[]) => (n === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / n);
  return {
    questions: n,
    hitAtK: Object.fromEntries(
      ks.map((k) => [k, mean(ranks.map((r) => (r !== null && r <= k ? 1 : 0)))]),
    ),
    mrr: mean(ranks.map((r) => (r === null ? 0 : 1 / r))),
  };
}

/**
 * Share of an answer's citations that point into expected code. Null when it cited nothing, so
 * "cited nothing" is not scored as "cited wrongly".
 */
export function citationPrecision(cited: Span[], expect: Span[]): number | null {
  if (cited.length === 0) return null;
  return cited.filter((c) => expect.some((e) => overlaps(c, e))).length / cited.length;
}

export const mean = (xs: number[]): number | null =>
  xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length;
