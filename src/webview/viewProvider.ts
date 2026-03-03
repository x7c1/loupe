import * as vscode from "vscode";
import type { RepoItem, WebviewState } from "./types";

interface TabState {
  repoPath: string;
  repoName: string;
  files: string[];
  subRepos: string[];
  expandedDirs: string[];
  manuallyCollapsed: string[];
  searchQuery: string;
  focusedIndex: number;
  lastAccessed: number;
}

type WebviewMessage =
  | { type: "openFile"; path: string }
  | { type: "selectRepo"; path: string; label: string }
  | { type: "selectSubRepo"; path: string; currentState: WebviewState }
  | { type: "goBack"; currentState: WebviewState }
  | { type: "switchTab"; repoPath: string; currentState: WebviewState }
  | { type: "closeTab"; repoPath: string }
  | { type: "reportState"; state: WebviewState }
  | { type: "ready" };

export class FileTreeViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "loupe.fileTreeView";

  private view?: vscode.WebviewView;
  private repos: RepoItem[] = [];
  private tabs: TabState[] = [];
  private activeTabIndex: number = -1;
  private get maxTabs(): number {
    return vscode.workspace.getConfiguration("loupe").get<number>("maxTabs", 10);
  }
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
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtmlContent(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((message: WebviewMessage) => {
      if (message.type === "ready") {
        this.sendCurrentState();
      } else if (message.type === "openFile") {
        if (this.activeTabIndex < 0) return;
        const tab = this.tabs[this.activeTabIndex];
        const absPath = vscode.Uri.joinPath(
          vscode.Uri.file(tab.repoPath),
          message.path
        );
        vscode.workspace.openTextDocument(absPath).then((doc) => {
          vscode.window.showTextDocument(doc, { preview: false });
        });
      } else if (message.type === "selectRepo") {
        this.repoSelectedCallback?.(message.path, message.label);
      } else if (message.type === "selectSubRepo") {
        if (this.activeTabIndex < 0) return;
        this.saveTabState(message.currentState);
        const tab = this.tabs[this.activeTabIndex];
        const absPath = tab.repoPath + "/" + message.path;
        this.repoSelectedCallback?.(absPath, message.path);
      } else if (message.type === "goBack") {
        this.saveTabState(message.currentState);
        this.showRepoList();
      } else if (message.type === "switchTab") {
        this.saveTabState(message.currentState);
        this.switchToTab(message.repoPath);
      } else if (message.type === "closeTab") {
        this.closeTab(message.repoPath);
      } else if (message.type === "reportState") {
        this.saveTabState(message.state);
      }
    });
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
    return this.activeTabIndex >= 0;
  }

  public getSelectedRepo(): { repoPath: string; repoName: string } {
    const tab = this.tabs[this.activeTabIndex];
    return { repoPath: tab.repoPath, repoName: tab.repoName };
  }

  public getRepos(): RepoItem[] {
    return this.repos;
  }

  // Store repos without notifying (used when auto-selecting a repo)
  public storeRepos(repos: RepoItem[]): void {
    this.repos = repos;
  }

  public setRepos(repos: RepoItem[]): void {
    this.repos = repos;
    this.activeTabIndex = -1;
    this.view?.webview.postMessage({ type: "setRepos", repos });
    this.sendTabsUpdate();
  }

  // Opens a new tab or switches to an existing one
  public setFiles(
    repoPath: string,
    repoName: string,
    files: string[],
    opts?: { activeFile?: string; subRepos?: string[] }
  ): void {
    const subRepos = opts?.subRepos ?? [];
    const activeFile = opts?.activeFile ?? "";

    const existingIndex = this.tabs.findIndex(t => t.repoPath === repoPath);
    if (existingIndex >= 0) {
      // Switch to existing tab
      const tab = this.tabs[existingIndex];
      tab.lastAccessed = Date.now();
      tab.files = files;
      tab.subRepos = subRepos;
      this.activeTabIndex = existingIndex;
      this.view?.webview.postMessage({
        type: "setFiles",
        files: tab.files,
        subRepos: tab.subRepos,
        repoName: tab.repoName,
        activeFile: "",
        savedState: {
          expandedDirs: tab.expandedDirs,
          manuallyCollapsed: tab.manuallyCollapsed,
          searchQuery: tab.searchQuery,
          focusedIndex: tab.focusedIndex,
        },
      });
    } else {
      // Create new tab
      this.evictIfNeeded();
      const tab: TabState = {
        repoPath,
        repoName,
        files,
        subRepos,
        expandedDirs: [],
        manuallyCollapsed: [],
        searchQuery: "",
        focusedIndex: -1,
        lastAccessed: Date.now(),
      };
      this.tabs.push(tab);
      this.activeTabIndex = this.tabs.length - 1;
      this.view?.webview.postMessage({
        type: "setFiles",
        files,
        subRepos,
        repoName,
        activeFile,
      });
    }
    this.sendTabsUpdate();
  }

  public showRepoList(): void {
    this.activeTabIndex = -1;
    this.view?.webview.postMessage({ type: "showRepoList", repos: this.repos });
    this.sendTabsUpdate();
  }

  public focusInput(): void {
    this.view?.webview.postMessage({ type: "focusInput" });
  }

  public focusActiveFile(activeFile?: string): void {
    if (!activeFile) return;
    this.view?.webview.postMessage({ type: "focusFile", activeFile });
  }

  private switchToTab(repoPath: string): void {
    const index = this.tabs.findIndex(t => t.repoPath === repoPath);
    if (index < 0) return;
    this.activeTabIndex = index;
    const tab = this.tabs[index];
    tab.lastAccessed = Date.now();
    this.view?.webview.postMessage({
      type: "setFiles",
      files: tab.files,
      subRepos: tab.subRepos,
      repoName: tab.repoName,
      activeFile: "",
      savedState: {
        expandedDirs: tab.expandedDirs,
        manuallyCollapsed: tab.manuallyCollapsed,
        searchQuery: tab.searchQuery,
        focusedIndex: tab.focusedIndex,
      },
    });
    this.sendTabsUpdate();
  }

  private closeTab(repoPath: string): void {
    const index = this.tabs.findIndex(t => t.repoPath === repoPath);
    if (index < 0) return;

    this.tabs.splice(index, 1);

    if (this.tabs.length === 0) {
      this.activeTabIndex = -1;
      this.view?.webview.postMessage({ type: "showRepoList" });
    } else if (this.activeTabIndex === index) {
      // Active tab was closed, switch to nearest
      this.activeTabIndex = Math.min(index, this.tabs.length - 1);
      const tab = this.tabs[this.activeTabIndex];
      tab.lastAccessed = Date.now();
      this.view?.webview.postMessage({
        type: "setFiles",
        files: tab.files,
        subRepos: tab.subRepos,
        repoName: tab.repoName,
        activeFile: "",
        savedState: {
          expandedDirs: tab.expandedDirs,
          manuallyCollapsed: tab.manuallyCollapsed,
          searchQuery: tab.searchQuery,
          focusedIndex: tab.focusedIndex,
        },
      });
    } else if (this.activeTabIndex > index) {
      this.activeTabIndex--;
    }
    this.sendTabsUpdate();
  }

  private saveTabState(state: WebviewState): void {
    if (this.activeTabIndex < 0 || this.activeTabIndex >= this.tabs.length) return;
    const tab = this.tabs[this.activeTabIndex];
    tab.expandedDirs = state.expandedDirs;
    tab.manuallyCollapsed = state.manuallyCollapsed;
    tab.searchQuery = state.searchQuery;
    tab.focusedIndex = state.focusedIndex;
  }

  private evictIfNeeded(): void {
    while (this.tabs.length >= this.maxTabs) {
      let lruIndex = -1;
      let lruTime = Infinity;
      for (let i = 0; i < this.tabs.length; i++) {
        if (i !== this.activeTabIndex && this.tabs[i].lastAccessed < lruTime) {
          lruTime = this.tabs[i].lastAccessed;
          lruIndex = i;
        }
      }
      if (lruIndex >= 0) {
        this.tabs.splice(lruIndex, 1);
        if (this.activeTabIndex > lruIndex) {
          this.activeTabIndex--;
        }
      } else {
        break;
      }
    }
  }

  private sendTabsUpdate(): void {
    this.view?.webview.postMessage({
      type: "updateTabs",
      tabs: this.tabs.map(t => ({ repoPath: t.repoPath, repoName: t.repoName })),
      activeIndex: this.activeTabIndex,
    });
  }

  private sendCurrentState(): void {
    this.sendTabsUpdate();
    if (this.activeTabIndex >= 0) {
      const tab = this.tabs[this.activeTabIndex];
      this.view?.webview.postMessage({
        type: "setFiles",
        files: tab.files,
        subRepos: tab.subRepos,
        repoName: tab.repoName,
        activeFile: "",
        savedState: {
          expandedDirs: tab.expandedDirs,
          manuallyCollapsed: tab.manuallyCollapsed,
          searchQuery: tab.searchQuery,
          focusedIndex: tab.focusedIndex,
        },
      });
    } else if (this.repos.length > 0) {
      this.view?.webview.postMessage({
        type: "setRepos",
        repos: this.repos,
      });
    }
  }

  private getHtmlContent(webview: vscode.Webview): string {
    const nonce = getNonce();

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "out", "webview", "main.js")
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "out", "webview", "style.css")
    );
    const cspSource = webview.cspSource;

    return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${cspSource}; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${styleUri}">
</head>
<body>
  <div class="search-container">
    <input type="text" class="search-input" id="searchInput" autofocus />
  </div>
  <div class="tab-bar" id="tabBar"></div>
  <div class="list-container" id="listContainer"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
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
