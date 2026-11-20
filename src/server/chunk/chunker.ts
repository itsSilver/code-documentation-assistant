import type { Node } from "web-tree-sitter";
import { grammarFor, parserFor, type Grammar } from "./languages";
import { lineWindows } from "./windows";

export type ChunkKind =
  | "function"
  | "method"
  | "class"
  | "interface"
  | "enum"
  | "type"
  | "module" // top-level code outside any symbol: imports, constants, plain text files
  | "block"; // part of an oversized symbol that is not itself a symbol

export type CodeChunk = {
  path: string;
  /** 1-based, inclusive. */
  startLine: number;
  endLine: number;
  /** Qualified name such as `Cart.total`; for a `block`, the enclosing symbol; null for `module`. */
  symbol: string | null;
  kind: ChunkKind;
  text: string;
  /** `text` behind a header with path, symbol and lines; what gets embedded and keyword-indexed. */
  content: string;
};

export type ChunkOptions = {
  maxChars?: number;
  overlapLines?: number;
};

export const DEFAULT_MAX_CHARS = 1500;
export const DEFAULT_OVERLAP_LINES = 5;

type Piece = { start: number; end: number; symbol: string | null; kind: ChunkKind };
type Sym = { node: Node; name: string; kind: ChunkKind; container: boolean };
type Ctx = { lines: string[]; grammar: Grammar; maxChars: number; overlap: number };

const FUNCTION_VALUES = new Set(["arrow_function", "function_expression", "function"]);

export async function chunkFile(
  filePath: string,
  source: string,
  opts: ChunkOptions = {},
): Promise<CodeChunk[]> {
  const lines = source.split("\n");
  if (lines.at(-1) === "") lines.pop();
  if (lines.every((l) => l.trim() === "")) return [];
  const maxChars = opts.maxChars ?? DEFAULT_MAX_CHARS;
  const overlap = opts.overlapLines ?? DEFAULT_OVERLAP_LINES;

  const grammar = grammarFor(filePath);
  let pieces: Piece[];
  if (grammar) {
    const parser = await parserFor(grammar);
    const tree = parser.parse(source);
    if (!tree) throw new Error(`Could not parse ${filePath}`);
    try {
      const ctx: Ctx = { lines, grammar, maxChars, overlap };
      pieces = collect(tree.rootNode.namedChildren.filter(notNull), ctx, null, null);
    } finally {
      tree.delete();
      parser.delete();
    }
  } else {
    pieces = [{ start: 0, end: lines.length - 1, symbol: null, kind: "module" }];
  }
  return pieces.flatMap((p) => emit(filePath, lines, p, maxChars, overlap));
}

function notNull<T>(x: T | null): x is T {
  return x !== null;
}

function rowsOf(node: Node): { start: number; end: number } {
  const start = node.startPosition.row;
  let end = node.endPosition.row;
  if (node.endPosition.column === 0 && end > start) end--; // node ended with a newline
  return { start, end };
}

function sizeOf(lines: string[], start: number, end: number): number {
  let n = 0;
  for (let i = start; i <= end; i++) n += lines[i].length + 1;
  return n;
}

/**
 * Turns sibling nodes into pieces: each symbol becomes its own piece (split further when too
 * large), and the code between symbols is grouped into pieces of the enclosing scope. A comment
 * directly above a symbol belongs to that symbol.
 */
function collect(
  nodes: Node[],
  ctx: Ctx,
  scope: string | null,
  parentKind: ChunkKind | null,
): Piece[] {
  const out: Piece[] = [];
  const plain = (start: number, end: number) =>
    out.push({ start, end, symbol: scope, kind: scope ? "block" : "module" });
  let comments: Node[] = [];
  const flushComments = () => {
    for (const c of comments) plain(rowsOf(c).start, rowsOf(c).end);
    comments = [];
  };

  for (const node of nodes) {
    const rows = rowsOf(node);
    if (node.type.includes("comment")) {
      const last = comments.at(-1);
      if (last && rows.start > rowsOf(last).end + 1) flushComments();
      comments.push(node);
      continue;
    }
    const sym = classify(node, ctx.grammar, parentKind);
    if (!sym) {
      flushComments();
      plain(rows.start, rows.end);
      continue;
    }
    let start = rows.start;
    const last = comments.at(-1);
    if (last && rowsOf(last).end + 1 >= rows.start) {
      start = rowsOf(comments[0]).start;
      comments = [];
    }
    flushComments();
    out.push(...symbolPieces(sym, { start, end: rows.end }, ctx, scope));
  }
  flushComments();
  return merge(out, ctx);
}

function symbolPieces(
  sym: Sym,
  rows: { start: number; end: number },
  ctx: Ctx,
  scope: string | null,
): Piece[] {
  const symbol = scope ? `${scope}.${sym.name}` : sym.name;
  const whole: Piece = { ...rows, symbol, kind: sym.kind };
  if (sizeOf(ctx.lines, rows.start, rows.end) <= ctx.maxChars) return [whole];

  const body = sym.node.childForFieldName("body");
  const members = body?.namedChildren.filter(notNull) ?? [];
  if (members.length === 0) return [whole];
  const inner = collect(members, ctx, symbol, sym.kind);
  const first = inner[0].start;
  if (first > rows.start)
    inner.unshift({ start: rows.start, end: first - 1, symbol, kind: "block" });
  // The closing lines (`}`) belong to the last piece.
  inner[inner.length - 1].end = Math.max(inner[inner.length - 1].end, rows.end);
  return merge(inner, ctx);
}

