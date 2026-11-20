import { getRepository } from "@/server/container";
import { indexQueue } from "@/server/search/queue";
import { repoStatus } from "@/server/search/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET: every repo, newest first, with its embedding status. A repo is browsable as soon as its
 * files are stored; search covers the chunks embedded so far.
 */
export function GET(): Response {
  const repository = getRepository();
  const queue = indexQueue();
  return Response.json({
    repos: repository.listRepos().map((r) => ({
      ...r,
      ...repoStatus(repository.isIndexed(r.id), repository.countChunks(r.id), queue.get(r.id)),
    })),
  });
}
