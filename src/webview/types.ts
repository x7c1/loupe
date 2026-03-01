export interface RepoItem {
  path: string;
  label: string;
  description: string;
}

export interface TreeNode {
  children: Map<string, TreeNode>;
  isDir: boolean;
  name: string;
  path: string;
}

export interface FlatItem {
  path: string;
  name: string;
  isDir: boolean;
  depth: number;
  isExpanded: boolean;
  fileCount?: number;
  label?: string;
  description?: string;
  isSubRepo?: boolean;
}
