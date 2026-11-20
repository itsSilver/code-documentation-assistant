import type { RepoFile } from "@/shared/contracts";

export type { RepoFile };
export type LanguageShare = { language: string; files: number; lines: number; share: number };

const LABELS: Record<string, string> = {
  typescript: "TypeScript",
  javascript: "JavaScript",
  python: "Python",
  ruby: "Ruby",
  go: "Go",
  rust: "Rust",
  java: "Java",
  kotlin: "Kotlin",
  swift: "Swift",
  c: "C",
  cpp: "C++",
  csharp: "C#",
  php: "PHP",
  shell: "Shell",
  markdown: "Markdown",
  json: "JSON",
  yaml: "YAML",
  toml: "TOML",
  html: "HTML",
  css: "CSS",
  sql: "SQL",
  dockerfile: "Dockerfile",
  text: "Other",
};

export const languageLabel = (language: string) => LABELS[language] ?? language;

/**
 * Languages by share of lines, largest first. Languages under 2% are folded into "Other" so the
 * bar stays readable; "Other" always comes last.
 */
export function languageBreakdown(files: RepoFile[]): LanguageShare[] {
  const total = files.reduce((n, f) => n + f.lineCount, 0);
  if (total === 0) return [];
  const by = new Map<string, { files: number; lines: number }>();
  for (const f of files) {
    const e = by.get(f.language) ?? { files: 0, lines: 0 };
    e.files += 1;
    e.lines += f.lineCount;
    by.set(f.language, e);
  }
  const major: LanguageShare[] = [];
  const other = { language: "text", files: 0, lines: 0, share: 0 };
  for (const [language, e] of by) {
    if (language === "text" || e.lines / total < 0.02) {
      other.files += e.files;
      other.lines += e.lines;
    } else major.push({ language, ...e, share: e.lines / total });
  }
  major.sort((a, b) => b.lines - a.lines);
  if (other.lines > 0) major.push({ ...other, share: other.lines / total });
  return major;
}

export function topFolders(files: RepoFile[], limit = 5): { name: string; files: number }[] {
  const by = new Map<string, number>();
  for (const f of files) {
    const slash = f.path.indexOf("/");
    if (slash > 0) by.set(f.path.slice(0, slash), (by.get(f.path.slice(0, slash)) ?? 0) + 1);
  }
  return [...by]
    .map(([name, files]) => ({ name, files }))
    .sort((a, b) => b.files - a.files || a.name.localeCompare(b.name))
    .slice(0, limit);
}
