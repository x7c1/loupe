import * as path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/**
 * Find directories that contain a .git entry (directory or file).
 * Regular repos have a .git directory; submodules have a .git file.
 */
export async function findGitRepos(
  rootDir: string,
  maxDepth: number = 5
): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync(
      "find",
      [
        rootDir,
        "-maxdepth",
        String(maxDepth + 1),
        "-name",
        ".git",
        "(",
        "-type",
        "d",
        "-o",
        "-type",
        "f",
        ")",
        "-not",
        "-path",
        "*/node_modules/*",
      ],
      { maxBuffer: 10 * 1024 * 1024 }
    );
    return stdout
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .map((gitDir) => path.dirname(gitDir));
  } catch {
    return [];
  }
}

/**
 * List files in a git repository.
 * Includes both tracked and untracked (but not ignored) files.
 */
export async function listGitFiles(repoDir: string): Promise<string[]> {
  const execOpts = { cwd: repoDir, maxBuffer: 10 * 1024 * 1024 };

  const [tracked, untracked] = await Promise.all([
    execFileAsync("git", ["ls-files"], execOpts).then(
      ({ stdout }) => stdout,
      () => ""
    ),
    execFileAsync(
      "git",
      ["ls-files", "--others", "--exclude-standard"],
      execOpts
    ).then(
      ({ stdout }) => stdout,
      () => ""
    ),
  ]);

  const files = new Set<string>();
  for (const line of tracked.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      files.add(trimmed);
    }
  }
  for (const line of untracked.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      files.add(trimmed);
    }
  }
  return Array.from(files).sort();
}
