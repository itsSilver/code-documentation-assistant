import type { TraceSummary } from "@/shared/contracts";

export function formatCost(usd: number | null): string {
  if (usd === null) return "cost unknown";
  if (usd === 0) return "$0 (free or local)";
  return `$${usd < 0.01 ? usd.toFixed(5) : usd.toFixed(3)}`;
}

const seconds = (ms: number) =>
  ms < 10_000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms / 1000)} s`;
const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

export function TracePanel({ trace }: { trace: TraceSummary }) {
  return (
    <details className="trace">
      <summary>
        <span>{seconds(trace.totalMs)}</span>
        <span>{compact(trace.tokensIn + trace.tokensOut)} tokens</span>
        <span>{formatCost(trace.costUsd)}</span>
        <span className="trace-toggle">Trace</span>
      </summary>
      <dl className="mono">
        <dt>request</dt>
        <dd>{trace.requestId}</dd>
        {trace.model && (
          <>
            <dt>model</dt>
            <dd>{trace.model}</dd>
          </>
        )}
        {trace.spans.map((s) => (
          <div key={s.name}>
            <dt>{s.name}</dt>
            <dd>{s.ms} ms</dd>
          </div>
        ))}
        <dt>tokens</dt>
        <dd>
          {trace.tokensIn} in / {trace.tokensOut} out{trace.tokensEstimated ? " (estimated)" : ""}
        </dd>
        <dt>chunks</dt>
        <dd>{trace.chunkIds.join(", ") || "none"}</dd>
      </dl>
    </details>
  );
}
