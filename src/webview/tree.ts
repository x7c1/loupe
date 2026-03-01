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
 * Insert sub-repo entries into the tree.
 * Creates intermediate directories as needed.
 */
export function insertSubRepos(root: TreeNode, subRepoPaths: string[]): void {
  for (const repoPath of subRepoPaths) {
    const parts = repoPath.split("/");
    let cur = root;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (!cur.children.has(p)) {
        cur.children.set(p, {
          children: new Map(),
          isDir: true,
          name: p,
          path: parts.slice(0, i + 1).join("/"),
        });
      }
      cur = cur.children.get(p)!;
    }
  }
}

/**
 * Flatten a tree into a list of items for rendering.
 * Directories are sorted before files, both alphabetically.
 */
function countFiles(node: TreeNode, subRepoPaths: Set<string>): number {
  let count = 0;
  for (const child of node.children.values()) {
    if (subRepoPaths.has(child.path)) count++;
    else if (child.isDir) count += countFiles(child, subRepoPaths);
    else count++;
  }
  return count;
}

function hasSingleDirChild(node: TreeNode): boolean {
  const children = Array.from(node.children.values());
  return children.length === 1 && children[0].isDir;
}

export function flattenTree(
  node: TreeNode,
  depth: number,
  result: FlatItem[],
  autoExpand: boolean,
  expandedDirs: Set<string>,
  manuallyCollapsed: Set<string> = new Set(),
  subRepoPaths: Set<string> = new Set(),
): FlatItem[] {
  const sorted = Array.from(node.children.values()).sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  const parentIsSingleDir = hasSingleDirChild(node);
  for (const child of sorted) {
    const isSubRepo = subRepoPaths.has(child.path);
    if (isSubRepo) {
      // Sub-repos are rendered as leaf items (not expandable)
      result.push({
        path: child.path, name: child.name, isDir: false,
        depth, isExpanded: false, isSubRepo: true,
      });
      continue;
    }
    const isExp = (child.isDir && parentIsSingleDir) || (autoExpand
      ? !manuallyCollapsed.has(child.path)
      : expandedDirs.has(child.path));
    result.push({
      path: child.path, name: child.name, isDir: child.isDir,
      depth, isExpanded: isExp,
      fileCount: child.isDir ? countFiles(child, subRepoPaths) : undefined,
    });
    if (child.isDir && isExp) {
      if (!autoExpand) expandedDirs.add(child.path);
      flattenTree(child, depth + 1, result, autoExpand, expandedDirs, manuallyCollapsed, subRepoPaths);
    }
  }
  return result;
}
