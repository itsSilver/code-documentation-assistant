/** The constant from the original RRF paper; damps the gap between rank 1 and rank 2. */
export const RRF_K = 60;

/**
 * Reciprocal rank fusion: an id's score is the sum of 1 / (RRF_K + rank) over the lists it
 * appears in, ranks starting at 1. Needs only ranks, so bm25 scores and vector distances
 * (which are not comparable) can be merged. Ties break on the smaller id, so the order is
 * deterministic.
 */
export function reciprocalRankFusion(rankings: number[][]): { id: number; score: number }[] {
  const scores = new Map<number, number>();
  for (const ranking of rankings) {
    ranking.forEach((id, i) => scores.set(id, (scores.get(id) ?? 0) + 1 / (RRF_K + i + 1)));
  }
  return [...scores]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score || a.id - b.id);
}
