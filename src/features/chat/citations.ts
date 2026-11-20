import type { Citation } from "@/shared/contracts";

export type CitationRef = Citation;

export type Segment = { text: string } | { citation: CitationRef };

const TOKEN = /\[([^\]\s:]+):(\d+)(?:-(\d+))?\]/g;

/**
 * Splits answer text into plain text and citation tokens. A `[path:a-b]` token becomes a citation
 * only if the server verified it; unverified ones stay as text so invented references never
 * look clickable.
 */
export function splitCitations(text: string, verified: CitationRef[]): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    const startLine = Number(m[2]);
    const endLine = m[3] ? Number(m[3]) : startLine;
    const hit = verified.find(
      (c) => c.path === m[1] && c.startLine === startLine && c.endLine === endLine,
    );
    if (!hit) continue;
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push({ citation: hit });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}
