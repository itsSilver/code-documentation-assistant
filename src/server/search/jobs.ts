export type Job = {
  state: "queued" | "indexing" | "failed";
  /** Chunks embedded so far and in total; total is 0 until the files are chunked. */
  done: number;
  total: number;
  error?: string;
};

export type RunIndex = (
  repoId: number,
  onProgress: (done: number, total: number) => void,
) => Promise<unknown>;

/**
 * Embedding jobs, one at a time: there is one embedder, and two jobs writing at once would
 * compete for it. A finished job is dropped (the database then says the repo is indexed); a
 * failed one stays so the UI can show why.
 */
export class IndexQueue {
  private readonly jobs = new Map<number, Job>();
  private tail: Promise<void> = Promise.resolve();

  constructor(private readonly run: RunIndex) {}

  get(repoId: number): Job | undefined {
    const job = this.jobs.get(repoId);
    return job && { ...job };
  }

  isActive(repoId: number): boolean {
    const state = this.jobs.get(repoId)?.state;
    return state === "queued" || state === "indexing";
  }

  /** Queues a repo for embedding. Resolves when its job finishes; rejects if it fails. */
  enqueue(repoId: number): Promise<void> {
    if (this.isActive(repoId)) return Promise.reject(new Error("Already embedding"));
    const job: Job = { state: "queued", done: 0, total: 0 };
    this.jobs.set(repoId, job);
    const result = this.tail.then(async () => {
      job.state = "indexing";
      try {
        await this.run(repoId, (done, total) => Object.assign(job, { done, total }));
        if (this.jobs.get(repoId) === job) this.jobs.delete(repoId);
      } catch (e) {
        job.state = "failed";
        job.error = e instanceof Error && e.message ? e.message : "Embedding failed";
        throw e;
      }
    });
    this.tail = result.catch(() => {});
    return result;
  }

  /** Drops a finished or failed job, e.g. when its repo is removed. */
  forget(repoId: number): void {
    if (!this.isActive(repoId)) this.jobs.delete(repoId);
  }

  /** Resolves once every queued job has finished. */
  idle(): Promise<void> {
    return this.tail;
  }
}
