import * as vscode from "vscode";
import type { RepoItem } from "./types";

type WebviewMessage =
  | { type: "openFile"; path: string }
  | { type: "selectRepo"; path: string; label: string }
  | { type: "selectSubRepo"; path: string }
  | { type: "goBack" };

export class FileTreeViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "loupe.fileTreeView";

  private view?: vscode.WebviewView;
  private repos: RepoItem[] = [];
  private files: string[] = [];
  private subRepos: string[] = [];
  private activeFile: string = "";
  private repoPath: string = "";
  private repoName: string = "";
  private navStack: { repoPath: string; repoName: string; subRepoPath: string }[] = [];
  private repoSelectedCallback?: (
    repoPath: string,
    repoName: string
  ) => void;
  private goBackCallback?: (
    repoPath: string,
    repoName: string,
    focusPath: string
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
      } else if (message.type === "selectSubRepo" && this.repoPath) {
        this.navStack.push({
          repoPath: this.repoPath,
          repoName: this.repoName,
          subRepoPath: message.path,
        });
        const absPath = this.repoPath + "/" + message.path;
        this.repoSelectedCallback?.(absPath, message.path);
      } else if (message.type === "goBack") {
        if (this.navStack.length > 0) {
          const parent = this.navStack.pop()!;
          this.goBackCallback?.(parent.repoPath, parent.repoName, parent.subRepoPath);
        } else {
          this.showRepoList();
        }
      }
    });

    this.renderHtml();
  }

  public onRepoSelected(
    callback: (repoPath: string, repoName: string) => void
  ): void {
    this.repoSelectedCallback = callback;
  }

  public onGoBack(
    callback: (repoPath: string, repoName: string, focusPath: string) => void
  ): void {
    this.goBackCallback = callback;
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

  public getRepos(): RepoItem[] {
    return this.repos;
  }

  // Store repos without rendering (used when auto-selecting a repo)
  public storeRepos(repos: RepoItem[]): void {
    this.repos = repos;
  }

  public setRepos(repos: RepoItem[]): void {
    this.repos = repos;
    this.repoPath = "";
    this.repoName = "";
    this.files = [];
    this.renderHtml();
  }

  public setFiles(
    repoPath: string,
    repoName: string,
    files: string[],
    opts?: { activeFile?: string; subRepos?: string[] }
  ): void {
    this.repoPath = repoPath;
    this.repoName = repoName;
    this.files = files;
    this.subRepos = opts?.subRepos ?? [];
    this.activeFile = opts?.activeFile ?? "";
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

  private shortRepoName(): string {
    const parts = this.repoName.split("/");
    return parts.length > 2 ? parts.slice(-2).join("/") : this.repoName;
  }

  private renderHtml(): void {
    if (!this.view) {
      return;
    }
    this.view.webview.html = this.getHtmlContent(this.view.webview);
  }

  private getHtmlContent(webview: vscode.Webview): string {
    const nonce = getNonce();
    const mode = this.repoPath ? "files" : "repos";

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
  </div>${this.repoName ? `\n  <div class="repo-header">${this.shortRepoName()}</div>` : ""}
  <div class="list-container" id="listContainer"></div>
  <script nonce="${nonce}">
    window.__LOUPE__ = {
      mode: ${JSON.stringify(mode)},
      repos: ${JSON.stringify(this.repos)},
      files: ${JSON.stringify(this.files)},
      subRepos: ${JSON.stringify(this.subRepos)},
      repoName: ${JSON.stringify(this.repoName)},
      activeFile: ${JSON.stringify(this.activeFile)}
    };
  </script>
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
