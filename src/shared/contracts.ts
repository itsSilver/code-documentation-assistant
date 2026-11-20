/**
 * The shapes that cross the HTTP boundary. Route handlers produce them and the browser consumes
 * them, so each is defined once here. Types only: nothing in this file runs.
 */

export type LineRange = { path: string; startLine: number; endLine: number };

export type Citation = LineRange;

export type RepoSummary = { id: number; name: string; source: string; fileCount: number };

export type RepoStatus =
  | { status: "ready" }
  | { status: "queued" }
  | { status: "indexing"; done: number; total: number }
  | { status: "failed"; error: string }
  /** Not fully embedded and no job running, e.g. the server stopped mid-embed. */
  | { status: "incomplete" };

/** One entry of GET /api/repos. */
export type RepoItem = RepoSummary & RepoStatus;

export type RepoFile = { path: string; language: string; lineCount: number };

export type OpenFile = { path: string; content: string };

export type LlmStatus =
  { ready: true; model: string; local: boolean } | { ready: false; help: string };

export type SpanSummary = { name: string; ms: number; attrs: Record<string, unknown> };

/** What the app shows per answer and logs. Holds ids and numbers, never text. */
export type TraceSummary = {
  requestId: string;
  model?: string;
  totalMs: number;
  spans: SpanSummary[];
  chunkIds: number[];
  tokensIn: number;
  tokensOut: number;
  /** True when the provider reported no usage and the counts are a chars/4 estimate. */
  tokensEstimated: boolean;
  /** Null when the model has no known price. */
  costUsd: number | null;
};

export type ChatStreamEvent =
  | { type: "sources"; chunks: LineRange[] }
  | { type: "delta"; text: string }
  /** `answered` is false when the repo did not hold the answer; `citations` are checked. */
  | { type: "done"; citations: Citation[]; answered: boolean; trace: TraceSummary }
  | { type: "error"; message: string };

export type IngestStreamEvent =
  | { stage: "reading" | "storing" | "indexing"; message: string }
  | { stage: "done"; message: string; repoId: number }
  | { stage: "error"; message: string };
