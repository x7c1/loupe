// Webview global types
declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
};

interface LoupeInit {
  mode: "repos" | "files";
  repos: RepoItem[];
  files: string[];
  repoName: string;
}

interface RepoItem {
  path: string;
  label: string;
  description: string;
}

interface TreeNode {
  children: Map<string, TreeNode>;
  isDir: boolean;
  name: string;
  path: string;
}

interface FlatItem {
  type: string;
  path: string;
  name: string;
  isDir: boolean;
  depth: number;
  isExpanded: boolean;
  label?: string;
  description?: string;
}

// Initial data is injected by viewProvider.ts via inline script
const { mode: MODE, repos: REPOS, files: ALL_FILES, repoName: REPO_NAME } =
  (window as unknown as { __LOUPE__: LoupeInit }).__LOUPE__;

const vscode = acquireVsCodeApi();
const searchInput = document.getElementById("searchInput") as HTMLInputElement;
const listContainer = document.getElementById("listContainer") as HTMLDivElement;

let focusedIndex = -1;
let visibleItems: FlatItem[] = [];
const expandedDirs = new Set<string>();

if (MODE === "repos") {
  searchInput.placeholder = "Search repositories (" + REPOS.length + ")";
  renderRepos();
} else {
  searchInput.placeholder = "Search files in " + REPO_NAME + " (" + ALL_FILES.length + " files)";
  renderFiles();
}

requestAnimationFrame(() => searchInput.focus());

// --- Repo list mode ---

function filterRepos(query: string): RepoItem[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
  if (tokens.length === 0) return REPOS;
  return REPOS.filter(r => {
    let h = (r.label + " " + r.description).toLowerCase();
    for (const t of tokens) {
      const idx = h.indexOf(t);
      if (idx === -1) return false;
      h = h.slice(0, idx) + h.slice(idx + t.length);
    }
    return true;
  });
}

function renderRepos(): void {
  const query = searchInput.value.trim();
  const filtered = filterRepos(query);
  visibleItems = filtered.map((r: RepoItem) => ({
    type: "repo", path: r.path, name: r.label, label: r.label,
    description: r.description, isDir: false, depth: 0, isExpanded: false,
  }));

  if (visibleItems.length === 0) {
    listContainer.innerHTML = '<div class="no-items">' +
      (REPOS.length === 0 ? "No repositories found" : "No matching repositories") + '</div>';
    return;
  }

  if (query.length > 0 && focusedIndex === -1) {
    focusedIndex = 0;
  }

  listContainer.innerHTML = visibleItems.map((item, i) => {
    const fc = i === focusedIndex ? " focused" : "";
    const desc = item.description ? '<span class="desc">' + esc(item.description) + '</span>' : "";
    return '<div class="list-item' + fc + '" data-index="' + i + '">'
      + '<span class="icon">\u{1F4E6}</span>'
      + '<span class="label">' + esc(item.label ?? item.name) + '</span>'
      + desc + '</div>';
  }).join("");
}

// --- File tree mode ---

function filterFiles(query: string): string[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
  if (tokens.length === 0) return ALL_FILES;
  return ALL_FILES.filter((f: string) => {
    let h = f.toLowerCase();
    for (const t of tokens) {
      const idx = h.indexOf(t);
      if (idx === -1) return false;
      h = h.slice(0, idx) + h.slice(idx + t.length);
    }
    return true;
  });
}

function buildTree(files: string[]): TreeNode {
  const root: TreeNode = { children: new Map(), isDir: true, name: "", path: "" };
  for (const file of files) {
    const parts = file.split("/");
    let cur = root;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const isLast = i === parts.length - 1;
      if (!cur.children.has(p)) {
        cur.children.set(p, {
          children: new Map(),
          isDir: !isLast,
          name: p,
          path: parts.slice(0, i + 1).join("/"),
        });
      }
      cur = cur.children.get(p)!;
    }
  }
  return root;
}

function flattenTree(node: TreeNode, depth: number, result: FlatItem[], autoExpand: boolean): FlatItem[] {
  const sorted = Array.from(node.children.values()).sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const child of sorted) {
    const isExp = autoExpand || expandedDirs.has(child.path);
    result.push({ path: child.path, name: child.name, isDir: child.isDir, depth, isExpanded: isExp, type: "file" });
    if (child.isDir && (isExp || autoExpand)) {
      if (!autoExpand) expandedDirs.add(child.path);
      flattenTree(child, depth + 1, result, autoExpand);
    }
  }
  return result;
}

function firstFileIndex(): number {
  for (let i = 0; i < visibleItems.length; i++) {
    if (!visibleItems[i].isDir) return i;
  }
  return -1;
}

function nextFileIndex(current: number): number {
  for (let i = current + 1; i < visibleItems.length; i++) {
    if (!visibleItems[i].isDir) return i;
  }
  return current;
}

function prevFileIndex(current: number): number {
  for (let i = current - 1; i >= 0; i--) {
    if (!visibleItems[i].isDir) return i;
  }
  return -1;
}

