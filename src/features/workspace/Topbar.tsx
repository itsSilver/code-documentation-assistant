import { Alert, Cpu, Logo, Plus, Ring } from "@/components/ui/Icons";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import type { IngestState } from "@/features/ingest/useIngest";
import { RepoSwitcher } from "@/features/repo/RepoSwitcher";
import { embedFraction, isBusy, isStopped, statusLabel } from "@/features/repo/repoStatus";
import type { LlmStatus, RepoItem } from "@/shared/contracts";

type Props = {
  repos: RepoItem[] | null;
  repo: RepoItem | undefined;
  /** The import (download and store) in flight, if any. */
  importing: Extract<IngestState, { status: "running" }> | null;
  llm: LlmStatus | null;
  onChoose: (id: number) => void;
  onAdd: () => void;
};

/** The open repo's embedding state. */
function StatusPill({ repo }: { repo: RepoItem }) {
  if (repo.status === "ready")
    return (
      <span className="pill">
        <span className="dot dot-ok" aria-hidden="true" />
        Indexed
      </span>
    );
  if (isStopped(repo))
    return (
      <span className="pill pill-warn">
        <Alert size={13} /> Embedding stopped
      </span>
    );
  return (
    <span className="pill" role="status">
      <Ring fraction={embedFraction(repo)} />
      {statusLabel(repo)}
    </span>
  );
}

export function Topbar({ repos, repo, importing, llm, onChoose, onAdd }: Props) {
  const hasRepos = !!repos && repos.length > 0;
  const otherBusy = repos?.find((r) => r.id !== repo?.id && isBusy(r));
  return (
    <header className="topbar">
      <div className="brand">
        <Logo />
        <span className="brand-name">Code Documentation Assistant</span>
      </div>
      {hasRepos && (
        <>
          <span className="topbar-sep" aria-hidden="true">
            /
          </span>
          <RepoSwitcher repos={repos} current={repo} onChoose={onChoose} onAdd={onAdd} />
        </>
      )}
      {importing ? (
        <button type="button" className="pill pill-busy" onClick={onAdd}>
          <span className="spinner" aria-hidden="true" />
          Importing {importing.label}
        </button>
      ) : (
        repo && <StatusPill repo={repo} />
      )}
      {otherBusy && (
        <button
          type="button"
          className="pill pill-busy pill-other"
          onClick={() => onChoose(otherBusy.id)}
          title={`Open ${otherBusy.name}`}
        >
          <Ring fraction={embedFraction(otherBusy)} />
          {otherBusy.name} · {statusLabel(otherBusy).replace("Embedding ", "")}
        </button>
      )}
      <div className="topbar-end">
        {llm &&
          (llm.ready ? (
            <span className="pill pill-model" title="Language model answering questions">
              <Cpu size={14} />
              <span className="mono">{llm.model}</span>
              {llm.local && <span className="pill-tag">local</span>}
            </span>
          ) : (
            <span className="pill pill-warn" title={llm.help}>
              <Alert size={14} /> No model configured
            </span>
          ))}
        {hasRepos && (
          <button type="button" className="btn btn-ghost add-btn" onClick={onAdd}>
            <Plus size={15} /> Add repository
          </button>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}
