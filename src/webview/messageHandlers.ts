import { render } from "./render";
import { renderTabBar } from "./tabBar";
import { AppContext } from "./appContext";
import { RepoItem, FlatItem } from "./types";

export function setupMessageHandlers(ctx: AppContext, tabBarEl: HTMLDivElement): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlers: Record<string, (msg: any) => void> = {
    setRepos: (msg) => resetToRepoList(ctx, msg.repos),
    setFiles: (msg) => handleSetFiles(ctx, msg),
    showRepoList: (msg) => resetToRepoList(ctx, msg.repos),
    focusFile: (msg) => {
      if (ctx.mode === "files") focusFileInList(ctx, msg.activeFile);
    },
    triggerGoBack: () => {
      if (ctx.mode === "files") {
        ctx.vscode.postMessage({
          type: "goBack",
          currentState: collectCurrentState(ctx),
        });
      }
    },
    updateTabs: (msg) => {
      ctx.tabs = msg.tabs;
      ctx.activeTabIndex = msg.activeIndex;
      renderTabBar(ctx, tabBarEl);
    },
    focusInput: () => ctx.searchInput.focus(),
    "demo:type": (msg: { char: string }) => {
      ctx.searchInput.value += msg.char;
      ctx.searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    },
    "demo:key": (msg: { key: string; ctrlKey?: boolean; shiftKey?: boolean }) => {
      const target = document.activeElement === ctx.listContainer
        ? ctx.listContainer
        : ctx.searchInput;
      target.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: msg.key,
          ctrlKey: msg.ctrlKey ?? false,
          shiftKey: msg.shiftKey ?? false,
          bubbles: true,
        })
      );
    },
  };

  window.addEventListener("message", (event: MessageEvent) => {
    handlers[event.data.type]?.(event.data);
  });
}

function handleSetFiles(ctx: AppContext, msg: {
  files: string[];
  subRepos: string[];
  repoName: string;
  activeFile?: string;
  savedState?: {
    expandedDirs: string[];
    manuallyCollapsed: string[];
    searchQuery: string;
    focusedIndex: number;
  };
}): void {
  ctx.mode = "files";
  ctx.allFiles = msg.files;
  ctx.subRepos = msg.subRepos;
  ctx.searchInput.placeholder = `Search files in ${msg.repoName} (${msg.files.length} files)`;

  if (msg.savedState) {
    ctx.expandedDirs = new Set(msg.savedState.expandedDirs);
    ctx.manuallyCollapsed = new Set(msg.savedState.manuallyCollapsed);
    ctx.searchInput.value = msg.savedState.searchQuery;
    ctx.focusedIndex = msg.savedState.focusedIndex;
  } else {
    ctx.searchInput.value = "";
    ctx.focusedIndex = -1;
    ctx.expandedDirs.clear();
    ctx.manuallyCollapsed.clear();

    if (msg.activeFile) {
      const parts = msg.activeFile.split("/");
      for (let i = 1; i < parts.length; i++) {
        ctx.expandedDirs.add(parts.slice(0, i).join("/"));
      }
    }
  }

  render(ctx);

  if (msg.activeFile) {
    focusFileInList(ctx, msg.activeFile);
  } else if (msg.savedState && ctx.focusedIndex >= 0) {
    const el = ctx.listContainer.querySelector(".focused");
    if (el) el.scrollIntoView({ block: "center" });
  }
}

function resetToRepoList(ctx: AppContext, repos: RepoItem[]): void {
  ctx.mode = "repos";
  ctx.repos = repos;
  ctx.allFiles = [];
  ctx.subRepos = [];
  ctx.searchInput.value = "";
  ctx.focusedIndex = -1;
  ctx.expandedDirs.clear();
  ctx.manuallyCollapsed.clear();
  ctx.searchInput.placeholder = `Search repositories (${repos.length})`;
  render(ctx);
}

function collectCurrentState(ctx: AppContext): object {
  return {
    expandedDirs: Array.from(ctx.expandedDirs),
    manuallyCollapsed: Array.from(ctx.manuallyCollapsed),
    searchQuery: ctx.searchInput.value,
    focusedIndex: ctx.focusedIndex,
  };
}

function focusFileInList(ctx: AppContext, targetFile: string): void {
  if (ctx.searchInput.value.length > 0) {
    const idx = ctx.visibleItems.findIndex(
      (item: FlatItem) => !item.isDir && item.path === targetFile
    );
    if (idx >= 0) {
      ctx.focusedIndex = idx;
      render(ctx);
      const el = ctx.listContainer.querySelector(".focused");
      if (el) el.scrollIntoView({ block: "center" });
    }
  } else {
    const parts = targetFile.split("/");
    for (let i = 1; i < parts.length; i++) {
      ctx.expandedDirs.add(parts.slice(0, i).join("/"));
    }
    render(ctx);
    ctx.focusedIndex = ctx.visibleItems.findIndex(
      (item: FlatItem) => !item.isDir && item.path === targetFile
    );
    if (ctx.focusedIndex >= 0) {
      render(ctx);
      const el = ctx.listContainer.querySelector(".focused");
      if (el) el.scrollIntoView({ block: "center" });
    }
  }
}