function renderFiles(): void {
  const query = searchInput.value.trim();
  const isFiltered = query.length > 0;
  const filtered = filterFiles(query);
  const tree = buildTree(filtered);
  const autoExpand = isFiltered && filtered.length <= 100;
  const items = flattenTree(tree, 0, [], autoExpand);
  visibleItems = items;

  if (items.length === 0) {
    listContainer.innerHTML = '<div class="no-items">' +
      (ALL_FILES.length === 0 ? "No files loaded" : "No matching files") + '</div>';
    return;
  }

  listContainer.innerHTML = items.map((item, i) => {
    const dc = "depth-" + Math.min(item.depth, 20);
    const tc = item.isDir
      ? (item.isExpanded ? "toggle expanded" : "toggle collapsed")
      : "toggle leaf";
    const icon = item.isDir ? "\u{1F4C1}" : "\u{1F4C4}";
    const fc = i === focusedIndex ? " focused" : "";
    return '<div class="tree-item ' + dc + fc + '" data-index="' + i + '" data-is-dir="' + item.isDir + '">'
      + '<span class="' + tc + '"></span>'
      + '<span class="icon">' + icon + '</span>'
      + '<span class="label">' + esc(item.name) + '</span>'
      + '</div>';
  }).join("");
}

function render(): void {
  if (MODE === "repos") renderRepos();
  else renderFiles();
}

// --- Shared logic ---

function esc(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function scrollToFocused(): void {
  const el = listContainer.querySelector(".focused");
  if (el) el.scrollIntoView({ block: "nearest" });
}

function acceptFocused(): void {
  const item = visibleItems[focusedIndex];
  if (!item) return;

  if (MODE === "repos") {
    vscode.postMessage({ type: "selectRepo", path: item.path, label: item.label });
  } else {
    if (item.isDir) {
      if (expandedDirs.has(item.path)) expandedDirs.delete(item.path);
      else expandedDirs.add(item.path);
      render();
    } else {
      vscode.postMessage({ type: "openFile", path: item.path });
    }
  }
}

// Debounced search
let debounceTimer: ReturnType<typeof setTimeout>;
searchInput.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const query = searchInput.value.trim();
    focusedIndex = -1;
    render();
    if (query.length > 0 && MODE === "files") {
      focusedIndex = firstFileIndex();
      render();
    } else if (query.length > 0 && MODE === "repos") {
      focusedIndex = 0;
      render();
    }
    scrollToFocused();
  }, 100);
});

// Click
listContainer.addEventListener("click", (e: MouseEvent) => {
  const el = (e.target as HTMLElement).closest("[data-index]") as HTMLElement | null;
  if (!el) return;
  focusedIndex = parseInt(el.dataset.index!, 10);
  acceptFocused();
});

// Keyboard
searchInput.addEventListener("keydown", (e: KeyboardEvent) => {
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    if (searchInput.value.length > 0) {
      searchInput.value = "";
      focusedIndex = -1;
      expandedDirs.clear();
      render();
    } else if (MODE === "files") {
      vscode.postMessage({ type: "goBack" });
    }
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    if (MODE === "files") {
      focusedIndex = nextFileIndex(focusedIndex);
    } else {
      if (focusedIndex < visibleItems.length - 1) focusedIndex++;
      else focusedIndex = 0;
    }
    render();
    scrollToFocused();
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    if (MODE === "files") {
      const prev = prevFileIndex(focusedIndex);
      focusedIndex = prev;
    } else {
      if (focusedIndex > 0) focusedIndex--;
    }
    render();
    scrollToFocused();
  } else if (e.key === "Enter") {
    e.preventDefault();
    acceptFocused();
  }
});

listContainer.tabIndex = 0;
listContainer.addEventListener("keydown", (e: KeyboardEvent) => {
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    searchInput.focus();
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    if (MODE === "files") {
      focusedIndex = nextFileIndex(focusedIndex);
    } else {
      if (focusedIndex < visibleItems.length - 1) focusedIndex++;
    }
    render(); scrollToFocused();
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    if (MODE === "files") {
      const prev = prevFileIndex(focusedIndex);
      if (prev === -1) { render(); searchInput.focus(); }
      else { focusedIndex = prev; render(); scrollToFocused(); }
    } else {
      if (focusedIndex > 0) {
        focusedIndex--; render(); scrollToFocused();
      } else if (focusedIndex === 0) {
        focusedIndex = -1; render(); searchInput.focus();
      }
    }
  } else if (e.key === "Enter") {
    e.preventDefault();
    acceptFocused();
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    const n = visibleItems[focusedIndex];
    if (n && n.isDir && !expandedDirs.has(n.path)) {
      expandedDirs.add(n.path); render();
    }
  } else if (e.key === "ArrowLeft") {
    e.preventDefault();
    const n = visibleItems[focusedIndex];
    if (n && n.isDir && expandedDirs.has(n.path)) {
      expandedDirs.delete(n.path); render();
    }
  } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
    searchInput.focus();
  }
});

// Messages from extension
window.addEventListener("message", (event: MessageEvent) => {
  const msg = event.data;
  if (msg.type === "focusInput") {
    searchInput.focus();
  }
});
