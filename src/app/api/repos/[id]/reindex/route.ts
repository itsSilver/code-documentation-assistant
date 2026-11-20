import { getRepository } from "@/server/container";
import { indexQueue } from "@/server/search/queue";

export const runtime = "nodejs";

/** POST: embeds a repo's stored files again, replacing its chunks. Runs in the job queue. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return Response.json({ error: "Bad repo id" }, { status: 400 });
  if (
    !getRepository()
      .listRepos()
      .some((r) => r.id === id)
  )
    return Response.json({ error: "No such repo" }, { status: 404 });
  const queue = indexQueue();
  if (queue.isActive(id)) return Response.json({ error: "Already embedding" }, { status: 409 });
  // The job's outcome is read from GET /api/repos; a failure is kept on the job.
  queue.enqueue(id).catch(() => {});
  return Response.json({ status: "queued" }, { status: 202 });
}
