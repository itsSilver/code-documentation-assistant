"use client";

import type { ReactNode } from "react";
import { Highlight, type PrismTheme } from "prism-react-renderer";

const EXT: Record<string, string> = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "jsx",
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "tsx",
  py: "python",
  go: "go",
  rs: "rust",
  java: "clike",
  kt: "kotlin",
  swift: "swift",
  c: "c",
  h: "c",
  cpp: "cpp",
  hpp: "cpp",
  cs: "clike",
  json: "json",
  md: "markdown",
  css: "css",
  scss: "css",
  html: "markup",
  xml: "markup",
  svg: "markup",
  yml: "yaml",
  yaml: "yaml",
  sql: "sql",
  graphql: "graphql",
};

export function prismLanguage(pathOrLang: string): string {
  const key = pathOrLang.slice(pathOrLang.lastIndexOf(".") + 1).toLowerCase();
  return EXT[key] ?? (Object.values(EXT).includes(key) ? key : "plain");
}

/** Colours come from CSS variables, so one theme follows light and dark mode. */
const theme: PrismTheme = {
  plain: { color: "var(--text)", backgroundColor: "transparent" },
  styles: [
    { types: ["comment", "prolog", "doctype", "cdata"], style: { color: "var(--syn-comment)" } },
    { types: ["punctuation", "operator"], style: { color: "var(--syn-punct)" } },
    {
      types: ["keyword", "boolean", "important", "atrule", "selector"],
      style: { color: "var(--syn-keyword)" },
    },
    {
      types: ["string", "char", "attr-value", "regex", "template-string", "url"],
      style: { color: "var(--syn-string)" },
    },
    { types: ["number", "constant", "symbol"], style: { color: "var(--syn-number)" } },
    {
      types: ["function", "class-name", "maybe-class-name"],
      style: { color: "var(--syn-function)" },
    },
    { types: ["property", "attr-name", "tag", "builtin"], style: { color: "var(--syn-property)" } },
    { types: ["title", "bold"], style: { fontWeight: "600" } },
    { types: ["italic"], style: { fontStyle: "italic" } },
  ],
};

export function HighlightedLines({
  code,
  language,
  children,
}: {
  code: string;
  language: string;
  children: (lines: ReactNode[]) => ReactNode;
}) {
  return (
    <Highlight code={code} language={language} theme={theme}>
      {({ tokens, getTokenProps }) => {
        const lines = tokens.map((line, i) => (
          <code key={i}>
            {line.map((token, j) => (
              <span key={j} {...getTokenProps({ token })} />
            ))}
            {line.length === 1 && line[0].empty ? " " : null}
          </code>
        ));
        return <>{children(lines)}</>;
      }}
    </Highlight>
  );
}

export function CodeBlock({ code, language }: { code: string; language: string }) {
  return (
    <div className="codeblock">
      {language !== "plain" && <span className="codeblock-lang">{language}</span>}
      <pre>
        <HighlightedLines code={code} language={prismLanguage(language)}>
          {(lines) => lines.map((l, i) => <div key={i}>{l}</div>)}
        </HighlightedLines>
      </pre>
    </div>
  );
}
