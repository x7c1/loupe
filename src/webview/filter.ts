import { RepoItem } from "./types";

export function filterRepos(repos: RepoItem[], query: string): RepoItem[] {
  const tokens = parseTokens(query);
  if (tokens.length === 0) return repos;
  return repos.filter(r =>
    matchesTokens((r.label + " " + r.description).toLowerCase(), tokens)
  );
}

export function filterFiles(files: string[], query: string): string[] {
  const tokens = parseTokens(query);
  if (tokens.length === 0) return files;
  return files.filter(f => matchesTokens(f.toLowerCase(), tokens));
}

export function filterSubRepos(subRepos: string[], query: string): string[] {
  const tokens = parseTokens(query);
  if (tokens.length === 0) return subRepos;
  return subRepos.filter(r => matchesTokens(r.toLowerCase(), tokens));
}

/**
 * AND search filter.
 * Space-separated tokens must all match somewhere in the haystack.
 * Each token match is consumed to prevent overlapping matches.
 */
function matchesTokens(haystack: string, tokens: string[]): boolean {
  let h = haystack;
  for (const t of tokens) {
    const idx = h.indexOf(t);
    if (idx === -1) return false;
    h = h.slice(0, idx) + h.slice(idx + t.length);
  }
  return true;
}

function parseTokens(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
}
