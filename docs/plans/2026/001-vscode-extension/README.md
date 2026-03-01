# Loupe — VS Code Extension

Status: Completed

## Overview

A VS Code extension that lets you browse, search, and open files inside sub-repositories excluded by `.gitignore`.

## Background

The atelier workspace clones multiple sub-repositories and works with them side by side. Because the parent `.gitignore` excludes these sub-repositories, the following problems arise:

- `Ctrl+P` (Quick Open) does not include files from sub-repositories
- `Ctrl+Shift+F` (text search) does not find code in sub-repositories
- Setting `search.useIgnoreFiles: false` floods results with `node_modules` and other noise

An earlier prototype in `dev.local/git-repo-search/` used Quick Pick, but Quick Pick's built-in filter re-sorts items by match score, making hierarchical display impossible.

## Requirements

- Invocable via keyboard shortcut
- Detect sub-directories containing `.git` as repositories (including the workspace root)
- Display files in a collapsible tree structure
- Support AND search by file name and path (space-separated tokens)
- Open selected files in a new editor tab (`preview: false`)
- **Show untracked files in addition to tracked files**
- **Scan all workspace folders when multiple are open**

## Technical Approach

### Architecture

Two-stage flow: repository list in a WebviewView panel, then file tree display with integrated search.

```
Ctrl+G Ctrl+G → Repository list in WebviewView
  → File tree displayed in Explorer sidebar with auto-focus on search input
  → Type to filter with real-time AND search
  → Click a file → opens in a new tab (preview: false)
  → Title bar buttons for repository re-selection and refresh
```

### Why WebviewView

After evaluating all available UI patterns, WebviewView is the only one that satisfies every requirement:

- **Tree display** (expand/collapse, folder icons) → not possible with Quick Pick
- **Integrated real-time filtering** (search input and results in one panel) → TreeView requires a separate step for search input
- **Non-intrusive** → Webview Panel occupies an editor tab

See [adr.md](adr.md) for the full evaluation.

### File Listing

Both tracked and untracked (non-ignored) files are collected by running:

```bash
git ls-files
git ls-files --others --exclude-standard
```

The outputs are merged and deduplicated.

### Multi-Workspace Support

All entries in `vscode.workspace.workspaceFolders` are scanned. The repository list shows which workspace folder each repository belongs to via the `description` field.

### View Placement

Placed inside the Explorer sidebar. A file-finding tool fits naturally as an Explorer section, and the usage frequency does not warrant a dedicated Activity Bar icon.

### WebviewView Layout

```
┌─────────────────────────┐
│ 🔍 src component tsx    │  ← Search input
├─────────────────────────┤
│ ▾ 📁 src                │
│   ▾ 📁 components       │  ← Tree view (expandable/collapsible)
│     📄 Button.tsx       │
│     📄 Header.tsx       │
│   ▾ 📁 utils            │
│     📄 format.ts        │
└─────────────────────────┘
```

- Top: search input with debounced real-time AND filtering
- Bottom: file tree with expand/collapse and click-to-open
- Styled with VS Code theme variables (`--vscode-*`)

### Extension ↔ Webview Communication

- Extension → Webview: `webview.postMessage()` sends file tree data
- Webview → Extension: `vscode.postMessage()` sends file-open requests
- On repository selection, the extension fetches the file list and pushes it to the webview

## Project Structure

```
src/
├── extension.ts         (entry point: command registration, WebviewView setup)
├── git.ts               (findGitRepos, listGitFiles)
└── webview/
    ├── viewProvider.ts   (WebviewViewProvider implementation)
    ├── main.ts           (webview entry: initializes context, sets up events)
    ├── types.ts          (shared type definitions)
    ├── filter.ts         (AND search filter)
    ├── tree.ts           (tree building and flattening)
    ├── navigation.ts     (cursor movement helpers)
    ├── render.ts         (DOM rendering)
    ├── events.ts         (event handlers: search, click, keyboard, messages)
    └── style.css         (styles using VS Code theme variables)
```

## Phases

### Phase 1: Core Implementation

Restructure the prototype code and build the core WebviewView-based functionality.

- `src/git.ts`: extract `findGitRepos` and `listGitFiles`, add untracked file support
- `src/webview/viewProvider.ts`: WebviewViewProvider with HTML skeleton and message handling
- `src/webview/main.ts`: webview initialization and context setup
- `src/webview/*.ts`: modular tree building, filtering, rendering, navigation, and event handling
- `src/webview/style.css`: theming with VS Code CSS variables
- `src/extension.ts`: command registration, WebviewView registration, repository scanning
- `package.json`: views, commands, menus, keybindings configuration
- Estimate: 5 points

### Phase 2: Multi-Workspace Support and UX Improvements

- Scan all workspace folders and indicate repository ownership
- Welcome view when no repository is selected
- Auto-expand directories when filter results are small
- Keyboard navigation (arrow keys for tree traversal, Enter to open)
- Estimate: 3 points

### Dependencies

```
Phase 1: Core Implementation
 ↓
Phase 2: Multi-Workspace Support and UX Improvements
```

## Keybindings

| Key | Command | Description |
|-----|---------|-------------|
| `Ctrl+G Ctrl+G` / `Cmd+G Cmd+G` | `loupe.focus` | Focus the Loupe panel |

## Title Bar Actions

- `$(repo)` Select repository
- `$(refresh)` Refresh

## Estimate

Phase 1: 5 points + Phase 2: 3 points = **8 points total**
