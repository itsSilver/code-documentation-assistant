"use client";

import { useMemo } from "react";
import { languageBreakdown, languageLabel, topFolders, type RepoFile } from "./repoSummary";
import { FileIcon, Folder } from "@/components/ui/Icons";

const COLORS: Record<string, string> = {
  javascript: "#e8c43a",
  typescript: "#3178c6",
  python: "#3572a5",
  go: "#00add8",
  rust: "#dea584",
  java: "#b07219",
  ruby: "#cc342d",
  markdown: "#6b7fd7",
  json: "#8f8f88",
  css: "#7c4dbd",
  html: "#e34c26",
  shell: "#89e051",
  yaml: "#cb4b4b",
  text: "var(--border-strong)",
};
const colorOf = (language: string) => COLORS[language] ?? "#a0a09a";

const START_HERE = /(^|\/)(readme(\.\w+)?|package\.json|pyproject\.toml|go\.mod|cargo\.toml)$/i;
const ENTRY = /^(src\/)?(main|index|app|server|cli)\.(ts|tsx|js|jsx|py|go)$/;

export type RepoInfo = { name: string; source: string };

function describeSource(source: string): { label: string; href?: string } {
  if (source.startsWith("https://github.com/"))
    return { label: source.replace("https://github.com/", "github.com/"), href: source };
  if (source.startsWith("github:")) {
    const [repo, ref] = source.slice(7).split("@");
    const href = `https://github.com/${repo}${ref ? `/tree/${ref}` : ""}`;
    return { label: href.replace("https://", ""), href };
  }
  if (source.startsWith("zip:")) return { label: `Uploaded ${source.slice(4)}` };
  return { label: source };
}

export function RepoOverview({
  repo,
  files,
  onOpen,
}: {
  repo: RepoInfo;
  files: RepoFile[];
  onOpen: (path: string) => void;
}) {
  const languages = useMemo(() => languageBreakdown(files), [files]);
  const folders = useMemo(() => topFolders(files, 4), [files]);
  const start = useMemo(
    () =>
      files
        .filter((f) => START_HERE.test(f.path) || ENTRY.test(f.path))
        .sort((a, b) => a.path.split("/").length - b.path.split("/").length)
        .slice(0, 4),
    [files],
  );
  const lines = files.reduce((n, f) => n + f.lineCount, 0);
  const source = describeSource(repo.source);

  return (
    <section className="overview" aria-label="Repository overview">
      <div className="overview-head">
        <h2>{repo.name}</h2>
        {source.href ? (
          <a className="overview-source" href={source.href} target="_blank" rel="noreferrer">
            {source.label}
          </a>
        ) : (
          <p className="overview-source">{source.label}</p>
        )}
      </div>

      <dl className="stats">
        <div>
          <dt>Files</dt>
          <dd>{files.length.toLocaleString("en")}</dd>
        </div>
        <div>
          <dt>Lines</dt>
          <dd>{lines.toLocaleString("en")}</dd>
        </div>
        <div>
          <dt>Languages</dt>
          <dd>{languages.filter((l) => l.language !== "text").length}</dd>
        </div>
      </dl>

      {languages.length > 0 && (
        <div className="langs">
          <div className="lang-bar" aria-hidden="true">
            {languages.map((l) => (
              <span
                key={l.language}
                style={{ flexGrow: l.share, background: colorOf(l.language) }}
              />
            ))}
          </div>
          <ul className="lang-legend">
            {languages.map((l) => (
              <li key={l.language}>
                <span className="dot" style={{ background: colorOf(l.language) }} />
                {languageLabel(l.language)}
                <span className="muted">{Math.round(l.share * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="overview-cols">
        {start.length > 0 && (
          <div>
            <h3>Start here</h3>
            <ul className="link-list">
              {start.map((f) => (
                <li key={f.path}>
                  <button type="button" onClick={() => onOpen(f.path)}>
                    <FileIcon size={14} />
                    <span className="mono">{f.path}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {folders.length > 1 && (
          <div>
            <h3>Folders</h3>
            <ul className="link-list static">
              {folders.map((f) => (
                <li key={f.name}>
                  <Folder size={14} />
                  <span className="mono">{f.name}/</span>
                  <span className="muted">{f.files}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <p className="overview-hint">
        Citations in answers open here, with the cited lines highlighted. You can also pick any file
        from the tree.
      </p>
    </section>
  );
}
