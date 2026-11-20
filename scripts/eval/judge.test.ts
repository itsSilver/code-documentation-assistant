import { describe, expect, it } from "vitest";
import type { Llm } from "../../src/server/llm/types";
import { gradeAnswer, parseGrade } from "./judge";

const fakeLlm = (reply: string): Llm => ({
  async *stream() {
    yield reply.slice(0, 5);
    yield reply.slice(5);
  },
});

describe("parseGrade", () => {
  it("reads JSON, even inside prose or a code fence", () => {
    expect(parseGrade('Sure:\n```json\n{"score": 2, "reason": "ok"}\n```')).toEqual({
      score: 2,
      reason: "ok",
    });
  });
  it.each(['{"score": 7}', '{"score": "high"}', "no json", '{"score": 1,'])(
    "rejects %s",
    (text) => {
      expect(parseGrade(text)).toBeNull();
    },
  );
});

describe("gradeAnswer", () => {
  it("joins the streamed reply and parses it", async () => {
    const g = await gradeAnswer(fakeLlm('{"score": 3, "reason": "complete"}'), {
      question: "q",
      reference: "r",
      answer: "a",
    });
    expect(g?.score).toBe(3);
  });
});
