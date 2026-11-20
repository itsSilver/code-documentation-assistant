export const DEFAULT_LIMITS = {
  maxFileBytes: 256 * 1024,
  maxArchiveBytes: 50 * 1024 * 1024,
  maxUncompressedBytes: 200 * 1024 * 1024,
  maxEntries: 20_000,
};
export type Limits = typeof DEFAULT_LIMITS;

const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "vendor",
  "dist",
  "build",
  "out",
  "target",
  "coverage",
  "__pycache__",
  ".next",
  ".nuxt",
  ".svelte-kit",
  ".turbo",
  ".venv",
  "venv",
  ".idea",
  ".vscode",
]);

const LOCKFILES = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lockb",
  "bun.lock",
  "composer.lock",
  "Gemfile.lock",
  "Cargo.lock",
  "poetry.lock",
  "Pipfile.lock",
  "go.sum",
  "uv.lock",
]);

const BINARY_EXTENSIONS = new Set(
  (
    "png jpg jpeg gif webp ico bmp tiff svgz pdf zip tar gz tgz bz2 xz 7z rar jar war " +
    "exe dll so dylib a o class pyc wasm woff woff2 ttf otf eot mp3 mp4 mov avi wav ogg " +
    "webm sqlite db bin dat min.js map"
  ).split(" "),
);

export function isSkippedPath(filePath: string): boolean {
  const parts = filePath.split("/");
  const name = parts[parts.length - 1];
  if (parts.slice(0, -1).some((p) => SKIP_DIRS.has(p))) return true;
  if (LOCKFILES.has(name)) return true;
  const lower = name.toLowerCase();
  const ext = lower.includes(".") ? lower.slice(lower.indexOf(".") + 1) : "";
  const last = lower.slice(lower.lastIndexOf(".") + 1);
  return BINARY_EXTENSIONS.has(last) || BINARY_EXTENSIONS.has(ext);
}

/** Binary heuristic: a NUL byte in the first 8 KB, as git does. */
export function looksBinary(content: Uint8Array): boolean {
  return content.subarray(0, 8192).includes(0);
}

const LANGUAGES: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  py: "python",
  rb: "ruby",
  go: "go",
  rs: "rust",
  java: "java",
  kt: "kotlin",
  swift: "swift",
  c: "c",
  h: "c",
  cpp: "cpp",
  hpp: "cpp",
  cs: "csharp",
  php: "php",
  sh: "shell",
  md: "markdown",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  html: "html",
  css: "css",
  scss: "css",
  sql: "sql",
};

export function detectLanguage(filePath: string): string {
  const name = filePath.slice(filePath.lastIndexOf("/") + 1);
  if (name === "Dockerfile") return "dockerfile";
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1).toLowerCase() : "";
  return LANGUAGES[ext] ?? "text";
}

export function countLines(text: string): number {
  if (text === "") return 0;
  const n = text.split("\n").length;
  return text.endsWith("\n") ? n - 1 : n;
}
