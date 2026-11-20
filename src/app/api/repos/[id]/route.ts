import { getRepository } from "@/server/container";
import { indexQueue } from "@/server/search/queue";

export const runtime = "nodejs";

/** DELETE: removes a repo with its files and chunks. Refused while it is embedding. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return Response.json({ error: "Bad repo id" }, { status: 400 });
  const queue = indexQueue();
  if (queue.isActive(id))
    return Response.json({ error: "Wait for embedding to finish" }, { status: 409 });
  getRepository().deleteRepo(id);
  queue.forget(id);
  return new Response(null, { status: 204 });
}
