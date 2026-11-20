"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { HighlightedLines, prismLanguage } from "@/components/ui/Code";
import { Alert, X } from "@/components/ui/Icons";

export type Highlight = { startLine: number; endLine: number };

type Props = {
  file: { path: string; content: string } | null;
  highlight: Highlight | null;
  loading?: boolean;
  error?: string | null;
  empty: ReactNode;
  onClose: () => void;
};

export function CodeViewer({ file, highlight, loading, error, empty, onClose }: Props) {
  const firstHighlighted = useRef<HTMLDivElement>(null);

  useEffect(() => {
    firstHighlighted.current?.scrollIntoView?.({ block: "center" });
  }, [file, highlight]);

  if (error)
    return (
      <div className="pane-state">
        <p className="notice notice-error" role="alert">
          <Alert /> {error}
        </p>
      </div>
    );
  if (loading)
    return (
      <div className="pane-state" role="status">
        <span className="spinner" aria-hidden="true" /> Opening file…
      </div>
    );
  if (!file) return <>{empty}</>;

  const lines = file.content.replace(/\n$/, "").split("\n");
  const slash = file.path.lastIndexOf("/");
  return (
    <section aria-label={`Code: ${file.path}`} className="viewer">
      <header className="viewer-head">
        <p className="viewer-path mono" title={file.path}>
          {slash > 0 && <span className="viewer-dir">{file.path.slice(0, slash + 1)}</span>}
          <span className="viewer-name">{file.path.slice(slash + 1)}</span>
        </p>
        {highlight ? (
          <span className="range">
            lines {highlight.startLine}
            {highlight.endLine !== highlight.startLine ? `–${highlight.endLine}` : ""}
          </span>
        ) : (
          <span className="viewer-meta">{lines.length} lines</span>
        )}
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close file">
          <X />
        </button>
      </header>
      <div className="code mono" tabIndex={0} role="region" aria-label="File contents">
        <HighlightedLines code={lines.join("\n")} language={prismLanguage(file.path)}>
          {(rendered) =>
            rendered.map((code, i) => {
              const n = i + 1;
              const on = !!highlight && n >= highlight.startLine && n <= highlight.endLine;
              return (
                <div
                  key={n}
                  className={on ? "line line-on" : "line"}
                  data-line={n}
                  data-highlighted={on}
                  ref={on && n === highlight.startLine ? firstHighlighted : undefined}
                >
                  <span className="ln" aria-hidden="true">
                    {n}
                  </span>
                  {code}
                </div>
              );
            })
          }
        </HighlightedLines>
      </div>
    </section>
  );
}
