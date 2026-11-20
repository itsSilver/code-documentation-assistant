"use client";

import { useEffect, useRef, useState } from "react";
import { embedFraction, isStopped, type RepoItem } from "./repoStatus";
import { Alert, Check, ChevronDown, Plus, Repo, Ring } from "@/components/ui/Icons";

export type { RepoItem };

/** Embedding state of a repo in the menu: a ring with percent, "Queued", or "Stopped". */
function RowStatus({ repo }: { repo: RepoItem }) {
  if (repo.status === "indexing") {
    const f = embedFraction(repo);
    return (
      <span className="row-status">
        <Ring fraction={f} />
        {f !== null && `${Math.floor(f * 100)}%`}
      </span>
    );
  }
  if (repo.status === "queued") return <span className="row-status">Queued</span>;
  if (isStopped(repo))
    return (
      <span className="row-status row-status-warn">
        <Alert size={13} /> Stopped
      </span>
    );
  return null;
}

type Props = {
  repos: RepoItem[];
  current: RepoItem | undefined;
  onChoose: (id: number) => void;
  onAdd: () => void;
};

/** The repo picker in the header: every repo with its embedding state, plus "Add repository". */
export function RepoSwitcher({ repos, current, onChoose, onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const items = () => [
      ...(menu.current?.querySelectorAll<HTMLElement>("[role^=menuitem]") ?? []),
    ];
    (items().find((el) => el.getAttribute("aria-checked") === "true") ?? items()[0])?.focus();
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      root.current?.querySelector<HTMLElement>("button")?.focus();
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...(menu.current?.querySelectorAll<HTMLElement>("[role^=menuitem]") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next = (i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  }

  return (
    <div className="switcher" ref={root} onKeyDown={onKeyDown}>
      <button
        type="button"
        className="switcher-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Repository: ${current?.name ?? "none"}`}
        onClick={() => setOpen(!open)}
      >
        <Repo size={15} />
        <span className="switcher-name">{current?.name ?? "Choose a repository"}</span>
        <ChevronDown size={14} className="muted" />
      </button>
      {open && (
        <div className="menu" role="menu" ref={menu} aria-label="Repositories">
          <p className="menu-label">Repositories</p>
          {repos.map((r) => (
            <button
              key={r.id}
              type="button"
              role="menuitemradio"
              aria-checked={r.id === current?.id}
              className="menu-item"
              onClick={() => {
                setOpen(false);
                onChoose(r.id);
              }}
            >
              <span className="menu-main">
                <span className="menu-title">{r.name}</span>
                <span className="menu-sub">
                  {r.fileCount} files · {r.source.startsWith("zip:") ? "zip upload" : "GitHub"}
                </span>
              </span>
              <RowStatus repo={r} />
              {r.id === current?.id && <Check size={15} className="accent" />}
            </button>
          ))}
          <div className="menu-sep" />
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            onClick={() => {
              setOpen(false);
              onAdd();
            }}
          >
            <Plus size={15} />
            <span className="menu-title">Add repository…</span>
          </button>
        </div>
      )}
    </div>
  );
}
