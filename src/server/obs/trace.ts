import { randomUUID } from "node:crypto";
import { estimateCost } from "./cost";
import { log } from "./log";
import type { SpanSummary, TraceSummary } from "@/shared/contracts";

export type { SpanSummary, TraceSummary };

export type Usage = { inputTokens: number; outputTokens: number };

export class Trace {
  readonly requestId: string;
  private readonly started = performance.now();
  private readonly startedAt = Date.now();
  private spans: (SpanSummary & { startMs: number })[] = [];
  private chunkIds: number[] = [];
  private tokensIn = 0;
  private tokensOut = 0;
  private estimated = false;

  constructor(
    private readonly model?: string,
    private readonly localModel = false,
    requestId: string = randomUUID(),
  ) {
    this.requestId = requestId;
  }

  async span<T>(
    name: string,
    fn: (set: (a: Record<string, unknown>) => void) => Promise<T>,
  ): Promise<T> {
    const start = performance.now();
    const attrs: Record<string, unknown> = {};
    try {
      return await fn((a) => Object.assign(attrs, a));
    } finally {
      this.spans.push({ name, attrs, startMs: start, ms: Math.round(performance.now() - start) });
    }
  }

  /** Records a span measured by the caller, for steps a callback cannot wrap (a yielding stream). */
  record(name: string, startMs: number, attrs: Record<string, unknown> = {}): void {
    this.spans.push({ name, attrs, startMs, ms: Math.round(performance.now() - startMs) });
  }

  setChunkIds(ids: number[]): void {
    this.chunkIds = ids;
  }

  addUsage(u: Usage, estimated = false): void {
    this.tokensIn += u.inputTokens;
    this.tokensOut += u.outputTokens;
    this.estimated ||= estimated;
  }

  summary(): TraceSummary {
    return {
      requestId: this.requestId,
      model: this.model,
      totalMs: Math.round(performance.now() - this.started),
      spans: this.spans.map(({ name, ms, attrs }) => ({ name, ms, attrs })),
      chunkIds: this.chunkIds,
      tokensIn: this.tokensIn,
      tokensOut: this.tokensOut,
      tokensEstimated: this.estimated,
      costUsd: estimateCost(this.model, this.tokensIn, this.tokensOut, this.localModel),
    };
  }
}

export function finishTrace(trace: Trace): void {
  log("info", "answer trace", { ...trace.summary() });
}
