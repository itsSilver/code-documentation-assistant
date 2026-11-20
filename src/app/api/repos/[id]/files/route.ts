import { getRepository } from "@/server/container";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return Response.json({ error: "Bad repo id" }, { status: 400 });
  return Response.json({ files: getRepository().listFiles(id) });
}
