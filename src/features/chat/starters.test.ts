import { describe, expect, it } from "vitest";
import evals from "../../../evals/questions.json";
import { SAMPLE_SOURCE, starterQuestions } from "./starters";

describe("starterQuestions", () => {
  it("always offers the overview question for a user repo", () => {
    expect(starterQuestions([])[0]).toMatch(/what does this project do/i);
  });

  it("adds questions that match the files, up to four", () => {
    const q = starterQuestions([
      "src/index.ts",
      "src/api/users.ts",
      "src/db/schema.ts",
      "a.test.ts",
    ]);
    expect(q).toHaveLength(4);
    expect(q).toContain("What happens when src/index.ts runs?");
    expect(q).toContain("Which HTTP endpoints does it expose, and where are they defined?");
  });

  it("picks the shallowest entry point outside examples and tests", () => {
    const q = starterQuestions(["examples/x/cli.py", "src/pkg/cli.py", "main.go", "tests/main.go"]);
    expect(q).toContain("What happens when main.go runs?");
  });

  it("does not ask for endpoints in a framework whose files only look like routing", () => {
    const q = starterQuestions(["lib/router/route.js", "lib/router/index.js", "package.json"]);
    expect(q.some((s) => /endpoint/i.test(s))).toBe(false);
    expect(q).toContain("What are the main dependencies, and what is each used for?");
  });

  it("gives the sample answerable questions from the eval set", () => {
    const q = starterQuestions([], SAMPLE_SOURCE);
    expect(q).toHaveLength(4);
    for (const s of q) {
      const item = evals.questions.find((e) => e.question === s);
      expect(item?.expect.length).toBeGreaterThan(0);
    }
  });
});
