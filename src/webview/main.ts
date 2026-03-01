import { render } from "./render";
import { setupEventHandlers } from "./events";
import { RepoItem } from "./types";

declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
};

interface LoupeInit {
  mode: "repos" | "files";
  repos: RepoItem[];
  files: string[];
  subRepos: string[];
  repoName: string;
  activeFile: string;
}

const init = (window as unknown as { __LOUPE__: LoupeInit }).__LOUPE__;

const ctx = {
  mode: init.mode,
  repos: init.repos,
  allFiles: init.files,
  subRepos: init.subRepos,
  vscode: acquireVsCodeApi(),
  searchInput: document.getElementById("searchInput") as HTMLInputElement,
  listContainer: document.getElementById("listContainer") as HTMLDivElement,
  focusedIndex: -1,
  visibleItems: [] as never[],
  expandedDirs: new Set<string>(),
  manuallyCollapsed: new Set<string>(),
};

ctx.searchInput.placeholder = init.mode === "repos"
  ? `Search repositories (${init.repos.length})`
  : `Search files in ${init.repoName} (${init.files.length} files)`;

// Pre-expand directories to reveal the active file
if (init.activeFile && init.mode === "files") {
  const parts = init.activeFile.split("/");
  for (let i = 1; i < parts.length; i++) {
    ctx.expandedDirs.add(parts.slice(0, i).join("/"));
  }
}

setupEventHandlers(ctx);
render(ctx);

// Focus the active file in the tree
if (init.activeFile && init.mode === "files") {
  ctx.focusedIndex = ctx.visibleItems.findIndex(
    (item) => !item.isDir && item.path === init.activeFile
  );
  if (ctx.focusedIndex >= 0) {
    render(ctx);
    const el = ctx.listContainer.querySelector(".focused");
    if (el) el.scrollIntoView({ block: "center" });
  }
}

requestAnimationFrame(() => ctx.searchInput.focus());
