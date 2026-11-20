"use client";

import { useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { CitationRef } from "./citations";
import { CITE_PREFIX, remarkCitations } from "./remarkCitations";
import { CodeBlock } from "@/components/ui/Code";

type Props = {
  text: string;
  citations: CitationRef[];
  onOpen: (c: CitationRef) => void;
  streaming?: boolean;
};

export const citationLabel = (c: CitationRef) =>
  `${c.path}:${c.startLine}${c.endLine !== c.startLine ? `-${c.endLine}` : ""}`;

const shortLabel = (c: CitationRef) => citationLabel({ ...c, path: c.path.split("/").pop()! });

type HastNode = {
  type: string;
  value?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};
const textOf = (n?: HastNode): string =>
  n?.type === "text" ? (n.value ?? "") : (n?.children ?? []).map(textOf).join("");

/**
 * An answer rendered as Markdown. Raw HTML is never rendered and images show as their alt text
 * (nothing is fetched). Verified `[path:a-b]` citations become chips that open the code viewer.
 */
export function Message({ text, citations, onOpen, streaming }: Props) {
  const remarkPlugins = useMemo(() => [remarkGfm, remarkCitations(citations)], [citations]);
  const components = useMemo<Components>(
    () => ({
      a({ href, children }) {
        if (href?.startsWith(CITE_PREFIX)) {
          const c = citations[Number(href.slice(CITE_PREFIX.length))];
          if (!c) return <>{children}</>;
          return (
            <button
              type="button"
              className="chip"
              onClick={() => onOpen(c)}
              aria-label={citationLabel(c)}
              title={`Open ${citationLabel(c)}`}
            >
              {shortLabel(c)}
            </button>
          );
        }
        return (
          <a href={href} target="_blank" rel="noreferrer noopener">
            {children}
          </a>
        );
      },
      pre({ node }) {
        const code = (node as HastNode | undefined)?.children?.find((c) => c.tagName === "code");
        const cls = (code?.properties?.className as string[] | undefined)?.find((c) =>
          c.startsWith("language-"),
        );
        return (
          <CodeBlock
            code={textOf(code).replace(/\n$/, "")}
            language={cls?.slice("language-".length) ?? "plain"}
          />
        );
      },
      img: ({ alt }) => <span>{alt}</span>,
    }),
    [citations, onOpen],
  );

  return (
    <div className="answer prose" data-streaming={streaming || undefined}>
      <ReactMarkdown remarkPlugins={remarkPlugins} components={components} skipHtml>
        {text}
      </ReactMarkdown>
    </div>
  );
}
