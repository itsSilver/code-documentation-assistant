import { getRepository } from "@/server/container";
import { IngestError } from "@/server/ingest/errors";
import { downloadGithubZip, parseGithubUrl } from "@/server/ingest/github";
import { ingestFiles } from "@/server/ingest/ingest";
import { readUpload } from "@/server/ingest/upload";
import { readZip } from "@/server/ingest/zip";
import { indexQueue } from "@/server/search/queue";
import type { IngestStreamEvent } from "@/shared/contracts";

export const runtime = "nodejs";

/**
 * POST multipart `file` (a zip) or JSON `{ url }`. Streams progress as newline-delimited JSON:
 * {stage, message} lines, ending with {stage:"done", repoId} or {stage:"error", message}.
 * "done" means the files are stored and browsable; embedding then runs in the job queue and
 * its progress is reported by GET /api/repos.
 */
export async function POST(req: Request): Promise<Response> {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: IngestStreamEvent) =>
        controller.enqueue(encoder.encode(JSON.stringify(o) + "\n"));
      try {
        let name: string;
        let source: string;
        let zip: Buffer;
        if (req.headers.get("content-type")?.includes("multipart/form-data")) {
          send({ stage: "reading", message: "Reading zip" });
          const upload = await readUpload(req);
          name = upload.fileName.replace(/\.zip$/i, "");
          source = `zip:${upload.fileName}`;
          zip = upload.data;
        } else {
          const body = (await req.json().catch(() => ({}))) as { url?: unknown };
          const ref = parseGithubUrl(String(body.url ?? ""));
          name = `${ref.owner}/${ref.repo}`;
          source = `github:${name}${ref.ref ? `@${ref.ref}` : ""}`;
          send({ stage: "reading", message: `Downloading ${name}` });
          zip = await downloadGithubZip(ref);
        }
        send({ stage: "reading", message: "Extracting files" });
        const files = await readZip(zip);
        const repository = getRepository();
        const result = ingestFiles(repository, { name, source, files }, send);
        indexQueue()
          .enqueue(result.repoId)
          .catch(() => {}); // a failure is kept on the job and shown by GET /api/repos
        send({ stage: "done", message: `Stored ${result.files} files`, repoId: result.repoId });
      } catch (e) {
        const message = e instanceof IngestError ? e.message : "Ingest failed";
        if (!(e instanceof IngestError)) console.error(e);
        send({ stage: "error", message });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson" } });
}
