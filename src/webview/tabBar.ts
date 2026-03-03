import { AppContext } from "./appContext";

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

function collectCurrentState(ctx: AppContext): object {
  return {
    expandedDirs: Array.from(ctx.expandedDirs),
    manuallyCollapsed: Array.from(ctx.manuallyCollapsed),
    searchQuery: ctx.searchInput.value,
    focusedIndex: ctx.focusedIndex,
  };
}

export function renderTabBar(ctx: AppContext, tabBarEl: HTMLDivElement): void {
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

export function setupTabBar(ctx: AppContext, tabBarEl: HTMLDivElement): void {
  setupTabBarClick(ctx, tabBarEl);
  tabBarEl.addEventListener("wheel", (e: WheelEvent) => {
    if (e.deltaY !== 0) {
      e.preventDefault();
      tabBarEl.scrollLeft += e.deltaY;
    }
  }, { passive: false });
}

function setupTabBarClick(ctx: AppContext, tabBarEl: HTMLDivElement): void {
  tabBarEl.addEventListener("click", (e: MouseEvent) => {
    const closeBtn = (e.target as HTMLElement).closest("[data-tab-close]");
    const tabEl = (e.target as HTMLElement).closest("[data-repo-path]") as HTMLElement | null;
    if (!tabEl) return;
    const repoPath = tabEl.dataset.repoPath!;

    if (closeBtn) {
      ctx.vscode.postMessage({ type: "closeTab", repoPath });
    } else {
      ctx.vscode.postMessage({
        type: "switchTab",
        repoPath,
        currentState: collectCurrentState(ctx),
      });
    }
  });
}
