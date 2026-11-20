// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { withCode } from "./withCode";

const codes = (text: string) =>
  [...render(<p>{withCode(text)}</p>).container.querySelectorAll("code")].map((c) => c.textContent);

describe("withCode", () => {
  it("keeps a whole KEY=value as one code span, URLs included", () => {
    expect(
      codes(
        "Set OPENROUTER_API_KEY, or LLM_PROVIDER=ollama with OLLAMA_BASE_URL=http://localhost:11434/v1, then restart.",
      ),
    ).toEqual([
      "OPENROUTER_API_KEY",
      "LLM_PROVIDER=ollama",
      "OLLAMA_BASE_URL=http://localhost:11434/v1",
    ]);
  });

  it("wraps a bare URL and leaves the sentence's comma outside", () => {
    expect(codes("See https://example.com/docs, then retry.")).toEqual([
      "https://example.com/docs",
    ]);
  });
});
