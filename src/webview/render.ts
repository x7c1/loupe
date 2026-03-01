import { FlatItem, RepoItem } from "./types";
import { filterRepos, filterFiles } from "./filter";
import { buildTree, flattenTree } from "./tree";

export interface RenderContext {
  readonly mode: "repos" | "files";
  readonly repos: RepoItem[];
  readonly allFiles: string[];
  readonly searchInput: HTMLInputElement;
  readonly listContainer: HTMLDivElement;
  focusedIndex: number;
  visibleItems: FlatItem[];
  expandedDirs: Set<string>;
  manuallyCollapsed: Set<string>;
}

export function render(ctx: RenderContext): void {
  if (ctx.mode === "repos") renderRepos(ctx);
  else renderFiles(ctx);
}

function renderRepos(ctx: RenderContext): void {
  const query = ctx.searchInput.value.trim();
  const filtered = filterRepos(ctx.repos, query);
  ctx.visibleItems = filtered.map((r: RepoItem) => ({
    path: r.path, name: r.label, label: r.label,
    description: r.description, isDir: false, depth: 0, isExpanded: false,
  }));

  if (ctx.visibleItems.length === 0) {
    ctx.listContainer.innerHTML = '<div class="no-items">' +
      (ctx.repos.length === 0 ? "No repositories found" : "No matching repositories") + '</div>';
    return;
  }

  if (query.length > 0 && ctx.focusedIndex === -1) {
    ctx.focusedIndex = 0;
  }

  ctx.listContainer.innerHTML = ctx.visibleItems.map((item, i) => {
    const fc = i === ctx.focusedIndex ? " focused" : "";
    const desc = item.description ? '<span class="desc">' + esc(item.description) + '</span>' : "";
    return '<div class="list-item' + fc + '" data-index="' + i + '">'
      + '<span class="icon">\u{1F4E6}</span>'
      + '<span class="label">' + esc(item.label ?? item.name) + '</span>'
      + desc + '</div>';
  }).join("");
}

function renderFiles(ctx: RenderContext): void {
  const query = ctx.searchInput.value.trim();
  const isFiltered = query.length > 0;
  const filtered = filterFiles(ctx.allFiles, query);
  const tree = buildTree(filtered);
  const autoExpand = isFiltered && filtered.length <= 100;
  ctx.visibleItems = flattenTree(tree, 0, [], autoExpand, ctx.expandedDirs, ctx.manuallyCollapsed);

  if (ctx.visibleItems.length === 0) {
    ctx.listContainer.innerHTML = '<div class="no-items">' +
      (ctx.allFiles.length === 0 ? "No files loaded" : "No matching files") + '</div>';
    return;
  }

  ctx.listContainer.innerHTML = ctx.visibleItems.map((item, i) => {
    const dc = "depth-" + Math.min(item.depth, 20);
    const tc = item.isDir
      ? (item.isExpanded ? "toggle expanded" : "toggle collapsed")
      : "toggle leaf";
    const icon = item.isDir ? "\u{1F4C1}" : "\u{1F4C4}";
    const fc = i === ctx.focusedIndex ? " focused" : "";
    return '<div class="tree-item ' + dc + fc + '" data-index="' + i + '" data-is-dir="' + item.isDir + '">'
      + '<span class="' + tc + '"></span>'
      + '<span class="icon">' + icon + '</span>'
      + '<span class="label">' + esc(item.name) + '</span>'
      + '</div>';
  }).join("");
}

function esc(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
