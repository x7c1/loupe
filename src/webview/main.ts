import { setupEventHandlers } from "./events";
import { setupMessageHandlers } from "./messageHandlers";
import { setupTabBarClick } from "./tabBar";
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

setupTabBarClick(ctx, tabBarEl);
setupEventHandlers(ctx);
setupMessageHandlers(ctx, tabBarEl);

vscodeApi.postMessage({ type: "ready" });
requestAnimationFrame(() => ctx.searchInput.focus());
