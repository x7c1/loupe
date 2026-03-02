import { RenderContext, render } from "./render";
import { firstFileIndex, nextFileIndex, prevFileIndex } from "./navigation";
import { TabInfo } from "./types";

interface EventContext extends RenderContext {
  readonly vscode: { postMessage(message: unknown): void };
  readonly tabs: TabInfo[];
  readonly activeTabIndex: number;
  readonly tabBar: HTMLDivElement;
  tabNavMode: boolean;
  tabNavFilter: string;
  tabNavFocusIndex: number;
}

export function setupEventHandlers(ctx: EventContext): void {
  setupSearch(ctx);
  setupClick(ctx);
  setupKeyboard(ctx);
  setupTabNavigation(ctx);
}

function setupSearch(ctx: EventContext): void {
  let debounceTimer: ReturnType<typeof setTimeout>;
  ctx.searchInput.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const query = ctx.searchInput.value.trim();
      ctx.focusedIndex = -1;
      ctx.manuallyCollapsed.clear();
      render(ctx);
      if (query.length > 0 && ctx.mode === "files") {
        ctx.focusedIndex = firstFileIndex(ctx.visibleItems);
        render(ctx);
      } else if (query.length > 0 && ctx.mode === "repos") {
        ctx.focusedIndex = 0;
        render(ctx);
      }
      scrollToFocused(ctx);
      reportState(ctx);
    }, 100);
  });
}

function setupClick(ctx: EventContext): void {
  ctx.listContainer.addEventListener("click", (e: MouseEvent) => {
    const el = (e.target as HTMLElement).closest("[data-index]") as HTMLElement | null;
    if (!el) return;
    ctx.focusedIndex = parseInt(el.dataset.index!, 10);
    render(ctx);
    acceptFocused(ctx);
  });
}

function setupKeyboard(ctx: EventContext): void {
  ctx.searchInput.addEventListener("keydown", (e: KeyboardEvent) => {
    // Tab key enters tab navigation mode
    if (e.key === "Tab" && !e.shiftKey && ctx.tabs.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      enterTabNavMode(ctx);
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (ctx.searchInput.value.length > 0) {
        const val = ctx.searchInput.value;
        const lastSpace = val.lastIndexOf(" ");
        ctx.searchInput.value = lastSpace === -1 ? "" : val.slice(0, lastSpace);
        ctx.focusedIndex = -1;
        ctx.manuallyCollapsed.clear();
        render(ctx);
        reportState(ctx);
      } else if (ctx.mode === "files") {
        ctx.vscode.postMessage({
          type: "goBack",
          currentState: collectState(ctx),
        });
      }
      return;
    }
    if (handleTreeToggle(e, ctx)) return;
    handleArrowKeys(e, ctx);
  });

  ctx.listContainer.tabIndex = 0;
  ctx.listContainer.addEventListener("keydown", (e: KeyboardEvent) => {
    // Tab key enters tab navigation mode
    if (e.key === "Tab" && !e.shiftKey && ctx.tabs.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      enterTabNavMode(ctx);
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      ctx.searchInput.focus();
      return;
    }
    if (handleTreeToggle(e, ctx)) return;
    if (handleArrowKeys(e, ctx)) return;
    // Forward printable key presses to the search input
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      ctx.searchInput.focus();
    }
  });
}

// --- Tab navigation mode ---

function setupTabNavigation(ctx: EventContext): void {
  ctx.tabBar.tabIndex = 0;

  ctx.tabBar.addEventListener("keydown", (e: KeyboardEvent) => {
    if (!ctx.tabNavMode) return;

    if (e.key === "Tab") {
      e.preventDefault();
      e.stopPropagation();
      cycleTabFocus(ctx, e.shiftKey ? -1 : 1);
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      exitTabNavMode(ctx);
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      const visible = getVisibleTabs(ctx);
      const focused = visible[ctx.tabNavFocusIndex];
      if (focused) {
        const repoPath = focused.dataset.repoPath!;
        const state = collectState(ctx);
        exitTabNavMode(ctx);
        ctx.vscode.postMessage({
          type: "switchTab",
          repoPath,
          currentState: state,
        });
      }
      return;
    }

    if (e.key === "Backspace") {
      e.preventDefault();
      ctx.tabNavFilter = ctx.tabNavFilter.slice(0, -1);
      applyTabFilter(ctx);
      return;
    }

    // Printable characters → add to filter
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      ctx.tabNavFilter += e.key;
      applyTabFilter(ctx);
    }
  });

  // Exit tab nav mode when focus leaves the tab bar
  ctx.tabBar.addEventListener("focusout", (e: FocusEvent) => {
    if (ctx.tabNavMode && !ctx.tabBar.contains(e.relatedTarget as Node)) {
      ctx.tabNavMode = false;
      ctx.tabNavFilter = "";
      clearTabNavVisuals(ctx);
    }
  });
}

function enterTabNavMode(ctx: EventContext): void {
  if (ctx.tabs.length === 0) return;
  ctx.tabNavMode = true;
  ctx.tabNavFilter = "";
  ctx.tabNavFocusIndex = 0;
  clearTabNavVisuals(ctx);
  updateTabFocus(ctx);
  ctx.tabBar.focus();
}

function exitTabNavMode(ctx: EventContext): void {
  ctx.tabNavMode = false;
  ctx.tabNavFilter = "";
  clearTabNavVisuals(ctx);
  ctx.searchInput.focus();
}

