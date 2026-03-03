import { RenderContext, render } from "./render";
import { firstFileIndex, nextFileIndex, prevFileIndex } from "./navigation";
import { TabInfo } from "./types";

interface EventContext extends RenderContext {
  readonly vscode: { postMessage(message: unknown): void };
  readonly tabs: TabInfo[];
  readonly activeTabIndex: number;
  readonly searchInput: HTMLInputElement;
  readonly listContainer: HTMLDivElement;
}

export function setupEventHandlers(ctx: EventContext): void {
  setupSearch(ctx);
  setupClick(ctx);
  setupKeyboard(ctx);
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
    if (handleTabSwitch(e, ctx)) return;

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
    if (handleTabSwitch(e, ctx)) return;

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

// --- Tab switching ---

function handleTabSwitch(e: KeyboardEvent, ctx: EventContext): boolean {
  if (e.key !== "Tab" || ctx.tabs.length <= 1) return false;
  const direction = e.shiftKey ? -1 : 1;
  const nextIndex = ctx.activeTabIndex + direction;
  if (nextIndex < 0 || nextIndex >= ctx.tabs.length) return false; // let default Tab through
  e.preventDefault();
  e.stopPropagation();
  ctx.vscode.postMessage({
    type: "switchTab",
    repoPath: ctx.tabs[nextIndex].repoPath,
    currentState: collectState(ctx),
  });
  return true;
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
