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
    const args = [
      rootDir,
      `-maxdepth ${maxDepth + 1}`,
      "( -name node_modules -o -name target -o -name .gradle -o -name .cache ) -prune",
      "-o -name .git ( -type d -o -type f ) -print",
    ].flatMap(s => s.split(" "));

    const { stdout } = await execFileAsync("find", args, {
      maxBuffer: 10 * 1024 * 1024,
    });
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

  const [tracked, untracked, deleted] = await Promise.all([
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
    execFileAsync("git", ["ls-files", "--deleted"], execOpts).then(
      ({ stdout }) => stdout,
      () => ""
    ),
  ]);

  const deletedSet = new Set<string>();
  for (const line of deleted.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      deletedSet.add(trimmed);
    }
  }

  const files = new Set<string>();
  for (const line of tracked.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length > 0 && !deletedSet.has(trimmed)) {
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
