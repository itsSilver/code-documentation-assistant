import { answerQuestion } from "@/server/chat/chat";
import { embedder, getRepository } from "@/server/container";
import { createLlm } from "@/server/llm/providers";
import { sanitizeHistory } from "@/server/chat/history";
import { LlmConfigError, describeLlmError } from "@/server/llm/types";
import { Trace, finishTrace } from "@/server/obs/trace";
import { log } from "@/server/obs/log";
import { search } from "@/server/search/search";
import type { ChatStreamEvent } from "@/shared/contracts";

import { randomUUID } from "node:crypto";

export const runtime = "nodejs";

const TOP_K = 12;
const MAX_QUESTION_CHARS = 2000;

const bad = (message: string, status = 400) => Response.json({ error: message }, { status });

/**
 * POST JSON `{ repoId, question, history? }`. Streams newline-delimited JSON events:
 * {type:"sources", chunks}, {type:"delta", text}…, then {type:"done", citations, answered},
 * or {type:"error", message} if the model fails part-way.
 */
export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question || question.length > MAX_QUESTION_CHARS)
    return bad("Ask a question (max 2000 characters)");
  if (!Number.isInteger(body.repoId)) return bad("repoId is required");
  const history = sanitizeHistory(body.history);

  let llm;
  try {
    llm = createLlm();
  } catch (e) {
    if (e instanceof LlmConfigError) return bad(e.message, 503);
    throw e;
  }

  const repository = getRepository();
  const repoId = body.repoId as number;
  const supplied = req.headers.get("x-request-id") ?? "";
  const requestId = /^[\w-]{1,64}$/.test(supplied) ? supplied : randomUUID();
  const trace = new Trace(llm.model, llm.local, requestId);
  log("info", "chat request", { requestId, repoId, questionChars: question.length });
  const deps = {
    llm,
    trace,
    retrieve: (q: string) => search({ repository, embedder }, repoId, q, TOP_K),
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: ChatStreamEvent) =>
        controller.enqueue(encoder.encode(JSON.stringify(o) + "\n"));
      try {
        for await (const event of answerQuestion(deps, question, history, req.signal)) send(event);
      } catch (e) {
        log("error", "chat failed", { requestId, error: e });
        send({ type: "error", message: describeLlmError(e, llm.model) });
      } finally {
        controller.close();
        finishTrace(trace);
      }
    },
  });
  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson", "x-request-id": requestId },
  });
}
