import type { Chunk, Repository } from "../db/repository";
import type { Embedder } from "../embed/embedder";
import { reciprocalRankFusion } from "./fusion";

export type SearchHit = { chunk: Chunk; score: number };

export type SearchDeps = { repository: Repository; embedder: Embedder };

/** Added to the fused score; a top rank in both lists is worth about 0.033. */
export const SYMBOL_BOOST = 0.02;
export const PATH_BOOST = 0.01;

const IDENTIFIER = /[A-Za-z_][A-Za-z0-9_]*/g;

function queryTokens(query: string): string[] {
  return query.match(IDENTIFIER) ?? [];
}

/**
 * An FTS5 MATCH expression: each token quoted (so punctuation and operators like NOT are plain
 * text) and OR-ed, leaving bm25 to weigh rare words such as identifiers above common ones.
 */
export function toFtsQuery(query: string): string {
  return [...new Set(queryTokens(query))].map((t) => `"${t}"`).join(" OR ");
}

function matchesSymbol(chunk: Chunk, tokens: Set<string>): boolean {
  if (!chunk.symbol) return false;
  return (
    tokens.has(chunk.symbol.toLowerCase()) ||
    tokens.has(chunk.symbol.split(".").pop()!.toLowerCase())
  );
}

function matchesPath(chunk: Chunk, query: string, tokens: Set<string>): boolean {
  const base = chunk.path.split("/").pop()!;
  const stem = base.replace(/\.[^.]*$/, "").toLowerCase();
  return (
    query.toLowerCase().includes(chunk.path.toLowerCase()) || (stem.length > 2 && tokens.has(stem))
  );
}

/**
 * Hybrid search: FTS5 keywords and vector similarity run separately, are merged with reciprocal
 * rank fusion, then chunks whose symbol or path the query names get a fixed boost.
 */
export async function search(
  { repository, embedder }: SearchDeps,
  repoId: number,
  query: string,
  k: number,
): Promise<SearchHit[]> {
  const candidates = Math.max(k * 3, 30);
  const fts = toFtsQuery(query);
  const keyword = fts ? repository.searchKeyword(repoId, fts, candidates) : [];
  const vector = repository.searchVector(repoId, await embedder.embedQuery(query), candidates);

  const byId = new Map<number, Chunk>();
  for (const c of [...keyword, ...vector]) byId.set(c.id, c);

  const tokens = new Set(queryTokens(query).map((t) => t.toLowerCase()));
  return reciprocalRankFusion([keyword.map((c) => c.id), vector.map((c) => c.id)])
    .map(({ id, score }) => {
      const chunk = byId.get(id)!;
      const boost =
        (matchesSymbol(chunk, tokens) ? SYMBOL_BOOST : 0) +
        (matchesPath(chunk, query, tokens) ? PATH_BOOST : 0);
      return { chunk, score: score + boost };
    })
    .sort((a, b) => b.score - a.score || a.chunk.id - b.chunk.id)
    .slice(0, k);
}
