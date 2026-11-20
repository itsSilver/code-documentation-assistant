import { describe, expect, it } from "vitest";
import { embedFraction, isBusy, isStopped, statusLabel } from "./repoStatus";

describe("repo status helpers", () => {
  it("labels each status, with the embedded share while indexing", () => {
    expect(statusLabel({ status: "ready" })).toBe("Indexed");
    expect(statusLabel({ status: "queued" })).toBe("Queued");
    expect(statusLabel({ status: "indexing", done: 0, total: 0 })).toBe("Preparing");
    expect(statusLabel({ status: "indexing", done: 290, total: 869 })).toBe("Embedding 33%");
    expect(statusLabel({ status: "failed", error: "x" })).toBe("Embedding stopped");
    expect(statusLabel({ status: "incomplete" })).toBe("Embedding stopped");
  });

  it("polls only while queued or indexing, and offers re-index only when stopped", () => {
    expect(isBusy({ status: "queued" })).toBe(true);
    expect(isBusy({ status: "ready" })).toBe(false);
    expect(isStopped({ status: "incomplete" })).toBe(true);
    expect(isStopped({ status: "indexing", done: 1, total: 2 })).toBe(false);
    expect(embedFraction({ status: "indexing", done: 900, total: 869 })).toBe(1);
  });
});
