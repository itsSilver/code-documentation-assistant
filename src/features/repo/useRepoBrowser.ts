"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OpenFile, RepoFile, RepoItem } from "@/shared/contracts";
import { deleteRepo, fetchFile, fetchFiles, fetchRepos, reindexRepo } from "./api";
import { isBusy } from "./repoStatus";
import type { Highlight } from "./CodeViewer";

/**
 * The repos, the selected repo's file list and the file open in the viewer. Selecting a repo
 * closes the open file; a slow file list for a repo the user already left is dropped.
 */
export function useRepoBrowser() {
  const [repos, setRepos] = useState<RepoItem[] | null>(null);
  const [reposError, setReposError] = useState<string | null>(null);
  const [repoId, setRepoId] = useState<number | null>(null);
  const [files, setFiles] = useState<RepoFile[]>([]);
  const [file, setFile] = useState<OpenFile | null>(null);
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const latestRepo = useRef<number | null>(null);
  const chooseRepo = useCallback((id: number) => {
    latestRepo.current = id;
    setFile(null);
    setHighlight(null);
    setFileError(null);
    setFiles([]);
    setRepoId(id);
    fetchFiles(id)
      .then((files) => latestRepo.current === id && setFiles(files))
      .catch((e: Error) => latestRepo.current === id && setFileError(e.message));
  }, []);

  const loadRepos = useCallback(
    async (select?: number) => {
      try {
        const repos = await fetchRepos();
        setRepos(repos);
        setReposError(null);
        const next = select ?? repos[0]?.id;
        if (next !== undefined) chooseRepo(next);
      } catch (e) {
        setReposError(e instanceof Error ? e.message : "Could not load repos");
      }
    },
    [chooseRepo],
  );

  useEffect(() => {
    const t = setTimeout(() => void loadRepos(), 0);
    return () => clearTimeout(t);
  }, [loadRepos]);

  // Poll while something embeds, so progress shows; stop as soon as nothing does.
  const busy = !!repos?.some(isBusy);
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => {
      fetchRepos()
        .then(setRepos)
        .catch(() => {});
    }, 1500);
    return () => clearInterval(t);
  }, [busy]);

  async function reindex(id: number) {
    await reindexRepo(id);
    const next = await fetchRepos().catch(() => null);
    if (next) setRepos(next);
  }

  async function remove(target: RepoItem) {
    if (
      !window.confirm(`Remove ${target.name}? Its files and index are deleted from this machine.`)
    )
      return;
    try {
      await deleteRepo(target.id);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not remove the repository");
      return;
    }
    await loadRepos();
  }

  const openPath = file?.path;
  const openFile = useCallback(
    async (path: string, range: Highlight | null) => {
      if (repoId === null) return;
      setHighlight(range);
      setFileError(null);
      if (openPath === path) return;
      setFileLoading(true);
      try {
        setFile(await fetchFile(repoId, path));
      } catch (e) {
        setFile(null);
        setFileError(e instanceof Error ? e.message : "Could not open file");
      } finally {
        setFileLoading(false);
      }
    },
    [repoId, openPath],
  );

  const closeFile = useCallback(() => {
    setFile(null);
    setHighlight(null);
  }, []);

  return {
    repos,
    reposError,
    repo: repos?.find((r) => r.id === repoId),
    files,
    file,
    highlight,
    fileLoading,
    fileError,
    chooseRepo,
    loadRepos,
    reindex,
    remove,
    openFile,
    closeFile,
  };
}
