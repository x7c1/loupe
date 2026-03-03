import { RepoItem, FlatItem, TabInfo } from "./types";

export interface AppContext {
  mode: "repos" | "files";
  repos: RepoItem[];
  allFiles: string[];
  subRepos: string[];
  tabs: TabInfo[];
  activeTabIndex: number;
  readonly vscode: { postMessage(message: unknown): void };
  readonly searchInput: HTMLInputElement;
  readonly listContainer: HTMLDivElement;
  focusedIndex: number;
  visibleItems: FlatItem[];
  expandedDirs: Set<string>;
  manuallyCollapsed: Set<string>;
}
