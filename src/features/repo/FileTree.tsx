"use client";

import { useMemo, useState } from "react";
import { buildTree, type TreeNode } from "./tree";
import { ChevronRight, FileIcon } from "@/components/ui/Icons";

type Props = { paths: string[]; selected: string | null; onSelect: (path: string) => void };

/** Folders that usually hold the code, opened by default at the top level. */
const CODE_DIRS = /^(src|lib|app|pkg|packages|cmd|internal)$/;

function Node({
  node,
  depth,
  selected,
  onSelect,
  defaultOpen,
}: { node: TreeNode; depth: number; defaultOpen: boolean } & Omit<Props, "paths">) {
  // Open by default, and whenever the selected file is inside; a click overrides both.
  const [toggled, setToggled] = useState<boolean | null>(null);
  const open = toggled ?? (defaultOpen || !!selected?.startsWith(node.path + "/"));
  const pad = { paddingLeft: 8 + depth * 14 };
  if (node.children === null) {
    return (
      <li>
        <button
          type="button"
          className="tree-row"
          style={pad}
          aria-current={selected === node.path ? "true" : undefined}
          onClick={() => onSelect(node.path)}
          title={node.path}
        >
          <FileIcon size={14} className="tree-icon" />
          <span className="tree-name">{node.name}</span>
        </button>
      </li>
    );
  }
  return (
    <li>
      <button
        type="button"
        className="tree-row tree-dir"
        style={pad}
        aria-expanded={open}
        onClick={() => setToggled(!open)}
      >
        <ChevronRight size={14} className="tree-icon tree-chevron" />
        <span className="tree-name">{node.name}</span>
      </button>
      {open && (
        <ul>
          {node.children.map((c) => (
            <Node
              key={c.path}
              node={c}
              depth={depth + 1}
              selected={selected}
              onSelect={onSelect}
              defaultOpen={false}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function FileTree({ paths, selected, onSelect }: Props) {
  const tree = useMemo(() => buildTree(paths), [paths]);
  if (paths.length === 0) return null;
  const dirs = tree.filter((n) => n.children !== null);
  return (
    <nav aria-label="Files" className="tree-nav">
      <ul className="tree">
        {tree.map((n) => (
          <Node
            key={n.path}
            node={n}
            depth={0}
            selected={selected}
            onSelect={onSelect}
            defaultOpen={dirs.length === 1 || CODE_DIRS.test(n.name)}
          />
        ))}
      </ul>
    </nav>
  );
}
