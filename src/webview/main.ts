import { render } from "./render";
import { setupEventHandlers } from "./events";
import { RepoItem, FlatItem, TabInfo } from "./types";

declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
};

const vscodeApi = acquireVsCodeApi();

const tabBarEl = document.getElementById("tabBar") as HTMLDivElement;

const ctx = {
  mode: "repos" as "repos" | "files",
  repos: [] as RepoItem[],
  allFiles: [] as string[],
  subRepos: [] as string[],
  tabs: [] as TabInfo[],
  activeTabIndex: -1,
  vscode: vscodeApi,
  searchInput: document.getElementById("searchInput") as HTMLInputElement,
  listContainer: document.getElementById("listContainer") as HTMLDivElement,
  focusedIndex: -1,
  visibleItems: [] as FlatItem[],
  expandedDirs: new Set<string>(),
  manuallyCollapsed: new Set<string>(),
};

function tabDisplayName(name: string, allNames: string[]): string {
  const parts = name.split("/");
  const baseName = parts[parts.length - 1];
  const hasDuplicate = allNames.some(
    n => n !== name && n.split("/").pop() === baseName
  );
  if (hasDuplicate && parts.length >= 2) {
    return parts.slice(-2).join("/");
  }
  return baseName;
}

function esc(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function collectCurrentState(): object {
  return {
    expandedDirs: Array.from(ctx.expandedDirs),
    manuallyCollapsed: Array.from(ctx.manuallyCollapsed),
    searchQuery: ctx.searchInput.value,
    focusedIndex: ctx.focusedIndex,
  };
}

function renderTabBar(): void {
  if (ctx.tabs.length === 0) {
    tabBarEl.innerHTML = "";
    return;
  }
  const allNames = ctx.tabs.map(t => t.repoName);
  tabBarEl.innerHTML = ctx.tabs.map((tab, i) => {
    const active = i === ctx.activeTabIndex ? " active" : "";
    return '<div class="tab-item' + active + '" data-repo-path="' + esc(tab.repoPath) + '">'
      + '<span class="tab-label">' + esc(tabDisplayName(tab.repoName, allNames)) + '</span>'
      + '<span class="tab-close" data-tab-close="true">&times;</span>'
      + '</div>';
  }).join("");
  const activeEl = tabBarEl.querySelector(".tab-item.active");
  if (activeEl) activeEl.scrollIntoView({ block: "nearest", inline: "nearest" });
}

// Tab bar click handling
tabBarEl.addEventListener("click", (e: MouseEvent) => {
  const closeBtn = (e.target as HTMLElement).closest("[data-tab-close]");
  const tabEl = (e.target as HTMLElement).closest("[data-repo-path]") as HTMLElement | null;
  if (!tabEl) return;
  const repoPath = tabEl.dataset.repoPath!;

  if (closeBtn) {
    vscodeApi.postMessage({ type: "closeTab", repoPath });
  } else {
    vscodeApi.postMessage({
      type: "switchTab",
      repoPath,
      currentState: collectCurrentState(),
    });
  }
});

setupEventHandlers(ctx);

// Handle state updates from extension
window.addEventListener("message", (event: MessageEvent) => {
  const msg = event.data;
  switch (msg.type) {
    case "setRepos":
      ctx.mode = "repos";
      ctx.repos = msg.repos;
      ctx.allFiles = [];
      ctx.subRepos = [];
      ctx.searchInput.value = "";
      ctx.focusedIndex = -1;
      ctx.expandedDirs.clear();
      ctx.manuallyCollapsed.clear();
      ctx.searchInput.placeholder = `Search repositories (${msg.repos.length})`;
      render(ctx);
      break;

    case "setFiles": {
      ctx.mode = "files";
      ctx.allFiles = msg.files;
      ctx.subRepos = msg.subRepos;

      const repoName: string = msg.repoName;
      ctx.searchInput.placeholder = `Search files in ${repoName} (${msg.files.length} files)`;

      if (msg.savedState) {
        // Restore saved tab state
        ctx.expandedDirs = new Set(msg.savedState.expandedDirs);
        ctx.manuallyCollapsed = new Set(msg.savedState.manuallyCollapsed);
        ctx.searchInput.value = msg.savedState.searchQuery;
        ctx.focusedIndex = msg.savedState.focusedIndex;
      } else {
        // New tab defaults
        ctx.searchInput.value = "";
        ctx.focusedIndex = -1;
        ctx.expandedDirs.clear();
        ctx.manuallyCollapsed.clear();

        // Pre-expand directories to reveal the active file
        const activeFile: string | undefined = msg.activeFile;
        if (activeFile) {
          const parts = activeFile.split("/");
          for (let i = 1; i < parts.length; i++) {
            ctx.expandedDirs.add(parts.slice(0, i).join("/"));
          }
        }
      }

      render(ctx);

      if (msg.savedState && ctx.focusedIndex >= 0) {
        const el = ctx.listContainer.querySelector(".focused");
        if (el) el.scrollIntoView({ block: "center" });
      } else if (!msg.savedState && msg.activeFile) {
        ctx.focusedIndex = ctx.visibleItems.findIndex(
          (item: FlatItem) => !item.isDir && item.path === msg.activeFile
        );
        if (ctx.focusedIndex >= 0) {
          render(ctx);
          const el = ctx.listContainer.querySelector(".focused");
          if (el) el.scrollIntoView({ block: "center" });
        }
      }
      break;
    }

    case "showRepoList":
      ctx.mode = "repos";
      ctx.repos = msg.repos;
      ctx.allFiles = [];
      ctx.subRepos = [];
      ctx.searchInput.value = "";
      ctx.focusedIndex = -1;
      ctx.expandedDirs.clear();
      ctx.manuallyCollapsed.clear();
      ctx.searchInput.placeholder = `Search repositories (${ctx.repos.length})`;
      render(ctx);
      break;

    case "updateTabs":
      ctx.tabs = msg.tabs;
      ctx.activeTabIndex = msg.activeIndex;
      renderTabBar();
      break;

    case "focusInput":
      ctx.searchInput.focus();
      break;
  }
});

// Notify extension that webview is ready
vscodeApi.postMessage({ type: "ready" });
requestAnimationFrame(() => ctx.searchInput.focus());
