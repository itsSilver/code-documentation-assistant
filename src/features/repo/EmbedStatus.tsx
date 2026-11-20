"use client";

import { embedFraction, type RepoItem } from "./repoStatus";
import { Alert, Retry, Ring } from "@/components/ui/Icons";

type Props = { repo: RepoItem; onReindex: () => void; onRemove: () => void };

/**
 * The note above the composer while a repo is not fully embedded: progress while it runs, or
 * Re-index and Remove once it stopped. Renders nothing for a ready repo.
 */
export function EmbedStatus({ repo, onReindex, onRemove }: Props) {
  if (repo.status === "ready") return null;
  if (repo.status === "queued" || repo.status === "indexing") {
    const f = embedFraction(repo);
    return (
      <p className="embed-note" role="status">
        <Ring fraction={f} />
        <span>
          {repo.status === "queued"
            ? "Queued for embedding, after the repository ahead of it. "
            : f === null
              ? "Preparing to embed. "
              : `Still embedding (${Math.floor(f * 100)}%). `}
          {repo.status === "indexing" && repo.done > 0
            ? `Answers use the ${repo.done.toLocaleString("en")} of ${repo.total.toLocaleString("en")} chunks indexed so far.`
            : "Answers can cite this repository once its first chunks are indexed."}
        </span>
      </p>
    );
  }
  return (
    <div className="embed-note embed-note-warn" role="alert">
      <Alert size={15} />
      <span>
        <strong>Embedding stopped.</strong>{" "}
        {repo.status === "failed"
          ? repo.error
          : "It did not finish, likely because the server restarted."}{" "}
        Answers use only what was indexed.
      </span>
      <span className="embed-actions">
        <button type="button" className="btn btn-sm" onClick={onReindex}>
          <Retry size={13} /> Re-index
        </button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={onRemove}>
          Remove
        </button>
      </span>
    </div>
  );
}
