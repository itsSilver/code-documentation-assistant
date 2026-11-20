import type { OpenFile, RepoFile, RepoItem } from "@/shared/contracts";
import { getJson } from "@/shared/http";

export const fetchRepos = async (): Promise<RepoItem[]> =>
  (await getJson<{ repos: RepoItem[] }>("/api/repos")).repos;

export const fetchFiles = async (repoId: number): Promise<RepoFile[]> =>
  (await getJson<{ files: RepoFile[] }>(`/api/repos/${repoId}/files`)).files;

export const fetchFile = (repoId: number, path: string): Promise<OpenFile> =>
  getJson<OpenFile>(`/api/repos/${repoId}/file?path=${encodeURIComponent(path)}`);

export async function reindexRepo(repoId: number): Promise<void> {
  await fetch(`/api/repos/${repoId}/reindex`, { method: "POST" });
}

/** Throws with the server's message when the repo cannot be removed (e.g. it is embedding). */
export async function deleteRepo(repoId: number): Promise<void> {
  const res = await fetch(`/api/repos/${repoId}`, { method: "DELETE" });
  if (res.ok) return;
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  throw new Error(body.error ?? "Could not remove the repository");
}
