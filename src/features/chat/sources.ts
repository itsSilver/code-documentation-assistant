import type { LineRange } from "@/shared/contracts";

export type SourceChunk = LineRange;
export type SourceFile = { path: string; snippets: number; startLine: number; endLine: number };

/**
 * Groups retrieved chunks by file, keeping retrieval order (best match first). Each file keeps
 * the range of its best chunk, so opening it shows the most relevant lines.
 */
export function groupSources(chunks: SourceChunk[]): SourceFile[] {
  const by = new Map<string, SourceFile>();
  for (const c of chunks) {
    const seen = by.get(c.path);
    if (seen) seen.snippets += 1;
    else by.set(c.path, { path: c.path, snippets: 1, startLine: c.startLine, endLine: c.endLine });
  }
  return [...by.values()];
}
