import { describe, expect, it } from "vitest";
import { groupSources } from "./sources";

describe("groupSources", () => {
  it("groups chunks by file in retrieval order, keeping each file's best range", () => {
    expect(
      groupSources([
        { path: "b.js", startLine: 10, endLine: 20 },
        { path: "a.js", startLine: 1, endLine: 5 },
        { path: "b.js", startLine: 40, endLine: 50 },
      ]),
    ).toEqual([
      { path: "b.js", snippets: 2, startLine: 10, endLine: 20 },
      { path: "a.js", snippets: 1, startLine: 1, endLine: 5 },
    ]);
  });
});
