import type { RepoStatus } from "@/shared/contracts";
import type { Job } from "./jobs";

export type { RepoStatus };

/**
 * A repo's embedding status from the database (indexed flag, chunks stored) and the in-process
 * job, if any. A live job wins: a repo being re-indexed is not ready yet.
 */
export function repoStatus(indexed: boolean, chunks: number, job: Job | undefined): RepoStatus {
  if (job?.state === "queued") return { status: "queued" };
  if (job?.state === "indexing") return { status: "indexing", done: chunks, total: job.total };
  if (indexed) return { status: "ready" };
  if (job?.state === "failed") return { status: "failed", error: job.error ?? "Embedding failed" };
  return { status: "incomplete" };
}
