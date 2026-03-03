# Loupe

A VS Code extension to find and open files in gitignored sub-repositories.

## Problem

When a workspace contains cloned sub-repositories excluded by the parent `.gitignore`, VS Code's built-in file search (`Ctrl+P`) skips those files. Setting `search.useIgnoreFiles: false` floods results with `node_modules` and other noise.

Loupe provides file search for these sub-repositories by scanning for `.git` directories and listing their tracked and untracked files in a searchable tree view.

## Features

- Scans workspace for sub-repositories (directories containing `.git`, including submodules)
- Tree view with compact folder merging (e.g., `src/main/scala`) and space-separated AND search
- Tabs — keep multiple repositories open and switch with `Tab`/`Shift+Tab`
- Keyboard-driven: navigate, search, and switch repos without touching the mouse
- Sub-repository navigation support (📦 markers in the file tree)

## Demo

<video src="https://github.com/user-attachments/assets/7e305e5a-5b5d-42ab-af37-02fa815d2038" controls></video>

## Usage

1. Press `Ctrl+G Ctrl+G` (`Cmd+G Cmd+G` on macOS) to open Loupe
2. If a file is open in the editor, its repository is auto-selected and the file is focused
3. Otherwise, select a repository from the list
4. Type to filter files (space-separated tokens for AND matching)
5. Press `Enter` to open a file, or navigate into a sub-repository (📦)
6. Use `Tab`/`Shift+Tab` to switch between open repository tabs
7. Press `Esc` to step back through search terms, or `Ctrl+Esc` to return to the repository list

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
| `loupe.maxTabs` | `10` | Maximum number of open repository tabs (LRU eviction) |

## Installation

Build from source:

```bash
npm install
npm run compile
npm run package
code --install-extension loupe-*.vsix
```
