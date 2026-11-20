import type { Chunk } from "../db/repository";
import type { Llm, LlmRequest, ChatMessage } from "../llm/types";
import type { SearchHit } from "../search/search";
import { Trace, type TraceSummary } from "../obs/trace";
import { parseCitations, type Citation } from "./citations";
import {
  CONDENSE_SYSTEM_PROMPT,
  HISTORY_TURNS,
  MAX_ANSWER_TOKENS,
  NOT_IN_REPO,
  SYSTEM_PROMPT,
  buildAnswerMessages,
  estimateTokens,
  selectWithinBudget,
} from "./prompt";

export type ChatEvent =
  | { type: "sources"; chunks: Chunk[] }
  | { type: "delta"; text: string }
  | { type: "done"; citations: Citation[]; answered: boolean; trace: TraceSummary };

export type ChatDeps = {
  llm: Llm;
  retrieve: (query: string) => Promise<SearchHit[]>;
  trace?: Trace;
};

async function collect(stream: AsyncIterable<string>): Promise<string> {
  let text = "";
  for await (const t of stream) text += t;
  return text;
}

/** Turns a follow-up into a standalone question. Falls back to the original on any failure. */
export async function condenseQuestion(
  llm: Llm,
  question: string,
  history: ChatMessage[],
  onUsage?: LlmRequest["onUsage"],
): Promise<string> {
  if (history.length === 0) return question;
  try {
    const text = await collect(
      llm.stream({
        system: CONDENSE_SYSTEM_PROMPT,
        messages: [...history.slice(-HISTORY_TURNS * 2), { role: "user", content: question }],
        maxTokens: 200,
        onUsage,
      }),
    );
    return text.trim() || question;
  } catch {
    return question;
  }
}

export async function* answerQuestion(
  { llm, retrieve, trace = new Trace(llm.model, llm.local) }: ChatDeps,
  question: string,
  history: ChatMessage[],
  signal?: AbortSignal,
): AsyncGenerator<ChatEvent> {
  const onUsage = (u: Parameters<NonNullable<LlmRequest["onUsage"]>>[0]) => trace.addUsage(u);
  const standalone = await trace.span("condense", (set) => {
    set({ skipped: history.length === 0 });
    return condenseQuestion(llm, question, history, onUsage);
  });
  const chunks = await trace.span("retrieve", async (set) => {
    const hits = await retrieve(standalone);
    const selected = selectWithinBudget(hits.map((h) => h.chunk));
    set({ candidates: hits.length, selected: selected.length });
    return selected;
  });
  trace.setChunkIds(chunks.map((c) => c.id));
  yield { type: "sources", chunks };

  if (chunks.length === 0) {
    yield { type: "delta", text: NOT_IN_REPO };
    yield { type: "done", citations: [], answered: false, trace: trace.summary() };
    return;
  }

  const messages = buildAnswerMessages(question, chunks, history);
  let answer = "";
  let reported = false;
  const start = performance.now();
  let firstTokenMs: number | undefined;
  try {
    for await (const text of llm.stream({
      system: SYSTEM_PROMPT,
      messages,
      maxTokens: MAX_ANSWER_TOKENS,
      signal,
      onUsage: (u) => {
        reported = true;
        onUsage(u);
      },
    })) {
      firstTokenMs ??= Math.round(performance.now() - start);
      answer += text;
      yield { type: "delta", text };
    }
  } finally {
    // Providers that report no usage get a chars/4 estimate, flagged as such.
    if (!reported) {
      trace.addUsage(
        {
          inputTokens: estimateTokens(SYSTEM_PROMPT + messages.map((m) => m.content).join("")),
          outputTokens: estimateTokens(answer),
        },
        true,
      );
    }
    trace.record("generate", start, { timeToFirstTokenMs: firstTokenMs ?? null });
  }
  const citations = parseCitations(answer, chunks);
  yield {
    type: "done",
    citations,
    answered: !answer.includes(NOT_IN_REPO),
    trace: trace.summary(),
  };
}
