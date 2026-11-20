import { describe, expect, it } from "vitest";
import { buildTree } from "./tree";

describe("buildTree", () => {
  it("nests paths, with folders before files", () => {
    const tree = buildTree(["b.ts", "src/z.ts", "src/lib/a.ts", "a.ts"]);
    expect(tree.map((n) => n.name)).toEqual(["src", "a.ts", "b.ts"]);
    const src = tree[0];
    expect(src.children!.map((n) => n.name)).toEqual(["lib", "z.ts"]);
    expect(src.children![0].children![0]).toEqual({
      name: "a.ts",
      path: "src/lib/a.ts",
      children: null,
    });
  });
});
