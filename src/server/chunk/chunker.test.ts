import { describe, expect, it } from "vitest";
import { chunkFile } from "./chunker";
import { lineWindows } from "./windows";

const summary = (chunks: Awaited<ReturnType<typeof chunkFile>>) =>
  chunks.map((c) => [c.symbol, c.kind, c.startLine, c.endLine]);

describe("chunkFile with a grammar", () => {
  it("splits TypeScript by function, class and method, keeping doc comments and export", async () => {
    const src = [
      'import { x } from "./x";', // 1
      "", // 2
      "/** Adds. */", // 3
      "export function add(a: number, b: number) {", // 4
      "  return a + b;", // 5
      "}", // 6
      "", // 7
      "export const double = (n: number) => {", // 8
      "  return n * 2;", // 9
      "};", // 10
      "", // 11
      "class Cart {", // 12
      "  total() {", // 13
      "    return 1;", // 14
      "  }", // 15
      "}", // 16
      "", // 17
      "interface Item {", // 18
      "  id: string;", // 19
      "}", // 20
    ].join("\n");
    const chunks = await chunkFile("src/cart.ts", src);
    expect(summary(chunks)).toEqual([
      [null, "module", 1, 1],
      ["add", "function", 3, 6],
      ["double", "function", 8, 10],
      ["Cart", "class", 12, 16],
      ["Item", "interface", 18, 20],
    ]);
    expect(chunks[1].text).toBe(src.split("\n").slice(2, 6).join("\n"));
  });

  it("handles TSX and JavaScript", async () => {
    const tsx = "export function App() {\n  return <div />;\n}\n";
    expect(summary(await chunkFile("a.tsx", tsx))).toEqual([["App", "function", 1, 3]]);
    const js = "function a() {}\nclass B {}\n";
    expect(summary(await chunkFile("a.js", js))).toEqual([
      ["a", "function", 1, 1],
      ["B", "class", 2, 2],
    ]);
  });

  it("splits Python with decorators and marks class functions as methods", async () => {
    const src = [
      "import os", // 1
      "", // 2
      "@cache", // 3
      "def load(path):", // 4
      "    return os.path", // 5
      "", // 6
      "class Repo:", // 7
      "    def get(self):", // 8
      "        return 1", // 9
    ].join("\n");
    expect(summary(await chunkFile("repo.py", src))).toEqual([
      [null, "module", 1, 1],
      ["load", "function", 3, 5],
      ["Repo", "class", 7, 9],
    ]);
  });

  it("splits Go functions, methods with their receiver, and types", async () => {
    const src = [
      "package main", // 1
      "", // 2
      "type Server struct {", // 3
      "\tport int", // 4
      "}", // 5
      "", // 6
      "func (s *Server) Start() error {", // 7
      "\treturn nil", // 8
      "}", // 9
      "", // 10
      "func main() {", // 11
      "}", // 12
    ].join("\n");
    expect(summary(await chunkFile("main.go", src))).toEqual([
      [null, "module", 1, 1],
      ["Server", "type", 3, 5],
      ["Server.Start", "method", 7, 9],
      ["main", "function", 11, 12],
    ]);
  });

  it("splits Java classes, constructors and methods", async () => {
    const src = [
      "package a;", // 1
      "", // 2
      "public class Greeter {", // 3
      "  private String name;", // 4
      "  Greeter(String n) {", // 5
      "    name = n;", // 6
      "  }", // 7
      "  String greet() {", // 8
      "    return name;", // 9
      "  }", // 10
      "}", // 11
    ].join("\n");
    expect(summary(await chunkFile("Greeter.java", src))).toEqual([
      [null, "module", 1, 1],
      ["Greeter", "class", 3, 11],
    ]);
    // Force the split: the class now breaks into its inner boundaries.
    const split = await chunkFile("Greeter.java", src, { maxChars: 80 });
    expect(summary(split)).toEqual([
      [null, "module", 1, 1],
      ["Greeter", "block", 3, 4],
      ["Greeter.Greeter", "method", 5, 7],
      ["Greeter.greet", "method", 8, 11],
    ]);
  });

  it("splits an oversized class into methods named Class.method", async () => {
    const method = (n: string) => `  ${n}() {\n    return "${"x".repeat(60)}";\n  }`;
    const src = ["class Big {", method("a"), method("b"), "}"].join("\n");
    const chunks = await chunkFile("big.ts", src, { maxChars: 120 });
    expect(summary(chunks)).toEqual([
      ["Big", "block", 1, 1],
      ["Big.a", "method", 2, 4],
      ["Big.b", "method", 5, 8],
    ]);
    expect(chunks[2].text.endsWith("}\n}")).toBe(true);
  });

  it("splits an oversized function on statement boundaries, then on line windows", async () => {
    const body = Array.from({ length: 10 }, (_, i) => `  step${i}();`).join("\n");
    const src = `function run() {\n${body}\n}`;
    const chunks = await chunkFile("run.ts", src, { maxChars: 60 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.symbol === "run")).toBe(true);
    expect(chunks[0].startLine).toBe(1);
    expect(chunks.at(-1)!.endLine).toBe(12);
    for (const [i, c] of chunks.slice(1).entries()) expect(c.startLine).toBe(chunks[i].endLine + 1);
  });

  it("prefixes content with path, symbol and lines, but keeps text raw", async () => {
    const [c] = await chunkFile("src/a.ts", "export function f() {}\n");
    expect(c.content).toBe(
      "File: src/a.ts\nSymbol: f (function)\nLines: 1-1\n\nexport function f() {}",
    );
    expect(c.text).toBe("export function f() {}");
  });

  it("still returns chunks for a file with syntax errors", async () => {
    const chunks = await chunkFile("bad.ts", "function ok() {}\nfunction broken( {\n");
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].symbol).toBe("ok");
  });
});

