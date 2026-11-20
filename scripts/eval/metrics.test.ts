import { describe, expect, it } from "vitest";
import { citationPrecision, firstHitRank, overlaps, summarizeRetrieval } from "./metrics";

const span = (path: string, startLine: number, endLine: number) => ({ path, startLine, endLine });

describe("overlaps", () => {
  it("needs the same file and overlapping lines, edges included", () => {
    expect(overlaps(span("a.js", 1, 10), span("a.js", 10, 20))).toBe(true);
    expect(overlaps(span("a.js", 1, 9), span("a.js", 10, 20))).toBe(false);
    expect(overlaps(span("a.js", 1, 10), span("b.js", 1, 10))).toBe(false);
  });
});

describe("firstHitRank", () => {
  const want = [span("a.js", 10, 20)];
  it("is the 1-based rank of the first overlapping chunk", () => {
    const got = [span("b.js", 1, 5), span("a.js", 18, 30), span("a.js", 10, 12)];
    expect(firstHitRank(got, want)).toBe(2);
  });
  it("is null on a miss", () => {
    expect(firstHitRank([span("a.js", 21, 30)], want)).toBeNull();
  });
});

describe("summarizeRetrieval", () => {
  it("computes hit@k and MRR, counting misses as zero", () => {
    const s = summarizeRetrieval([1, 3, null, 2], [1, 3]);
    expect(s.hitAtK).toEqual({ 1: 0.25, 3: 0.75 });
    expect(s.mrr).toBeCloseTo((1 + 1 / 3 + 0 + 1 / 2) / 4);
    expect(s.questions).toBe(4);
  });
  it("is all zeros for no questions", () => {
    expect(summarizeRetrieval([]).mrr).toBe(0);
  });
});

describe("citationPrecision", () => {
  const want = [span("a.js", 10, 20)];
  it("is the share of citations inside expected code", () => {
    expect(citationPrecision([span("a.js", 12, 14), span("b.js", 1, 2)], want)).toBe(0.5);
  });
  it("is null when nothing was cited", () => {
    expect(citationPrecision([], want)).toBeNull();
  });
});
