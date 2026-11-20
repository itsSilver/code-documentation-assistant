import { describe, expect, it } from "vitest";
import { parseIngestProgress } from "./ingestProgress";

describe("parseIngestProgress", () => {
  it("maps server stages to checklist steps", () => {
    expect(parseIngestProgress({ stage: "reading", message: "Downloading a/b" }).step).toBe(
      "download",
    );
    expect(parseIngestProgress({ stage: "storing", message: "Storing 3 files" }).step).toBe(
      "store",
    );
  });
});
