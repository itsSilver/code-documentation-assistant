"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Alert, ArrowRight, Retry } from "@/components/ui/Icons";
import type { Citation, LlmStatus } from "@/shared/contracts";
import { Composer } from "./Composer";
import { Message } from "./Message";
import { Progress } from "./Progress";
import { TracePanel } from "./TracePanel";
import { useChat } from "./useChat";
import { withCode } from "./withCode";

type Props = {
  repoId: number;
  repoName: string;
  starters: string[];
  llm: LlmStatus | null;
  onOpen: (c: Citation) => void;
  /** Shown above the composer, e.g. that the repo is still embedding. */
  banner?: ReactNode;
};

export function Chat({ repoId, repoName, starters, llm, onOpen, banner }: Props) {
  const chat = useChat(repoId);
  const { turns } = chat;
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    // Follow the stream only when the reader is already near the bottom.
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 160) el.scrollTop = el.scrollHeight;
  }, [turns]);

  const scrollToEnd = (started: boolean) => {
    if (started)
      requestAnimationFrame(() => {
        if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
      });
    return started;
  };
  const ask = (question: string) => scrollToEnd(chat.ask(question));
  const retry = () => scrollToEnd(chat.retry());

  const notReady = llm && !llm.ready ? llm.help : null;

  return (
    <section className="chat" aria-label="Chat">
      <div className="messages" ref={scroller}>
        <div className="thread" aria-live="polite">
          {turns.length === 0 && (
            <div className="welcome">
              <h2>Ask about {repoName}</h2>
              <p>
                Every answer cites the lines it is based on. Click a citation to open the code
                beside the chat.
              </p>
              {notReady && (
                <div className="notice notice-warn" role="status">
                  <Alert />
                  <div>
                    <p className="notice-title">No language model configured</p>
                    <p>{withCode(notReady)}</p>
                  </div>
                </div>
              )}
              <ul className="starters">
                {starters.map((s) => (
                  <li key={s}>
                    <button type="button" onClick={() => ask(s)}>
                      <span>{s}</span>
                      <ArrowRight size={14} className="starter-arrow" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {turns.map((t, i) => (
            <article key={i} className="turn">
              <p className="question">{t.question}</p>
              {t.status === "streaming" && (
                <Progress turn={t} local={llm?.ready ? llm.local : false} onOpen={onOpen} />
              )}
              {t.answer && (
                <Message
                  text={t.answer}
                  citations={t.status === "done" ? t.citations : []}
                  onOpen={onOpen}
                  streaming={t.status === "streaming"}
                />
              )}
              {t.status === "done" && t.trace && <TracePanel trace={t.trace} />}
              {t.status === "stopped" && <p className="turn-note">Stopped.</p>}
              {t.status === "error" && (
                <div className="notice notice-error" role="alert">
                  <Alert />
                  <div>
                    <p className="notice-title">
                      {notReady ? "No language model configured" : "Could not answer"}
                    </p>
                    <p>{withCode(t.error ?? "")}</p>
                  </div>
                  {i === turns.length - 1 && (
                    <button type="button" className="btn btn-sm" onClick={retry}>
                      <Retry size={14} /> Retry
                    </button>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
      <Composer
        repoName={repoName}
        busy={chat.busy}
        onAsk={ask}
        onStop={chat.stop}
        banner={banner}
      />
    </section>
  );
}
