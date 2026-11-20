"use client";

import { useState, type ReactNode } from "react";
import { ArrowUp, Square } from "@/components/ui/Icons";

type Props = {
  repoName: string;
  busy: boolean;
  /** Returns whether the question was accepted; the box is cleared only then. */
  onAsk: (question: string) => boolean;
  onStop: () => void;
  banner?: ReactNode;
};

export function Composer({ repoName, busy, onAsk, onStop, banner }: Props) {
  const [input, setInput] = useState("");
  const submit = () => {
    if (onAsk(input)) setInput("");
  };
  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {banner}
      <div className="composer-box">
        <label htmlFor="question" className="sr-only">
          Your question
        </label>
        <textarea
          id="question"
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={`Ask a question about ${repoName}…`}
        />
        {busy ? (
          <button type="button" className="send" aria-label="Stop" onClick={onStop}>
            <Square size={14} />
          </button>
        ) : (
          <button type="submit" className="send" aria-label="Ask" disabled={!input.trim()}>
            <ArrowUp size={16} />
          </button>
        )}
      </div>
      <p className="composer-hint">
        <kbd>Enter</kbd> to ask, <kbd>Shift</kbd>+<kbd>Enter</kbd> for a new line. Follow-ups keep
        the context.
      </p>
    </form>
  );
}
