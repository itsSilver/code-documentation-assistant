import type { ReactNode } from "react";

/** Wraps ENV_VAR names and URLs in a server help message as code. */
export function withCode(text: string): ReactNode[] {
  return text
    .split(/(\b[A-Z][A-Z0-9_]{3,}(?:=[^\s,)]+)?|https?:\/\/\S+?(?=[,)]|\s|$))/)
    .map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part));
}
