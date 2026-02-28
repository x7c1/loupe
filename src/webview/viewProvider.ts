import * as vscode from "vscode";

interface RepoEntry {
  path: string;
  label: string;
  description: string;
}

type WebviewMessage =
  | { type: "openFile"; path: string }
  | { type: "selectRepo"; path: string; label: string }
  | { type: "goBack" };

export class FileTreeViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "loupe.fileTreeView";

  private view?: vscode.WebviewView;
  private repos: RepoEntry[] = [];
  private files: string[] = [];
  private repoPath: string = "";
  private repoName: string = "";
  private repoSelectedCallback?: (
    repoPath: string,
    repoName: string
  ) => void;

  constructor(private readonly extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.onDidReceiveMessage((message: WebviewMessage) => {
      if (message.type === "openFile" && this.repoPath) {
        const absPath = vscode.Uri.joinPath(
          vscode.Uri.file(this.repoPath),
          message.path
        );
        vscode.workspace.openTextDocument(absPath).then((doc) => {
          vscode.window.showTextDocument(doc, { preview: false });
        });
      } else if (message.type === "selectRepo") {
        this.repoSelectedCallback?.(message.path, message.label);
      } else if (message.type === "goBack") {
        this.showRepoList();
      }
    });

    this.renderHtml();
  }

  public onRepoSelected(
    callback: (repoPath: string, repoName: string) => void
  ): void {
    this.repoSelectedCallback = callback;
  }

  public hasRepos(): boolean {
    return this.repos.length > 0;
  }

  public hasSelectedRepo(): boolean {
    return this.repoPath !== "";
  }

  public getSelectedRepo(): { repoPath: string; repoName: string } {
    return { repoPath: this.repoPath, repoName: this.repoName };
  }

  public setRepos(repos: RepoEntry[]): void {
    this.repos = repos;
    this.repoPath = "";
    this.repoName = "";
    this.files = [];
    this.renderHtml();
  }

  public setFiles(
    repoPath: string,
    repoName: string,
    files: string[]
  ): void {
    this.repoPath = repoPath;
    this.repoName = repoName;
    this.files = files;
    this.renderHtml();
  }

  public showRepoList(): void {
    this.repoPath = "";
    this.repoName = "";
    this.files = [];
    this.renderHtml();
  }

  public focusInput(): void {
    this.view?.webview.postMessage({ type: "focusInput" });
  }

  private renderHtml(): void {
    if (!this.view) {
      return;
    }
    this.view.webview.html = this.getHtmlContent();
  }

  private getHtmlContent(): string {
    const nonce = getNonce();
    const mode = this.repoPath ? "files" : "repos";

    return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style nonce="${nonce}">
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      height: 100vh;
    }
    .search-container {
      padding: 4px 8px;
      border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border, var(--vscode-widget-border, transparent));
      flex-shrink: 0;
    }
    .search-input {
      width: 100%;
      padding: 4px 6px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: 2px;
      outline: none;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }
    .search-input:focus {
      border-color: var(--vscode-focusBorder);
    }
    .search-input::placeholder {
      color: var(--vscode-input-placeholderForeground);
    }
    .list-container {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
    }
    .list-item {
      display: flex;
      align-items: center;
      padding: 2px 8px;
      cursor: pointer;
      white-space: nowrap;
      line-height: 22px;
      height: 22px;
    }
    .list-item:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .list-item.focused {
      background: var(--vscode-list-focusBackground, var(--vscode-list-activeSelectionBackground, #04395e));
      color: var(--vscode-list-focusForeground, var(--vscode-list-activeSelectionForeground, #fff));
      outline: 1px solid var(--vscode-focusBorder, #007fd4);
    }
    .list-item .icon {
      width: 16px;
      flex-shrink: 0;
      margin-right: 6px;
      text-align: center;
    }
    .list-item .label {
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .list-item .desc {
      margin-left: 8px;
      color: var(--vscode-descriptionForeground);
      font-size: 0.9em;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .tree-item {
      display: flex;
      align-items: center;
      padding: 2px 0;
      padding-right: 8px;
      cursor: pointer;
      white-space: nowrap;
      line-height: 22px;
      height: 22px;
    }
    .tree-item:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .tree-item.focused {
      background: var(--vscode-list-focusBackground, var(--vscode-list-activeSelectionBackground, #04395e));
      color: var(--vscode-list-focusForeground, var(--vscode-list-activeSelectionForeground, #fff));
      outline: 1px solid var(--vscode-focusBorder, #007fd4);
    }
    .tree-item .toggle {
      width: 16px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 10px;
      color: var(--vscode-foreground);
      user-select: none;
    }
    .tree-item .toggle.collapsed::before { content: "▶"; }
    .tree-item .toggle.expanded::before { content: "▼"; }
    .tree-item .toggle.leaf { visibility: hidden; }
    .tree-item .icon {
      width: 16px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-right: 4px;
      font-size: 14px;
    }
    .tree-item .label {
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .no-items {
      padding: 16px;
      text-align: center;
      color: var(--vscode-descriptionForeground);
    }
${Array.from({ length: 21 }, (_, i) => `    .depth-${i} { padding-left: ${8 + i * 16}px; }`).join("\n")}
  </style>
</head>
<body>
  <div class="search-container">
    <input
      type="text"
      class="search-input"
      id="searchInput"
      autofocus
    />
  </div>
  <div class="list-container" id="listContainer"></div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const searchInput = document.getElementById("searchInput");
    const listContainer = document.getElementById("listContainer");

    const MODE = "${mode}";
    const REPOS = ${JSON.stringify(this.repos)};
    const ALL_FILES = ${JSON.stringify(this.files)};
    const REPO_NAME = ${JSON.stringify(this.repoName)};

    let focusedIndex = -1;
    let visibleItems = [];
    let expandedDirs = new Set();

    if (MODE === "repos") {
      searchInput.placeholder = "Search repositories (" + REPOS.length + ")";
      renderRepos();
    } else {
      searchInput.placeholder = "Search files in " + REPO_NAME + " (" + ALL_FILES.length + " files)";
      renderFiles();
    }

    requestAnimationFrame(() => searchInput.focus());

    // --- Repo list mode ---

    function filterRepos(query) {
      const tokens = query.toLowerCase().split(/\\s+/).filter(t => t.length > 0);
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

    function renderRepos() {
      const query = searchInput.value.trim();
      const filtered = filterRepos(query);
      visibleItems = filtered.map(r => ({ type: "repo", ...r }));

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
          + '<span class="label">' + esc(item.label) + '</span>'
          + desc + '</div>';
      }).join("");
    }

    // --- File tree mode ---

    function filterFiles(query) {
      const tokens = query.toLowerCase().split(/\\s+/).filter(t => t.length > 0);
      if (tokens.length === 0) return ALL_FILES;
      return ALL_FILES.filter(f => {
        let h = f.toLowerCase();
        for (const t of tokens) {
          const idx = h.indexOf(t);
          if (idx === -1) return false;
          h = h.slice(0, idx) + h.slice(idx + t.length);
        }
        return true;
      });
    }

    function buildTree(files) {
      const root = { children: new Map(), isDir: true, name: "", path: "" };
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
          cur = cur.children.get(p);
        }
      }
      return root;
    }

    function flattenTree(node, depth, result, autoExpand) {
      const sorted = Array.from(node.children.values()).sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      for (const child of sorted) {
        const isExp = autoExpand || expandedDirs.has(child.path);
        result.push({ ...child, depth, isExpanded: isExp, type: "file" });
        if (child.isDir && (isExp || autoExpand)) {
          if (!autoExpand) expandedDirs.add(child.path);
          flattenTree(child, depth + 1, result, autoExpand);
        }
      }
      return result;
    }

    function firstFileIndex() {
      for (let i = 0; i < visibleItems.length; i++) {
        if (!visibleItems[i].isDir) return i;
      }
      return -1;
    }

    function nextFileIndex(current) {
      for (let i = current + 1; i < visibleItems.length; i++) {
        if (!visibleItems[i].isDir) return i;
      }
      return current;
    }

    function prevFileIndex(current) {
      for (let i = current - 1; i >= 0; i--) {
        if (!visibleItems[i].isDir) return i;
      }
      return -1;
    }

    function renderFiles() {
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

    function render() {
      if (MODE === "repos") renderRepos();
      else renderFiles();
    }

    // --- Shared logic ---

    function esc(t) {
      return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    function scrollToFocused() {
      const el = listContainer.querySelector(".focused");
      if (el) el.scrollIntoView({ block: "nearest" });
    }

    function acceptFocused() {
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
    let debounceTimer;
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
    listContainer.addEventListener("click", (e) => {
      const el = e.target.closest("[data-index]");
      if (!el) return;
      focusedIndex = parseInt(el.dataset.index, 10);
      acceptFocused();
    });

    // Keyboard
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (searchInput.value.length > 0) {
          // Step 1: clear search text
          searchInput.value = "";
          focusedIndex = -1;
          expandedDirs.clear();
          render();
        } else if (MODE === "files") {
          // Step 2: go back to repo list
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
    listContainer.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        searchInput.focus();
        // Let the searchInput Escape handler deal with it on next press
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
    window.addEventListener("message", (event) => {
      const msg = event.data;
      if (msg.type === "focusInput") {
        searchInput.focus();
      }
    });
  </script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