function clearTabNavVisuals(ctx: EventContext): void {
  ctx.tabBar.querySelectorAll(".tab-item").forEach(el => {
    el.classList.remove("tab-focused");
    (el as HTMLElement).style.display = "";
  });
}

function getVisibleTabs(ctx: EventContext): HTMLElement[] {
  return Array.from(ctx.tabBar.querySelectorAll(".tab-item")).filter(
    el => (el as HTMLElement).style.display !== "none"
  ) as HTMLElement[];
}

function applyTabFilter(ctx: EventContext): void {
  const filter = ctx.tabNavFilter.toLowerCase();
  ctx.tabBar.querySelectorAll(".tab-item").forEach(el => {
    const label = el.querySelector(".tab-label")!.textContent!.toLowerCase();
    const matches = filter === "" || label.includes(filter);
    (el as HTMLElement).style.display = matches ? "" : "none";
    el.classList.remove("tab-focused");
  });
  ctx.tabNavFocusIndex = 0;
  updateTabFocus(ctx);
}

function updateTabFocus(ctx: EventContext): void {
  const visible = getVisibleTabs(ctx);
  visible.forEach((el, i) => {
    el.classList.toggle("tab-focused", i === ctx.tabNavFocusIndex);
  });
}

function cycleTabFocus(ctx: EventContext, direction: number): void {
  const visible = getVisibleTabs(ctx);
  if (visible.length === 0) return;
  ctx.tabNavFocusIndex = (ctx.tabNavFocusIndex + direction + visible.length) % visible.length;
  updateTabFocus(ctx);
}

// --- State reporting ---

function collectState(ctx: EventContext): object {
  return {
    expandedDirs: Array.from(ctx.expandedDirs),
    manuallyCollapsed: Array.from(ctx.manuallyCollapsed),
    searchQuery: ctx.searchInput.value,
    focusedIndex: ctx.focusedIndex,
  };
}

function reportState(ctx: EventContext): void {
  if (ctx.mode !== "files") return;
  ctx.vscode.postMessage({
    type: "reportState",
    state: collectState(ctx),
  });
}

// --- Shared key handlers ---

function handleArrowKeys(e: KeyboardEvent, ctx: EventContext): boolean {
  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (ctx.mode === "files") {
      ctx.focusedIndex = nextFileIndex(ctx.visibleItems, ctx.focusedIndex);
    } else {
      if (ctx.focusedIndex < ctx.visibleItems.length - 1) ctx.focusedIndex++;
      else ctx.focusedIndex = 0;
    }
    render(ctx);
    scrollToFocused(ctx);
    reportState(ctx);
    return true;
  }

  if (e.key === "ArrowUp") {
    e.preventDefault();
    if (ctx.mode === "files") {
      const prev = prevFileIndex(ctx.visibleItems, ctx.focusedIndex);
      if (prev === -1 && document.activeElement === ctx.listContainer) {
        render(ctx);
        ctx.searchInput.focus();
      } else {
        ctx.focusedIndex = prev;
        render(ctx);
        scrollToFocused(ctx);
      }
    } else {
      if (ctx.focusedIndex > 0) {
        ctx.focusedIndex--;
        render(ctx);
        scrollToFocused(ctx);
      } else if (ctx.focusedIndex === 0 && document.activeElement === ctx.listContainer) {
        ctx.focusedIndex = -1;
        render(ctx);
        ctx.searchInput.focus();
      }
    }
    reportState(ctx);
    return true;
  }

  if (e.key === "Enter") {
    e.preventDefault();
    acceptFocused(ctx);
    return true;
  }

  return false;
}

function handleTreeToggle(e: KeyboardEvent, ctx: EventContext): boolean {
  const item = ctx.visibleItems[ctx.focusedIndex];
  if (!item || !item.isDir) return false;

  if (e.key === "ArrowRight" && !item.isExpanded) {
    e.preventDefault();
    toggleDir(ctx, item.path, true);
    render(ctx);
    reportState(ctx);
    return true;
  }
  if (e.key === "ArrowLeft" && item.isExpanded) {
    e.preventDefault();
    toggleDir(ctx, item.path, false);
    render(ctx);
    reportState(ctx);
    return true;
  }
  return false;
}

function toggleDir(ctx: EventContext, path: string, expand: boolean): void {
  if (expand) {
    ctx.expandedDirs.add(path);
    ctx.manuallyCollapsed.delete(path);
  } else {
    ctx.expandedDirs.delete(path);
    ctx.manuallyCollapsed.add(path);
  }
}

// --- Utilities ---

function scrollToFocused(ctx: EventContext): void {
  const el = ctx.listContainer.querySelector(".focused");
  if (el) el.scrollIntoView({ block: "center" });
}

function acceptFocused(ctx: EventContext): void {
  const item = ctx.visibleItems[ctx.focusedIndex];
  if (!item) return;

  if (ctx.mode === "repos") {
    ctx.vscode.postMessage({ type: "selectRepo", path: item.path, label: item.label });
  } else if (item.isSubRepo) {
    ctx.vscode.postMessage({
      type: "selectSubRepo",
      path: item.path,
      currentState: collectState(ctx),
    });
  } else if (item.isDir) {
    toggleDir(ctx, item.path, !item.isExpanded);
    render(ctx);
    reportState(ctx);
  } else {
    ctx.vscode.postMessage({ type: "openFile", path: item.path });
  }
}
