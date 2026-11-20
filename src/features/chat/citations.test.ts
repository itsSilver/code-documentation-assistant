import { describe, expect, it } from "vitest";
import { splitCitations } from "./citations";

const ref = { path: "src/a.ts", startLine: 3, endLine: 9 };

describe("splitCitations", () => {
  it("turns verified tokens into citations between text", () => {
    expect(splitCitations("It runs here [src/a.ts:3-9] first.", [ref])).toEqual([
      { text: "It runs here " },
      { citation: ref },
      { text: " first." },
    ]);
  });

  it("leaves unverified tokens as text", () => {
    expect(splitCitations("See [src/b.ts:1-2].", [ref])).toEqual([{ text: "See [src/b.ts:1-2]." }]);
  });
});
