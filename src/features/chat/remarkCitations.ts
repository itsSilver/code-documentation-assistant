import { splitCitations, type CitationRef } from "./citations";

type MdNode = { type: string; value?: string; url?: string; children?: MdNode[] };

export const CITE_PREFIX = "#cite-";

/** Joins neighbouring text nodes; the parser can split `[` and `]` into nodes of their own. */
function mergeText(children: MdNode[]): MdNode[] {
  const out: MdNode[] = [];
  for (const c of children) {
    const prev = out.at(-1);
    if (c.type === "text" && prev?.type === "text") prev.value = (prev.value ?? "") + c.value;
    else out.push(c.type === "text" ? { ...c } : c);
  }
  return out;
}

/**
 * A remark plugin that turns verified `[path:a-b]` tokens in prose into links to `#cite-<i>`,
 * where i indexes `citations`. Code spans and code blocks are separate node types, so tokens
 * inside them stay as code. The renderer maps those links to citation chips.
 */
export function remarkCitations(citations: CitationRef[]) {
  const walk = (node: MdNode) => {
    if (!node.children || node.type === "link") return;
    node.children = mergeText(node.children).flatMap((child): MdNode[] => {
      if (child.type !== "text") {
        walk(child);
        return [child];
      }
      return splitCitations(child.value ?? "", citations).map((s) =>
        "citation" in s
          ? {
              type: "link",
              url: CITE_PREFIX + citations.indexOf(s.citation),
              children: [{ type: "text", value: "" }],
            }
          : { type: "text", value: s.text },
      );
    });
  };
  return () => (tree: unknown) => walk(tree as MdNode);
}
