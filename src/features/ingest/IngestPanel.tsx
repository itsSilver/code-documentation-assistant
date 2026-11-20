"use client";

import { useId, useRef, useState } from "react";
import { INGEST_STEPS } from "./ingestProgress";
import { Alert, Archive, Check, Link, Upload, X } from "@/components/ui/Icons";
import type { IngestSource, IngestState } from "./useIngest";

const MAX_ZIP_MB = 50;

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1048576).toFixed(1)} MB`;

type Props = {
  state: IngestState;
  onStart: (source: IngestSource) => void;
  onReset: () => void;
};

export function IngestPanel({ state, onStart, onReset }: Props) {
  if (state.status === "running") return <IngestProgressView state={state} />;
  if (state.status === "error")
    return (
      <div className="ingest-result">
        <div className="notice notice-error" role="alert">
          <Alert />
          <div>
            <p className="notice-title">Could not index {state.label}</p>
            <p>{state.message}</p>
          </div>
        </div>
        <button type="button" className="btn" onClick={onReset}>
          Try again
        </button>
      </div>
    );
  return <IngestForm onStart={onStart} />;
}

function IngestForm({ onStart }: { onStart: (source: IngestSource) => void }) {
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const hintId = useId();

  function pick(f: File | undefined) {
    if (!f) return;
    if (!/\.zip$/i.test(f.name)) return setFileError("Choose a .zip file.");
    if (f.size > MAX_ZIP_MB * 1024 * 1024)
      return setFileError(`That zip is larger than ${MAX_ZIP_MB} MB.`);
    setFileError(null);
    setFile(f);
  }

  return (
    <div className="ingest">
      <form
        className="field"
        onSubmit={(e) => {
          e.preventDefault();
          if (url.trim()) onStart({ url: url.trim() });
        }}
      >
        <label htmlFor="repo-url">GitHub URL</label>
        <div className="input-row">
          <div className="input-wrap">
            <Link className="input-icon" />
            <input
              id="repo-url"
              className="input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={!url.trim()}>
            Index
          </button>
        </div>
        <p className="field-hint">Public repositories. A branch or tag URL works too.</p>
      </form>

      <div className="or" aria-hidden="true">
        <span>or</span>
      </div>

      {file ? (
        <div className="file-picked">
          <Archive className="muted" />
          <div className="file-picked-main">
            <p className="mono">{file.name}</p>
            <p className="muted">{formatSize(file.size)}</p>
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label="Remove file"
            onClick={() => setFile(null)}
          >
            <X />
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onStart({ file })}>
            Index zip
          </button>
        </div>
      ) : (
        <div
          className="drop"
          data-dragging={dragging || undefined}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pick(e.dataTransfer.files[0]);
          }}
        >
          <Upload size={20} className="muted" />
          <p>
            Drop a .zip here or{" "}
            <button type="button" className="link-btn" onClick={() => input.current?.click()}>
              choose a file
            </button>
          </p>
          <p className="field-hint" id={hintId}>
            Up to {MAX_ZIP_MB} MB. Dependencies, build output and binaries are skipped.
          </p>
          <input
            ref={input}
            type="file"
            accept=".zip,application/zip"
            className="sr-only"
            aria-label="Upload a zip"
            aria-describedby={hintId}
            tabIndex={-1}
            onChange={(e) => {
              pick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      )}
      {fileError && (
        <p className="field-error" role="alert">
          {fileError}
        </p>
      )}
    </div>
  );
}

function IngestProgressView({ state }: { state: Extract<IngestState, { status: "running" }> }) {
  const current = INGEST_STEPS.findIndex((s) => s.id === state.progress.step);
  return (
    <div className="ingest-progress" role="status" aria-live="polite">
      <p className="ingest-label mono">{state.label}</p>
      <ol className="steps">
        {INGEST_STEPS.map((s, i) => {
          const status = i < current ? "done" : i === current ? "active" : "todo";
          return (
            <li key={s.id} className="step" data-status={status}>
              <span className="step-mark" aria-hidden="true">
                {status === "done" ? (
                  <Check size={12} />
                ) : status === "active" ? (
                  <span className="spinner" />
                ) : null}
              </span>
              <span className="step-body">
                <span className="step-title">{s.label}</span>
                {status === "active" && (
                  <span className="step-detail">{state.progress.message}</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="field-hint">
        Embedding runs on this machine after the files are stored. The repository opens as soon as
        they are, so you can browse while it embeds.
      </p>
    </div>
  );
}
