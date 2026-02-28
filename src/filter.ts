/**
 * AND search filter for file paths.
 * Space-separated tokens must all match somewhere in the path.
 * Each token match is consumed to prevent duplicate matching.
 */
export function matchesFilter(filePath: string, query: string): boolean {
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);
  if (tokens.length === 0) {
    return true;
  }
  let haystack = filePath.toLowerCase();
  for (const token of tokens) {
    const idx = haystack.indexOf(token);
    if (idx === -1) {
      return false;
    }
    // Consume the matched portion to prevent overlapping matches
    haystack = haystack.slice(0, idx) + haystack.slice(idx + token.length);
  }
  return true;
}

/**
 * Filter a list of file paths using AND search.
 */
export function filterFiles(files: string[], query: string): string[] {
  return files.filter((f) => matchesFilter(f, query));
}
