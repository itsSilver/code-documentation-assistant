export type TreeNode = { name: string; path: string; children: TreeNode[] | null };

export function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode = { name: "", path: "", children: [] };
  for (const p of paths) {
    let node = root;
    const parts = p.split("/");
    parts.forEach((name, i) => {
      const path = parts.slice(0, i + 1).join("/");
      const isFile = i === parts.length - 1;
      let child = node.children!.find((c) => c.name === name && (c.children === null) === isFile);
      if (!child) {
        child = { name, path, children: isFile ? null : [] };
        node.children!.push(child);
      }
      node = child;
    });
  }
  const sort = (n: TreeNode) => {
    n.children?.sort(
      (a, b) =>
        Number((a.children === null) !== (b.children === null)) * (a.children === null ? 1 : -1) ||
        a.name.localeCompare(b.name),
    );
    n.children?.forEach(sort);
  };
  sort(root);
  return root.children!;
}