describe("fallback chunker", () => {
  it("keeps a small file without a grammar as one chunk", async () => {
    const chunks = await chunkFile("README.md", "# Title\n\ntext\n");
    expect(summary(chunks)).toEqual([[null, "module", 1, 3]]);
  });

  it("windows a long file with overlap and full coverage", async () => {
    const lines = Array.from({ length: 40 }, (_, i) => `line ${i + 1}`);
    const chunks = await chunkFile("notes.txt", lines.join("\n"), {
      maxChars: 80,
      overlapLines: 2,
    });
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks[0].startLine).toBe(1);
    expect(chunks.at(-1)!.endLine).toBe(40);
    for (const [i, c] of chunks.slice(1).entries()) {
      expect(c.startLine).toBe(chunks[i].endLine - 1); // 2 lines of overlap
      expect(c.symbol).toBeNull();
    }
  });

  it("does not blow up long-line text (unwrapped paragraphs) with default options", async () => {
    const paras = Array.from({ length: 40 }, (_, i) => `Paragraph ${i}: ${"word ".repeat(60)}`);
    const text = paras.join("\n\n");
    const chunks = await chunkFile("README.md", text);
    const ranges = chunks.map((c) => `${c.startLine}-${c.endLine}`);
    expect(new Set(ranges).size).toBe(ranges.length);
    expect(chunks[0].startLine).toBe(1);
    expect(chunks.at(-1)!.endLine).toBe(79);
    const total = chunks.reduce((n, c) => n + c.text.length, 0);
    expect(total / text.length).toBeLessThan(2);
    for (const [i, c] of chunks.slice(1).entries()) {
      expect(c.startLine).toBeGreaterThan(chunks[i].startLine);
    }
  });

  it("returns nothing for empty or blank files", async () => {
    expect(await chunkFile("a.txt", "")).toEqual([]);
    expect(await chunkFile("a.ts", "\n\n  \n")).toEqual([]);
  });
});

describe("lineWindows", () => {
  it("always makes progress, even with a line longer than the limit", () => {
    const lines = ["x".repeat(100), "y", "z"];
    expect(lineWindows(lines, 0, 2, 10, 1)).toEqual([
      { start: 0, end: 0 },
      { start: 0 + 1, end: 2 },
    ]);
  });
});
