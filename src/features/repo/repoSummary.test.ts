import { describe, expect, it } from "vitest";
import { languageBreakdown, topFolders } from "./repoSummary";

const f = (path: string, language: string, lineCount: number) => ({ path, language, lineCount });

describe("languageBreakdown", () => {
  it("orders languages by lines and folds small ones and plain text into a last Other", () => {
    const out = languageBreakdown([
      f("a.js", "javascript", 700),
      f("b.js", "javascript", 100),
      f("README.md", "markdown", 180),
      f("LICENSE", "text", 10),
      f("x.css", "css", 10),
    ]);
    expect(out.map((l) => [l.language, l.files, l.lines])).toEqual([
      ["javascript", 2, 800],
      ["markdown", 1, 180],
      ["text", 2, 20],
    ]);
    expect(out.reduce((s, l) => s + l.share, 0)).toBeCloseTo(1);
  });

  it("is empty for a repo with no lines", () => {
    expect(languageBreakdown([])).toEqual([]);
  });
});

describe("topFolders", () => {
  it("counts files under each top-level folder and ignores root files", () => {
    expect(
      topFolders([
        f("lib/a.js", "javascript", 1),
        f("lib/x/b.js", "javascript", 1),
        f("t/c.js", "javascript", 1),
        f("index.js", "javascript", 1),
      ]),
    ).toEqual([
      { name: "lib", files: 2 },
      { name: "t", files: 1 },
    ]);
  });
});
