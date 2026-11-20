import { describe, expect, it } from "vitest";
import { sseData } from "./sse";

const streamOf = (...parts: string[]) => {
  const enc = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(c) {
      for (const p of parts) c.enqueue(enc.encode(p));
      c.close();
    },
  });
};

const collect = async (body: ReadableStream<Uint8Array>) => {
  const out: string[] = [];
  for await (const d of sseData(body)) out.push(d);
  return out;
};

describe("sseData", () => {
  it("parses events delivered in one chunk", async () => {
    expect(await collect(streamOf("data: a\n\ndata: b\n\n"))).toEqual(["a", "b"]);
  });

  it("reassembles an event split mid-line", async () => {
    expect(await collect(streamOf("data: hel", "lo\n\ndata: x\n\n"))).toEqual(["hello", "x"]);
  });

  it("reassembles an event split mid-separator", async () => {
    expect(await collect(streamOf("data: a\n", "\ndata: b\r\n", "\r\n"))).toEqual(["a", "b"]);
  });

  it("ignores non-data lines and events without data", async () => {
    expect(await collect(streamOf("event: ping\n\n", "event: m\ndata: z\n\n"))).toEqual(["z"]);
  });
});
