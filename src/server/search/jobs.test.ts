import { describe, expect, it } from "vitest";
import { IndexQueue } from "./jobs";
import { repoStatus } from "./status";

/** A run whose jobs finish only when the test says so. */
function controlled() {
  const pending = new Map<number, { resolve: () => void; reject: (e: Error) => void }>();
  const order: number[] = [];
  let progress: (done: number, total: number) => void = () => {};
  const queue = new IndexQueue(
    (id, onProgress) =>
      new Promise<void>((resolve, reject) => {
        order.push(id);
        progress = onProgress;
        pending.set(id, { resolve, reject });
      }),
  );
  const tick = () => new Promise((r) => setTimeout(r, 0));
  return { queue, pending, order, report: (d: number, t: number) => progress(d, t), tick };
}

describe("IndexQueue", () => {
  it("runs one job at a time, in order, and reports progress", async () => {
    const { queue, pending, order, report, tick } = controlled();
    const first = queue.enqueue(1);
    const second = queue.enqueue(2);
    await tick();
    expect(order).toEqual([1]);
    expect(queue.get(2)?.state).toBe("queued");
    report(64, 200);
    expect(queue.get(1)).toMatchObject({ state: "indexing", done: 64, total: 200 });

    pending.get(1)!.resolve();
    await first;
    await tick();
    expect(queue.get(1)).toBeUndefined();
    expect(order).toEqual([1, 2]);
    pending.get(2)!.resolve();
    await second;
  });

  it("keeps a failed job with its error and still runs the next one", async () => {
    const { queue, pending, order, tick } = controlled();
    const first = queue.enqueue(1).catch(() => {});
    void queue.enqueue(2);
    await tick();
    pending.get(1)!.reject(new Error("embedder crashed"));
    await first;
    await tick();
    expect(queue.get(1)).toMatchObject({ state: "failed", error: "embedder crashed" });
    expect(order).toEqual([1, 2]);
  });

  it("refuses a second job for a repo that is already queued", async () => {
    const { queue } = controlled();
    void queue.enqueue(1);
    await expect(queue.enqueue(1)).rejects.toThrow("Already embedding");
  });
});

describe("repoStatus", () => {
  const job = (state: "queued" | "indexing" | "failed") => ({
    state,
    done: 0,
    total: 869,
    error: "boom",
  });

  it("maps database state and the live job to one status", () => {
    expect(repoStatus(true, 869, undefined)).toEqual({ status: "ready" });
    expect(repoStatus(false, 0, job("queued"))).toEqual({ status: "queued" });
    expect(repoStatus(false, 290, job("indexing"))).toEqual({
      status: "indexing",
      done: 290,
      total: 869,
    });
    expect(repoStatus(false, 290, job("failed"))).toEqual({ status: "failed", error: "boom" });
    expect(repoStatus(false, 290, undefined)).toEqual({ status: "incomplete" });
  });

  it("is not ready while a re-index of an indexed repo runs", () => {
    expect(repoStatus(true, 10, job("indexing")).status).toBe("indexing");
  });
});
