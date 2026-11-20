export async function* sseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const part of body as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(part, { stream: true });
    let end: number;
    while ((end = buffer.search(/\r?\n\r?\n/)) !== -1) {
      const event = buffer.slice(0, end);
      buffer = buffer.slice(end).replace(/^\r?\n\r?\n/, "");
      const data = event
        .split(/\r?\n/)
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart())
        .join("\n");
      if (data) yield data;
    }
  }
}
