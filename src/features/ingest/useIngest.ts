"use client";

import { useCallback, useState } from "react";
import { parseIngestProgress, type IngestProgress } from "./ingestProgress";
import type { IngestStreamEvent } from "@/shared/contracts";
import { readNdjson } from "@/shared/ndjson";

export type IngestState =
  | { status: "idle" }
  | { status: "running"; label: string; progress: IngestProgress }
  | { status: "error"; label: string; message: string };

export type IngestSource = { url: string } | { file: File };

/**
 * Runs one indexing job against /api/ingest and tracks its progress. It lives above the dialog,
 * so closing the dialog does not stop the job; the header keeps showing it.
 */
export function useIngest(onIndexed: (repoId: number) => void) {
  const [state, setState] = useState<IngestState>({ status: "idle" });

  const start = useCallback(
    async (source: IngestSource) => {
      const label = "url" in source ? source.url.replace(/^https?:\/\//, "") : source.file.name;
      const init: RequestInit =
        "url" in source
          ? {
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ url: source.url }),
            }
          : {
              body: (() => {
                const body = new FormData();
                body.set("file", source.file);
                return body;
              })(),
            };
      setState({
        status: "running",
        label,
        progress: { step: "download", message: "Starting…" },
      });
      try {
        const res = await fetch("/api/ingest", { method: "POST", ...init });
        let repoId: number | undefined;
        for await (const e of readNdjson<IngestStreamEvent>(res)) {
          if (e.stage === "error") throw new Error(e.message);
          else if (e.stage === "done") repoId = e.repoId;
          else setState({ status: "running", label, progress: parseIngestProgress(e) });
        }
        if (repoId === undefined) throw new Error("Indexing stopped before it finished");
        setState({ status: "idle" });
        onIndexed(repoId);
      } catch (e) {
        setState({
          status: "error",
          label,
          message: e instanceof Error ? e.message : "Indexing failed",
        });
      }
    },
    [onIndexed],
  );

  const reset = useCallback(() => setState({ status: "idle" }), []);
  return { state, start, reset };
}
