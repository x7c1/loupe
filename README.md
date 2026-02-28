# Loupe

A VS Code extension to find and open files in gitignored sub-repositories.

## Problem

When a workspace contains cloned sub-repositories excluded by the parent `.gitignore`, VS Code's built-in file search (`Ctrl+P`) skips those files. Setting `search.useIgnoreFiles: false` floods results with `node_modules` and other noise.

Loupe provides file search for these sub-repositories by scanning for `.git` directories and listing their tracked and untracked files in a searchable tree view.

## Features

- Scans workspace for sub-repositories (directories containing `.git`)
- Displays files in a tree view with folder expand/collapse
- Space-separated AND search for filtering by file name and path
- Opens selected files in a new editor tab
- Keyboard-driven workflow

## Usage

1. Press `Ctrl+G Ctrl+G` (`Cmd+G Cmd+G` on macOS) to open Loupe
2. Select a repository from the list
3. Type to filter files (space-separated tokens for AND matching)
4. Press `Enter` to open the selected file
5. Press `Esc` to clear the search, or go back to the repository list

## Commands

| Command | Keybinding | Description |
|---|---|---|
| Loupe: Focus | `Ctrl+G Ctrl+G` | Open and focus the Loupe panel |
| Loupe: Select Repository | — | Re-scan and show repository list |
| Loupe: Refresh | — | Reload files for the current repository |

## Configuration

| Setting | Default | Description |
|---|---|---|
| `loupe.maxDepth` | `5` | Maximum directory depth to scan for sub-repositories |

## Installation

Build from source:

```bash
npm install
npm run compile
npm run package
code --install-extension loupe-*.vsix
```
