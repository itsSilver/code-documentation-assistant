"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Alert } from "@/components/ui/Icons";
import { Chat } from "@/features/chat/Chat";
import { starterQuestions } from "@/features/chat/starters";
import { IngestPanel } from "@/features/ingest/IngestPanel";
import { useIngest } from "@/features/ingest/useIngest";
import { CodeViewer, type Highlight } from "@/features/repo/CodeViewer";
import { EmbedStatus } from "@/features/repo/EmbedStatus";
import { FileTree } from "@/features/repo/FileTree";
import { RepoOverview } from "@/features/repo/RepoOverview";
import { useRepoBrowser } from "@/features/repo/useRepoBrowser";
import type { Citation, LlmStatus } from "@/shared/contracts";
import { getJson } from "@/shared/http";
import { Topbar } from "./Topbar";

type Tab = "files" | "chat" | "code";

function useLlmStatus(): LlmStatus | null {
  const [llm, setLlm] = useState<LlmStatus | null>(null);
  useEffect(() => {
    getJson<{ llm: LlmStatus }>("/api/status")
      .then((s) => setLlm(s.llm))
      .catch(() => setLlm(null));
  }, []);
  return llm;
}

export function Workspace() {
  const browser = useRepoBrowser();
  const { repos, repo, files, file, loadRepos } = browser;
  const llm = useLlmStatus();
  const [tab, setTab] = useState<Tab>("chat");
  const [adding, setAdding] = useState(false);

  const onIndexed = useCallback(
    (id: number) => {
      setAdding(false);
      setTab("chat");
      void loadRepos(id);
    },
    [loadRepos],
  );
  const ingest = useIngest(onIndexed);

  const browserOpenFile = browser.openFile;
  const openFile = useCallback(
    (path: string, range: Highlight | null) => {
      setTab("code");
      void browserOpenFile(path, range);
    },
    [browserOpenFile],
  );
  const openCitation = useCallback((c: Citation) => openFile(c.path, c), [openFile]);

  const paths = useMemo(() => files.map((f) => f.path), [files]);
  const starters = useMemo(() => starterQuestions(paths, repo?.source), [paths, repo?.source]);
  const hasRepos = !!repos && repos.length > 0;

  return (
    <div className="app" data-tab={tab}>
      <Topbar
        repos={repos}
        repo={repo}
        importing={ingest.state.status === "running" ? ingest.state : null}
        llm={llm}
        onChoose={browser.chooseRepo}
        onAdd={() => setAdding(true)}
      />

      <div className="tabs" role="tablist" aria-label="Panels">
        {(["files", "chat", "code"] as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      <main className="panes">
        <aside className="pane pane-files">
          {repo && (
            <>
              <p className="pane-title">
                Files <span className="muted">{files.length}</span>
              </p>
              <FileTree
                paths={paths}
                selected={file?.path ?? null}
                onSelect={(p) => openFile(p, null)}
              />
            </>
          )}
        </aside>
        <div className="pane pane-chat">
          {browser.reposError ? (
            <div className="pane-state">
              <div className="notice notice-error" role="alert">
                <Alert />
                <p>{browser.reposError}</p>
                <button type="button" className="btn btn-sm" onClick={() => void loadRepos()}>
                  Retry
                </button>
              </div>
            </div>
          ) : repos === null ? (
            <div className="pane-state" role="status">
              <span className="spinner" aria-hidden="true" /> Loading…
            </div>
          ) : !repo ? (
            <div className="first-run">
              <h2>No repository yet</h2>
              <p>Index a GitHub repo or a zip of your code to start asking questions.</p>
              <IngestPanel state={ingest.state} onStart={ingest.start} onReset={ingest.reset} />
            </div>
          ) : (
            <Chat
              key={repo.id}
              repoId={repo.id}
              repoName={repo.name}
              starters={starters}
              llm={llm}
              onOpen={openCitation}
              banner={
                <EmbedStatus
                  repo={repo}
                  onReindex={() => void browser.reindex(repo.id)}
                  onRemove={() => void browser.remove(repo)}
                />
              }
            />
          )}
        </div>
        <div className="pane pane-code">
          <CodeViewer
            file={file}
            highlight={browser.highlight}
            loading={browser.fileLoading}
            error={browser.fileError}
            onClose={browser.closeFile}
            empty={
              repo ? (
                <RepoOverview repo={repo} files={files} onOpen={(p) => openFile(p, null)} />
              ) : (
                <div className="pane-state muted">Code you open appears here.</div>
              )
            }
          />
        </div>
      </main>

      {adding && hasRepos && (
        <Dialog
          title="Add a repository"
          description="Files are stored and embedded on this machine; only retrieved snippets go to the model."
          onClose={() => setAdding(false)}
        >
          <IngestPanel state={ingest.state} onStart={ingest.start} onReset={ingest.reset} />
        </Dialog>
      )}
    </div>
  );
}
