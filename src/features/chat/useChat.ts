"use client";

import { useRef, useState } from "react";
import type { ChatStreamEvent, Citation, TraceSummary } from "@/shared/contracts";
import { readNdjson } from "@/shared/ndjson";
import { groupSources, type SourceFile } from "./sources";

export type Turn = {
  question: string;
  answer: string;
  citations: Citation[];
  sources: SourceFile[] | null;
  startedAt: number;
  trace?: TraceSummary;
  status: "streaming" | "done" | "error" | "stopped";
  error?: string;
};

const EMPTY_ANSWER =
  "The model finished without writing an answer. Try again, or ask a narrower question.";

/**
 * One conversation about one repo: asks /api/chat and folds the event stream into turns.
 * Only finished turns are sent back as history, so a failed or stopped answer is never context.
 */
export function useChat(repoId: number) {
  const [turns, setTurns] = useState<Turn[]>([]);
  // Mirrors `turns` so the stream loop always patches the latest list, not a stale closure.
  const turnsRef = useRef<Turn[]>([]);
  const abort = useRef<AbortController | null>(null);

  const update = (next: Turn[]) => {
    turnsRef.current = next;
    setTurns(next);
  };
  const patchLast = (p: Partial<Turn>) => {
    const t = turnsRef.current;
    update([...t.slice(0, -1), { ...t.at(-1)!, ...p }]);
  };

  async function run(question: string, history: object[], controller: AbortController) {
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repoId, question, history }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "The request failed");
      }
      let answer = "";
      for await (const e of readNdjson<ChatStreamEvent>(res)) {
        if (e.type === "sources") patchLast({ sources: groupSources(e.chunks) });
        else if (e.type === "delta") {
          answer += e.text;
          patchLast({ answer });
        } else if (e.type === "done") {
          // Reasoning models can spend every token thinking and return no text.
          if (!answer.trim()) throw new Error(EMPTY_ANSWER);
          patchLast({ citations: e.citations, trace: e.trace, status: "done" });
        } else if (e.type === "error") throw new Error(e.message);
      }
    } catch (e) {
      if (controller.signal.aborted) patchLast({ status: "stopped" });
      else
        patchLast({
          status: "error",
          error: e instanceof Error ? e.message : "The request failed",
        });
    } finally {
      abort.current = null;
    }
  }

  /** Starts a turn. Returns false, doing nothing, for a blank question or while one is streaming. */
  function ask(question: string, prior = turnsRef.current): boolean {
    const q = question.trim();
    if (!q || turnsRef.current.at(-1)?.status === "streaming") return false;
    const history = prior
      .filter((t) => t.status === "done")
      .flatMap((t) => [
        { role: "user", content: t.question },
        { role: "assistant", content: t.answer },
      ]);
    update([
      ...prior,
      {
        question: q,
        answer: "",
        citations: [],
        sources: null,
        startedAt: Date.now(),
        status: "streaming",
      },
    ]);
    const controller = new AbortController();
    abort.current = controller;
    void run(q, history, controller);
    return true;
  }

  function retry(): boolean {
    const t = turnsRef.current;
    const failed = t.at(-1);
    return failed ? ask(failed.question, t.slice(0, -1)) : false;
  }

  const stop = () => abort.current?.abort();

  return { turns, busy: turns.at(-1)?.status === "streaming", ask, retry, stop };
}
