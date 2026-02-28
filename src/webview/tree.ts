import { TreeNode, FlatItem } from "./types";

/**
 * Build a tree structure from a flat list of file paths.
 */
export function buildTree(files: string[]): TreeNode {
  const root: TreeNode = { children: new Map(), isDir: true, name: "", path: "" };
  for (const file of files) {
    const parts = file.split("/");
    let cur = root;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const isLast = i === parts.length - 1;
      if (!cur.children.has(p)) {
        cur.children.set(p, {
          children: new Map(),
          isDir: !isLast,
          name: p,
          path: parts.slice(0, i + 1).join("/"),
        });
      }
      cur = cur.children.get(p)!;
    }
  }
  return root;
}

/**
 * Flatten a tree into a list of items for rendering.
 * Directories are sorted before files, both alphabetically.
 */
export function flattenTree(
  node: TreeNode,
  depth: number,
  result: FlatItem[],
  autoExpand: boolean,
  expandedDirs: Set<string>,
): FlatItem[] {
  const sorted = Array.from(node.children.values()).sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const child of sorted) {
    const isExp = autoExpand || expandedDirs.has(child.path);
    result.push({
      path: child.path, name: child.name, isDir: child.isDir,
      depth, isExpanded: isExp,
    });
    if (child.isDir && (isExp || autoExpand)) {
      if (!autoExpand) expandedDirs.add(child.path);
      flattenTree(child, depth + 1, result, autoExpand, expandedDirs);
    }
  }
  return result;
}
