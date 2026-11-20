import { getRepository } from "@/server/container";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  const path = new URL(req.url).searchParams.get("path");
  if (!Number.isInteger(id) || !path) {
    return Response.json({ error: "repo id and path are required" }, { status: 400 });
  }
  const file = getRepository().readFile(id, path);
  if (!file) return Response.json({ error: "File not found" }, { status: 404 });
  return Response.json(file);
}
