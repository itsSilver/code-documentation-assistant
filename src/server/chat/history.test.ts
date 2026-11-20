import { describe, expect, it } from "vitest";
import { MAX_HISTORY_MESSAGES, MAX_HISTORY_MESSAGE_CHARS, sanitizeHistory } from "./history";

describe("sanitizeHistory", () => {
  it("returns an empty list for non-arrays and drops invalid entries", () => {
    expect(sanitizeHistory("x")).toEqual([]);
    expect(
      sanitizeHistory([{ role: "system", content: "x" }, 3, { role: "user", content: "ok" }]),
    ).toEqual([{ role: "user", content: "ok" }]);
  });

  it("keeps only the most recent messages", () => {
    const raw = Array.from({ length: 30 }, (_, i) => ({ role: "user", content: `m${i}` }));
    const out = sanitizeHistory(raw);
    expect(out).toHaveLength(MAX_HISTORY_MESSAGES);
    expect(out.at(-1)?.content).toBe("m29");
  });

  it("truncates oversized messages", () => {
    const out = sanitizeHistory([{ role: "assistant", content: "a".repeat(100_000) }]);
    expect(out[0].content).toHaveLength(MAX_HISTORY_MESSAGE_CHARS);
  });
});
