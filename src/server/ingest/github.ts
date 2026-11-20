import { IngestError } from "./errors";
import { DEFAULT_LIMITS, type Limits } from "./rules";

export type GithubRef = { owner: string; repo: string; ref?: string };

/** Accepts https://github.com/owner/repo[.git][/tree/<ref>] only. */
export function parseGithubUrl(input: string): GithubRef {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new IngestError("Not a valid URL");
  }
  if (url.protocol !== "https:" || url.hostname !== "github.com") {
    throw new IngestError("Only https://github.com/owner/repo URLs are supported");
  }
  const [owner, rawRepo, kind, ...rest] = url.pathname.split("/").filter(Boolean);
  const repo = rawRepo?.replace(/\.git$/, "");
  const valid = /^[\w.-]+$/;
  if (!owner || !repo || !valid.test(owner) || !valid.test(repo)) {
    throw new IngestError("URL must look like https://github.com/owner/repo");
  }
  return { owner, repo, ref: kind === "tree" && rest.length ? rest.join("/") : undefined };
}

/**
 * Downloads the repo as a zip from codeload.github.com (public repos, no token, no git binary).
 * The body is streamed and aborted once it passes the archive size limit.
 */
export async function downloadGithubZip(
  ref: GithubRef,
  limits: Limits = DEFAULT_LIMITS,
  fetchImpl: typeof fetch = fetch,
): Promise<Buffer> {
  const target = ref.ref ? `refs/heads/${ref.ref}` : "HEAD";
  const res = await fetchImpl(
    `https://codeload.github.com/${ref.owner}/${ref.repo}/zip/${target}`,
    { redirect: "follow" },
  );
  if (res.status === 404) throw new IngestError("Repository not found, or it is private");
  if (!res.ok || !res.body) throw new IngestError(`GitHub download failed (${res.status})`);
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > limits.maxArchiveBytes) throw new IngestError("Archive is too large");

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    size += chunk.length;
    if (size > limits.maxArchiveBytes) throw new IngestError("Archive is too large");
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
