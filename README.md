# Loupe

A VS Code extension to find and open files in gitignored sub-repositories.

## Problem

When a workspace contains cloned sub-repositories excluded by the parent `.gitignore`, VS Code's built-in file search (`Ctrl+P`) skips those files. Setting `search.useIgnoreFiles: false` floods results with `node_modules` and other noise.

Loupe provides file search for these sub-repositories by scanning for `.git` directories and listing their tracked and untracked files in a searchable tree view.

## Features

- Scans workspace for sub-repositories (directories containing `.git`, including submodules)
- Displays files in a tree view with folder expand/collapse
- Compact folder display — single-child directory chains are merged (e.g., `src/main/scala`)
- Space-separated AND search for filtering by file name and path
- Opens selected files in a new editor tab
- Keyboard-driven workflow
- Auto-selects repository based on the currently active editor file
- Shows sub-repositories in the file tree with navigation support
- Hierarchical back-navigation through nested sub-repositories

## Demo

<video src="https://github.com/user-attachments/assets/9244ba1c-f72e-445f-bc18-b6988ad12da4" controls></video>

## Usage

1. Press `Ctrl+G Ctrl+G` (`Cmd+G Cmd+G` on macOS) to open Loupe
2. If a file is open in the editor, its repository is auto-selected
3. Otherwise, select a repository from the list
4. Type to filter files (space-separated tokens for AND matching)
5. Press `Enter` to open a file, or navigate into a sub-repository (📦)
6. Press `Esc` to clear the search, go back to the parent repository, or return to the repository list

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
