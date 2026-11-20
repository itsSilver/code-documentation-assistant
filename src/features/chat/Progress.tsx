"use client";

import { useEffect, useState } from "react";
import type { Citation } from "@/shared/contracts";
import type { Turn } from "./useChat";

/** Wall-clock time; a function so the state initialiser and the timer can both read it. */
const clock = () => Date.now();

function useElapsed(since: number): number {
  const [now, setNow] = useState(clock);
  useEffect(() => {
    const t = setInterval(() => setNow(clock()), 1000);
    return () => clearInterval(t);
  }, []);
  return Math.max(0, Math.floor((now - since) / 1000));
}

type Props = {
  turn: Turn;
  local: boolean;
  onOpen: (c: Citation) => void;
};

export function Progress({ turn, local, onOpen }: Props) {
  const elapsed = useElapsed(turn.startedAt);
  const writing = turn.answer.length > 0;
  const sources = turn.sources;
  const snippets = sources?.reduce((n, s) => n + s.snippets, 0) ?? 0;
  const label = !sources
    ? "Searching the code"
    : writing
      ? "Writing the answer"
      : "Reading the code and drafting an answer";
  return (
    <div className="progress" role="status">
      <p className="progress-line">
        <span className="spinner" aria-hidden="true" />
        <span>{label}</span>
        <span className="progress-time">{elapsed}s</span>
      </p>
      {sources && !writing && sources.length > 0 && (
        <>
          <p className="progress-sub">
            Retrieved {snippets} snippets from {sources.length}{" "}
            {sources.length === 1 ? "file" : "files"}
          </p>
          <ul className="source-list">
            {sources.map((s) => (
              <li key={s.path}>
                <button
                  type="button"
                  className="source"
                  onClick={() => onOpen(s)}
                  title={`Open ${s.path} at lines ${s.startLine}-${s.endLine}`}
                >
                  <span className="mono">{s.path}</span>
                  {s.snippets > 1 && <span className="source-count">×{s.snippets}</span>}
                </button>
              </li>
            ))}
          </ul>
          {local && elapsed >= 10 && (
            <p className="progress-sub">A local model can take a minute or two to start writing.</p>
          )}
        </>
      )}
    </div>
  );
}
