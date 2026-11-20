import type { ChatMessage } from "@/server/llm/types";

export const MAX_HISTORY_MESSAGES = 10;
export const MAX_HISTORY_MESSAGE_CHARS = 2000;

const isMessage = (m: unknown): m is ChatMessage =>
  typeof m === "object" &&
  m !== null &&
  ((m as ChatMessage).role === "user" || (m as ChatMessage).role === "assistant") &&
  typeof (m as ChatMessage).content === "string";

/** Keeps valid messages only, the most recent few, each truncated, so history cannot inflate cost. */
export function sanitizeHistory(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isMessage)
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_HISTORY_MESSAGE_CHARS) }));
}