function merge(pieces: Piece[], ctx: Ctx): Piece[] {
  const out: Piece[] = [];
  for (const p of pieces) {
    const prev = out.at(-1);
    const joinable =
      prev &&
      prev.symbol === p.symbol &&
      prev.kind === p.kind &&
      (p.kind === "module" || p.kind === "block") &&
      sizeOf(ctx.lines, prev.start, p.end) <= ctx.maxChars;
    if (joinable) prev.end = p.end;
    else out.push({ ...p });
  }
  return out;
}

function emit(
  filePath: string,
  lines: string[],
  piece: Piece,
  maxChars: number,
  overlap: number,
): CodeChunk[] {
  const windows =
    sizeOf(lines, piece.start, piece.end) <= maxChars
      ? [{ start: piece.start, end: piece.end }]
      : lineWindows(lines, piece.start, piece.end, maxChars, overlap);
  const chunks: CodeChunk[] = [];
  const seen = new Set<string>();
  for (const w of windows) {
    // Trim blank edges so line ranges point at code, not whitespace.
    let { start, end } = w;
    while (start < end && lines[start].trim() === "") start++;
    while (end > start && lines[end].trim() === "") end--;
    if (lines[start].trim() === "") continue;
    // Trimming can make two windows identical; keep one.
    if (seen.has(`${start}-${end}`)) continue;
    seen.add(`${start}-${end}`);
    const text = lines.slice(start, end + 1).join("\n");
    chunks.push({
      path: filePath,
      startLine: start + 1,
      endLine: end + 1,
      symbol: piece.symbol,
      kind: piece.kind,
      text,
      content: withHeader(filePath, piece, start + 1, end + 1, text),
    });
  }
  return chunks;
}

function withHeader(filePath: string, p: Piece, start: number, end: number, text: string): string {
  const where = p.symbol ? `Symbol: ${p.symbol} (${p.kind})\n` : "";
  return `File: ${filePath}\n${where}Lines: ${start}-${end}\n\n${text}`;
}

const TS_SYMBOLS: Record<string, [ChunkKind, boolean]> = {
  function_declaration: ["function", false],
  generator_function_declaration: ["function", false],
  class_declaration: ["class", true],
  abstract_class_declaration: ["class", true],
  method_definition: ["method", false],
  interface_declaration: ["interface", false],
  enum_declaration: ["enum", false],
  type_alias_declaration: ["type", false],
};

const SYMBOLS: Record<Grammar, Record<string, [ChunkKind, boolean]>> = {
  typescript: TS_SYMBOLS,
  tsx: TS_SYMBOLS,
  javascript: TS_SYMBOLS,
  python: {
    function_definition: ["function", false],
    class_definition: ["class", true],
  },
  go: {
    function_declaration: ["function", false],
    method_declaration: ["method", false],
    type_declaration: ["type", false],
  },
  java: {
    class_declaration: ["class", true],
    record_declaration: ["class", true],
    interface_declaration: ["interface", true],
    enum_declaration: ["enum", false],
    method_declaration: ["method", false],
    constructor_declaration: ["method", false],
  },
};

/** Recognises a symbol, looking through `export`, decorators and `const f = () => {}`. */
function classify(node: Node, grammar: Grammar, parentKind: ChunkKind | null): Sym | null {
  const inner = unwrap(node);
  if (!inner) return null;

  if (inner.type === "lexical_declaration" || inner.type === "variable_declaration") {
    for (const d of inner.namedChildren) {
      const value = d?.childForFieldName("value");
      const name = d?.childForFieldName("name");
      if (value && name && FUNCTION_VALUES.has(value.type)) {
        return { node: value, name: name.text, kind: "function", container: false };
      }
    }
    return null;
  }

  const entry = SYMBOLS[grammar][inner.type];
  if (!entry) return null;
  let [kind] = entry;
  const name = symbolName(inner, grammar);
  if (!name) return null;
  if (kind === "function" && parentKind === "class") kind = "method"; // Python
  return { node: inner, name, kind, container: entry[1] };
}

function unwrap(node: Node): Node | null {
  if (node.type === "export_statement") return node.childForFieldName("declaration") ?? null;
  if (node.type === "decorated_definition") return node.childForFieldName("definition") ?? null;
  return node;
}

function symbolName(node: Node, grammar: Grammar): string | null {
  if (grammar === "go" && node.type === "type_declaration") {
    return (
      node.namedChildren.find((c) => c?.type === "type_spec")?.childForFieldName("name")?.text ??
      null
    );
  }
  const name = node.childForFieldName("name")?.text ?? null;
  if (grammar === "go" && node.type === "method_declaration" && name) {
    const receiver = node
      .childForFieldName("receiver")
      ?.text.match(/\*?\s*(\w+)\s*(?:\[.*\])?\s*\)$/);
    return receiver ? `${receiver[1]}.${name}` : name;
  }
  return name;
}
