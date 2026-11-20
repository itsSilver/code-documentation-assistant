import { IngestError } from "./errors";
import { DEFAULT_LIMITS, type Limits } from "./rules";

// Multipart framing adds a little to the file itself.
const MULTIPART_OVERHEAD = 64 * 1024;

/**
 * Reads the `file` field of a multipart upload without ever holding more than the archive cap
 * in memory: rejects on content-length, and counts bytes while streaming in case it lies.
 */
export async function readUpload(
  req: Request,
  limits: Limits = DEFAULT_LIMITS,
): Promise<{ fileName: string; data: Buffer }> {
  const max = limits.maxArchiveBytes + MULTIPART_OVERHEAD;
  const declared = Number(req.headers.get("content-length") ?? NaN);
  if (declared > max) throw new IngestError("Archive is too large");
  if (!req.body) throw new IngestError("Missing zip file");

  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = req.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      throw new IngestError("Archive is too large");
    }
    chunks.push(value);
  }

  const form = await new Request(req.url, {
    method: "POST",
    headers: { "content-type": req.headers.get("content-type") ?? "" },
    body: Buffer.concat(chunks),
  })
    .formData()
    .catch(() => {
      throw new IngestError("Invalid upload");
    });
  const file = form.get("file");
  if (!(file instanceof File)) throw new IngestError("Missing zip file");
  if (file.size > limits.maxArchiveBytes) throw new IngestError("Archive is too large");
  return { fileName: file.name, data: Buffer.from(await file.arrayBuffer()) };
}
