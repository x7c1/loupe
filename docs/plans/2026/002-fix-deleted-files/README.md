# Fix Deleted Files Still Appearing in File List

Status: Completed

## Overview

Files deleted with `rm` or `git rm` still appear in loupe's file list. They should be excluded so the file tree reflects the actual working tree.

## Background

`listGitFiles` in `src/git.ts` uses `git ls-files` to collect tracked files. `git ls-files` reads from the git index, so files that have been deleted from the working tree (via `rm` or `git rm`) but whose removal has not yet been committed still appear in the output.

## Root Cause

`git ls-files` returns index entries regardless of whether the corresponding file exists on disk. Deleted files remain in the index until the deletion is committed.

## Fix

Run `git ls-files --deleted` as a third parallel command alongside the existing tracked and untracked queries. This produces a list of files that are tracked but missing from the working tree. Build a `Set` from that output and filter it out of the tracked file set.

### File to Modify

- `src/git.ts` — `listGitFiles` function (lines 51–83)

### Change Summary

1. Add `git ls-files --deleted` to the existing `Promise.all`
2. Parse its output into a `deletedSet: Set<string>`
3. When iterating tracked files, skip any entry present in `deletedSet`

## Verification

- `npm run compile` — TypeScript compiles without errors
- Manual: `rm` a tracked file → loupe should not list it
- Manual: `git rm` a tracked file → loupe should not list it
- Manual: add an untracked file → loupe should still list it

## Estimate

1 point
