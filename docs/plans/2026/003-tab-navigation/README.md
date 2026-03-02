# Tab Navigation

Status: Completed

## Overview

Add tab support to Loupe so that multiple repository file trees can be kept open simultaneously. Each tab independently maintains its own state (tree expansion, search query, navigation history), and switching between tabs preserves that state.

## Background

- Currently Loupe can only display one repository at a time; switching resets the tree state
- Workspaces with many sub-repositories require frequent jumping between repositories
- A browser-tab-like experience is needed — navigate to another repository while preserving the current one, then come back

## Technical Approach

### Architecture Change: HTML Replacement to Message-Driven Updates

The current `viewProvider.ts` regenerates `webview.html` entirely on every repository switch. For tab support, this approach destroys DOM state (scroll position, etc.) every time. The architecture must change to:

- Set HTML only once during `resolveWebviewView`
- Send all subsequent state updates via `postMessage`
- The webview JavaScript handles incremental DOM updates

### Tab State Model

Each tab independently holds the following state:

| State | Description |
|---|---|
| `repoPath` / `repoName` | Repository identity |
| `files` / `subRepos` | File list and sub-repository list |
| `expandedDirs` / `manuallyCollapsed` | Tree expand/collapse state |
| `searchQuery` | Search input text |
| `focusedIndex` | Index of the focused item |

Navigating into a sub-repository creates a new tab (or switches to an existing tab for that sub-repository). The previous `navStack`-based drill-down is replaced by tab-based navigation.

### Tab Open/Close Rules

- Selecting from the repository list → if a tab for the same repository already exists, switch to it; otherwise create a new tab
- Configurable tab limit (default: 10)
- When the limit is exceeded, the least recently used inactive tab is automatically closed (LRU)
- Tabs can be manually closed via the × button

### Tab Navigation Mode

Tab switching is driven by a dedicated keyboard mode, entered by pressing the Tab key from the search input:

- **Tab key** from the search input → enter tab navigation mode; focus moves to the first tab
- **Tab key** while in tab navigation mode → cycle focus to the next tab
- **Shift+Tab** while in tab navigation mode → cycle focus to the previous tab
- **Enter** on a focused tab → switch to that repository (search input is cleared, returns to file mode)
- **Typing** while in tab navigation mode → filter the tab list (non-matching tabs are hidden, focus stays on the first match)
- **Esc** → exit tab navigation mode, return focus to the search input

When no tabs are open (repository list mode), the Tab key is ignored (no tab navigation mode available).

This keeps the search input solely for file filtering during normal use, and provides a clean modal interaction for tab switching.

### Tab Bar UI

- Placed between the search input and the file list
- Each tab displays a shortened repository name (reusing the existing `shortRepoName()` logic)
- The active tab is visually distinguished
- Each tab has a × button for mouse close
- When all tabs are closed (0 tabs), the view returns to the repository list mode
- The tab bar is horizontally scrollable
- During tab navigation mode, the tab bar element captures keyboard input for filtering (no visible input field)

## Implementation

### Phase 1: Architecture Refactor — Message-Driven Updates

Replace full HTML regeneration with `postMessage`-based data updates.

- `viewProvider.ts`: limit `renderHtml()` to initial setup only; send data via `postMessage` thereafter
- `main.ts`: add message listener to update `ctx` and call `render()`
- Verify that existing behavior (repository list, file tree, search, navigation) is unchanged

### Phase 2: Tab State Management

Introduce tab state management on the extension side.

- Define `TabState` interface (per the state model above)
- Add `tabs: TabState[]` and `activeTabIndex` to `viewProvider.ts`
- Replace existing `setFiles` / `showRepoList` with tab-aware operations
- Tab limit enforcement and LRU eviction logic
- Bidirectional state sync between extension and webview:
  - On tab switch-away: webview reports current state (`expandedDirs`, `searchQuery`, `focusedIndex`, scroll position) to extension via `postMessage`
  - On tab switch-to: extension sends saved tab state to webview, which restores it

### Phase 3: Tab Bar UI

Add tab bar rendering and interaction to the webview.

- Tab bar HTML/CSS
- Tab click to switch
- × button to close a tab
- Visual highlight for the active tab

### Phase 4: Tab Navigation Mode

Implement the keyboard-driven tab switching mode.

- Tab key from search input enters tab navigation mode (focus moves to tab bar)
- Tab key cycles through tabs; typing filters the tab list
- Enter switches to the focused tab and exits tab navigation mode
- Esc exits tab navigation mode and returns focus to the search input

### Phase 5: Configuration and Polish

- Add `loupe.maxTabs` setting to `package.json`
- Auto-return to repository list when all tabs are closed
- Update `loupe.focus` command (switch to existing tab if one matches the active editor)

## Estimate

- 5 points
