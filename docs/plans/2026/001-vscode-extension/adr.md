# ADR: UI Pattern for Hierarchical File Display

## Status

Accepted

## Context

Loupe needs to display files from gitignored sub-repositories in a hierarchical tree, with real-time search and filtering. The VS Code extension API offers several UI patterns, each with different trade-offs for combining tree display with search.

## Options Considered

### Option A: Quick Pick + Separator

The approach used in the earlier prototype. Directory names are shown as separators using `QuickPickItemKind.Separator`.

- Pros: Simple to implement, AND search integrates naturally, keyboard-first UX
- Cons: Separators cannot display folder icons (poor visual clarity), no expand/collapse

### Option B: Quick Pick + Regular Items as Folder Rows

Folder rows are rendered as regular Quick Pick items with `$(folder)` codicon icons.

- Pros: Folder icons are visible
- Cons: The built-in filter re-sorts items by match score, causing folder rows to sink below their contents during filtering (deal-breaker)

### Option C: Quick Pick with Value Reset to Bypass Filter

Disables the built-in filter by setting `qp.value = ""` inside `onDidChangeValue`.

- Pros: Full control over filtering logic
- Cons: `onDidChangeValue` re-fires on the reset, causing an infinite loop; the input field appears empty (requires a workaround of showing the query in the title bar)

### Option D: TreeView (Explorer Sidebar)

A TreeView placed in the Explorer sidebar, backed by a TreeDataProvider. Search requires a separate InputBox.

- Pros: Native tree display (expand/collapse, folder icons), file icon theme support via `resourceUri`
- Cons: No API for embedding a search input in TreeView (VS Code issue #161753); users must open a separate InputBox for each search, making the workflow cumbersome

### Option E: WebviewView (Sidebar)

A WebviewView placed in the Explorer sidebar, with a fully custom HTML/CSS/JS interface combining a search input and file tree.

- Pros: Search input and tree display unified in a single panel, real-time filtering, fully customizable UI
- Cons: Higher implementation cost, no automatic file icon theme integration (codicons are available)

### Option F: Webview Panel (Editor Tab)

A Webview rendered as a tab in the editor area.

- Pros: Same flexibility as Option E
- Cons: Occupies an editor tab, which is disruptive for a file-finding tool

### Option G: Quick Pick + TreeView Coordination

Quick Pick handles search input while a TreeView displays results simultaneously.

- Pros: Combines AND search with hierarchical display
- Cons: State synchronization between two UI components is complex; closing the Quick Pick breaks the link to the TreeView

## Decision

**Option E: WebviewView**

## Rationale

WebviewView is the only option that satisfies all requirements:

- **Hierarchical display** (expand/collapse, icons) is required — all Quick Pick options (A/B/C) fall short
- **Integrated real-time filtering** (search input and results in one panel) is required — TreeView (D) forces search into a separate step
- **Non-intrusive** — Webview Panel (F) occupies an editor tab
- **Consistent state** — Quick Pick + TreeView (G) requires complex synchronization between two UIs

The implementation cost is higher, but every other option requires compromising on UI requirements. Using VS Code's color theme variables (`--vscode-*`) keeps the look and feel consistent with the native UI.
