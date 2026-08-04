# Changelog

## 1.0.5

- npm publishes now use Trusted Publishing (GitHub Actions OIDC) from
  `publish.yml`, so releases no longer need a long-lived `NPM_TOKEN`.

## 1.0.4

- The graph follows the host colour theme (`--vscode-*` tokens), so custom
  light themes (for example Kiro's beige UI) no longer force a white panel.
- Branch chips keep their full names when the view is narrow; the commit
  message ellipsises first, matching vscode-git-graph.
- Graph strokes are clipped to the graph column, and narrow layouts use the
  webview's own width (container queries) so description text no longer
  overlaps the lane drawing.

## 1.0.3

- `addEventListener` / `removeEventListener` on `WebGitGraphElement` are now
  typed against `WebGitGraphElementEventMap`, so `event.detail` type-checks from
  the event name without host-side casts; the matching `ongitgraph-*` handler
  properties are typed too.
- The `@web-git-graph/web/jsx` entry augments `React.JSX.IntrinsicElements`, so
  React + TypeScript hosts can render `<web-git-graph>` without a local ambient
  declaration. It is a type-only entry: no React dependency ships in the package.
- The Node HTTP handler accepts a `basePath` option (and the CLI a
  `--base-path` flag), so a backend mounted under a subpath serves the v1
  protocol without host-side URL rewriting. Root mounting is unchanged.

## 1.0.2

- Remote branch chips (`origin/*`) are no longer drawn with a dashed border.
  They now recede by colour — a grey outline with no fill — while local
  branches keep their lane-coloured, tinted chip.

## 1.0.1

- Right-clicking a commit no longer makes the row blink: the row keeps its
  highlight while its own menu covers the pointer, and the gesture no longer
  moves focus.
- Repository discovery is cached, so opening a commit or a diff no longer walks
  the workspace tree first.
- A background refresh (VS Code's Git integration touches the index often) now
  reloads the graph in place, keeping the scroll position and the open commit
  instead of jumping back to the top.

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
