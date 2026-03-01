import * as vscode from "vscode";
import * as path from "path";
import { findGitRepos, listGitFiles } from "./git";
import { FileTreeViewProvider } from "./webview/viewProvider";

export function activate(context: vscode.ExtensionContext) {
  const provider = new FileTreeViewProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      FileTreeViewProvider.viewType,
      provider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  // Ctrl+G Ctrl+G: focus the webview (scan repos if first time)
  context.subscriptions.push(
    vscode.commands.registerCommand("loupe.focus", async () => {
      // Ensure the view is visible and focused
      await vscode.commands.executeCommand(
        "loupe.fileTreeView.focus"
      );

      if (!provider.hasRepos()) {
        const repos = await scanRepos();
        provider.storeRepos(repos);
      }

      const matched = findRepoForActiveEditor(provider.getRepos());
      if (matched) {
        // Switch repo if different from current selection
        const current = provider.hasSelectedRepo()
          ? provider.getSelectedRepo()
          : null;
        if (!current || current.repoPath !== matched.path) {
          const activePath = vscode.window.activeTextEditor?.document.uri.fsPath;
          const activeFile = activePath
            ? path.relative(matched.path, activePath)
            : undefined;
          const { files, subRepos } = await loadFilesAndSubRepos(matched.path, matched.label);
          provider.setFiles(matched.path, matched.label, files, { activeFile, subRepos });
        }
      } else if (!provider.hasSelectedRepo()) {
        // No active file match and no repo selected - show repo list
        provider.showRepoList();
      }

      provider.focusInput();
    })
  );

  // Title bar button: re-scan and show repo list
  context.subscriptions.push(
    vscode.commands.registerCommand("loupe.selectRepo", async () => {
      await vscode.commands.executeCommand(
        "loupe.fileTreeView.focus"
      );
      await scanAndSendRepos(provider);
      provider.focusInput();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("loupe.refresh", async () => {
      if (provider.hasSelectedRepo()) {
        // Reload files for current repo
        const { repoPath, repoName } = provider.getSelectedRepo();
        const { files, subRepos } = await loadFilesAndSubRepos(repoPath, repoName);
        provider.setFiles(repoPath, repoName, files, { subRepos });
      } else {
        await scanAndSendRepos(provider);
      }
      provider.focusInput();
    })
  );

  // Handle repo selection from webview
  provider.onRepoSelected(async (repoPath: string, repoName: string) => {
    const { files, subRepos } = await loadFilesAndSubRepos(repoPath, repoName);
    provider.setFiles(repoPath, repoName, files, { subRepos });
  });
}

async function scanAndSendRepos(
  provider: FileTreeViewProvider
): Promise<void> {
  const repos = await scanRepos();
  provider.setRepos(repos);
}

async function scanRepos(): Promise<
  { path: string; label: string; description: string }[]
> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showWarningMessage("No workspace folder is open.");
    return [];
  }

  const config = vscode.workspace.getConfiguration("loupe");
  const maxDepth = config.get<number>("maxDepth", 5);
  const multiWorkspace = workspaceFolders.length > 1;

  const repos: { path: string; label: string; description: string }[] = [];

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Loupe: Scanning...",
      cancellable: false,
    },
    async () => {
      const scanPromises = workspaceFolders.map(async (folder) => {
        const found = await findGitRepos(folder.uri.fsPath, maxDepth);
        for (const repo of found) {
          const relPath = path.relative(folder.uri.fsPath, repo);
          repos.push({
            path: repo,
            label: relPath === "" ? path.basename(repo) : relPath,
            description: multiWorkspace ? folder.name : "",
          });
        }
      });
      await Promise.all(scanPromises);
    }
  );

  repos.sort((a, b) => a.label.localeCompare(b.label));
  return repos;
}

function findRepoForActiveEditor(
  repos: { path: string; label: string }[]
): { path: string; label: string } | undefined {
  const activePath = vscode.window.activeTextEditor?.document.uri.fsPath;
  if (!activePath) {
    return undefined;
  }

  // Pick the most specific match (longest repo path) for nested repos
  let best: { path: string; label: string } | undefined;
  let bestLen = 0;

  for (const repo of repos) {
    if (
      activePath.startsWith(repo.path + "/") &&
      repo.path.length > bestLen
    ) {
      best = { path: repo.path, label: repo.label };
      bestLen = repo.path.length;
    }
  }
  return best;
}

async function loadFilesAndSubRepos(
  repoPath: string,
  repoName: string
): Promise<{ files: string[]; subRepos: string[] }> {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Loupe: Loading ${repoName}...`,
      cancellable: false,
    },
    async () => {
      const config = vscode.workspace.getConfiguration("loupe");
      const maxDepth = config.get<number>("maxDepth", 5);
      const [files, childRepos] = await Promise.all([
        listGitFiles(repoPath),
        findGitRepos(repoPath, maxDepth),
      ]);
      // Exclude the repo itself, keep only nested sub-repos
      const subRepos = childRepos
        .filter((r) => r !== repoPath)
        .map((r) => path.relative(repoPath, r));
      return { files, subRepos };
    }
  );
}

export function deactivate() {}
