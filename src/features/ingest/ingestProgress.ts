export type IngestStep = "download" | "store";
export type IngestProgress = { step: IngestStep; message: string };

/** What the import dialog waits for. Embedding runs afterwards, in the background. */
export const INGEST_STEPS: { id: IngestStep; label: string }[] = [
  { id: "download", label: "Fetch files" },
  { id: "store", label: "Filter and store" },
];

/** Maps one server progress line to a step of the import checklist. */
export function parseIngestProgress(e: { stage: string; message: string }): IngestProgress {
  return { step: e.stage === "storing" ? "store" : "download", message: e.message };
}
