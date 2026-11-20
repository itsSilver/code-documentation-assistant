import { describe, expect, it } from "vitest";
import { readNdjson } from "./ndjson";

const streamOf = (...parts: string[]) =>
  new Response(
    new ReadableStream({
      start(c) {
        for (const p of parts) c.enqueue(new TextEncoder().encode(p));
        c.close();
      },
    }),
  );

const collect = async (res: Response) => {
  const out: unknown[] = [];
  for await (const e of readNdjson(res)) out.push(e);
  return out;
};

describe("readNdjson", () => {
  it("reassembles lines split across chunks", async () => {
    expect(await collect(streamOf('{"a":1}\n{"b"', ":2}\n"))).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("parses a final line without a trailing newline", async () => {
    expect(await collect(streamOf('{"a":1}\n{"b":2}'))).toEqual([{ a: 1 }, { b: 2 }]);
  });
});
