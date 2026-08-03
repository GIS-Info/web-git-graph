# Changelog

## 1.0.0

- Repositories nested below a workspace folder are found too, up to
  `webGitGraph.maxDepthOfRepoSearch` levels (default 2).
- The branch picker takes several branches, remotes and tags at once; the graph
  is walked from the union of the ticked tips.
- Added a manual refresh button next to the search box.
- Optional author avatars (`webGitGraph.fetchAvatars`, off by default).
- Configurable date rendering (`webGitGraph.date.format`, `webGitGraph.date.type`)
  and column visibility (`webGitGraph.columns`).
- Right-clicking a commit opens a context menu with **Copy Commit Hash**,
  **Copy Commit Subject** and **Compare with Selected Commit**.
- Fixed the commit details panel flickering: it no longer replays its open
  animation whenever the graph re-renders, and right-clicking no longer moves
  the selection.
- The repository picker is hidden when the workspace has a single repository.

## 0.1.0

- Initial release: read-only commit graph with deterministic lanes, commit
  details, search, stashes and a working-tree pseudo commit.
- Entry points: status bar item, Source Control view title button and the
  command palette.
- Native VS Code diff editor for per-file changes at any revision.
- Automatic refresh on `HEAD`, ref and index changes.
- Webview persistence across window reloads.
