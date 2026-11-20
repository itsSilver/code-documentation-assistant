import type { Citation } from "@/shared/contracts";

export type { Citation };

type Range = Citation;

const CITATION = /\[([^\]\s:]+):(\d+)(?:-(\d+))?\]/g;

/**
 * Finds `[path:start-end]` (or `[path:line]`) in an answer. Only citations that overlap a chunk
 * we actually showed the model are kept; anything else is an invented reference and is dropped.
 */
export function parseCitations(answer: string, shown: Range[]): Citation[] {
  const found = new Map<string, Citation>();
  for (const m of answer.matchAll(CITATION)) {
    const startLine = Number(m[2]);
    const endLine = m[3] ? Number(m[3]) : startLine;
    if (endLine < startLine) continue;
    const real = shown.some(
      (c) => c.path === m[1] && startLine <= c.endLine && endLine >= c.startLine,
    );
    if (real) found.set(`${m[1]}:${startLine}-${endLine}`, { path: m[1], startLine, endLine });
  }
  return [...found.values()];
}
