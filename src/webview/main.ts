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
  repoName: string;
}

const init = (window as unknown as { __LOUPE__: LoupeInit }).__LOUPE__;

const ctx = {
  mode: init.mode,
  repos: init.repos,
  allFiles: init.files,
  vscode: acquireVsCodeApi(),
  searchInput: document.getElementById("searchInput") as HTMLInputElement,
  listContainer: document.getElementById("listContainer") as HTMLDivElement,
  focusedIndex: -1,
  visibleItems: [] as never[],
  expandedDirs: new Set<string>(),
};

ctx.searchInput.placeholder = init.mode === "repos"
  ? `Search repositories (${init.repos.length})`
  : `Search files in ${init.repoName} (${init.files.length} files)`;

setupEventHandlers(ctx);
render(ctx);
requestAnimationFrame(() => ctx.searchInput.focus());
