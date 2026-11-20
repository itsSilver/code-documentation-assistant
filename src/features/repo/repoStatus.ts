import type { RepoItem, RepoStatus } from "@/shared/contracts";

export type RepoState = RepoStatus;
export type { RepoItem };

/** True while the server is still working on the repo, so the client keeps polling. */
export const isBusy = (r: RepoState) => r.status === "queued" || r.status === "indexing";

/** True when embedding stopped and the user should re-index or remove the repo. */
export const isStopped = (r: RepoState) => r.status === "failed" || r.status === "incomplete";

/** Share of chunks embedded, 0 to 1; null when unknown (queued, or not chunked yet). */
export function embedFraction(r: RepoState): number | null {
  if (r.status !== "indexing" || r.total === 0) return null;
  return Math.min(1, r.done / r.total);
}

/** The short label for the header and the repo menu. */
export function statusLabel(r: RepoState): string {
  switch (r.status) {
    case "ready":
      return "Indexed";
    case "queued":
      return "Queued";
    case "indexing": {
      const f = embedFraction(r);
      return f === null ? "Preparing" : `Embedding ${Math.floor(f * 100)}%`;
    }
    default:
      return "Embedding stopped";
  }
}
