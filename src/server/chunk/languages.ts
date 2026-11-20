import { createRequire } from "node:module";
import path from "node:path";
import { Language, Parser } from "web-tree-sitter";

export type Grammar = "typescript" | "tsx" | "javascript" | "python" | "go" | "java";

const EXTENSIONS: Record<string, Grammar> = {
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  py: "python",
  go: "go",
  java: "java",
};

export function grammarFor(filePath: string): Grammar | null {
  const dot = filePath.lastIndexOf(".");
  if (dot < 0) return null;
  return EXTENSIONS[filePath.slice(dot + 1).toLowerCase()] ?? null;
}

// Resolved from the project root, not import.meta.url: Next's bundler rewrites the latter to a
// virtual path, so the wasm files would not be found under `next dev`.
const require = createRequire(path.join(process.cwd(), "package.json"));
const loaded = new Map<Grammar, Promise<Language>>();
let ready: Promise<void> | undefined;

function init(): Promise<void> {
  ready ??= Parser.init({
    locateFile: (name: string) => path.join(path.dirname(require.resolve("web-tree-sitter")), name),
  });
  return ready;
}

export async function parserFor(grammar: Grammar): Promise<Parser> {
  await init();
  let language = loaded.get(grammar);
  if (!language) {
    const wasm = path.join(
      path.dirname(require.resolve("tree-sitter-wasms/package.json")),
      "out",
      `tree-sitter-${grammar}.wasm`,
    );
    language = Language.load(wasm);
    loaded.set(grammar, language);
  }
  const parser = new Parser();
  parser.setLanguage(await language);
  return parser;
}
