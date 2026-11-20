import { describe, expect, it } from "vitest";
import { summarize, toMarkdown, type QuestionResult } from "./report";

const q = (over: Partial<QuestionResult>): QuestionResult => ({
  id: "q",
  question: "?",
  answerable: true,
  rank: 1,
  retrieved: [],
  ...over,
});

describe("summarize", () => {
  it("scores retrieval on answerable questions only and omits answers without an LLM", () => {
    const s = summarize([q({ rank: 1 }), q({ rank: null }), q({ answerable: false, rank: null })]);
    expect(s.retrieval.questions).toBe(2);
    expect(s.retrieval.hitAtK[1]).toBe(0.5);
    expect(s.answers).toBeUndefined();
  });

  it("scores answers, abstention, citations and grades", () => {
    const ans = (over: object) => ({
      text: "",
      answered: true,
      citations: [],
      citationPrecision: null,
      grade: null,
      ...over,
    });
    const s = summarize([
      q({ answer: ans({ citationPrecision: 1, grade: { score: 3, reason: "" } }) }),
      q({ answer: ans({ citationPrecision: 0.5, grade: { score: 0, reason: "" } }) }),
      q({ answer: ans({ answered: false }) }),
      q({ answerable: false, answer: ans({ answered: false }) }),
      q({ answerable: false, answer: ans({ answered: true }) }),
      q({ answer: ans({ error: "boom" }) }),
    ]).answers!;
    expect(s.answeredRate).toBeCloseTo(2 / 4);
    expect(s.abstainRate).toBe(0.5);
    expect(s.citationPrecision).toBe(0.75);
    expect(s.gradeScore).toBe(0.5);
    expect(s.ungraded).toBe(1);
    expect(s.errors).toBe(1);
  });
});

describe("toMarkdown", () => {
  it("says when answers were skipped and lists each question", () => {
    const results = [q({ id: "q01", question: "Where?", rank: 2 })];
    const md = toMarkdown({ date: "2026-11-20" }, results, summarize(results));
    expect(md).toContain("Skipped: no LLM configured");
    expect(md).toContain("| q01 | 2 | - | Where? |");
    expect(md).toContain("| hit@1 | 0% |");
  });
});
