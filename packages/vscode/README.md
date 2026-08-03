# Web Git Graph

A read-only Git history graph for VS Code: deterministic swimlanes, commit
details, stashes, an uncommitted-changes row and native revision diffs.

## Features

- **Commit graph** — child-before-parent DAG layout with stable, deterministic
  lanes, rendered by the [`@web-git-graph/web`](https://www.npmjs.com/package/@web-git-graph/web)
  component with virtual scrolling.
- **Commit details** — message, refs, file tree with per-file additions and
  deletions.
- **Native diffs** — clicking a changed file opens VS Code's diff editor with
  the file contents at the commit's parent and at the commit itself.
- **Search** — highlight-and-jump matching on message, author and hash without
  collapsing the graph topology.
- **Branch filtering** — tick any number of branches, remotes and tags; the
  graph is walked from the union of those tips.
- **Context menu** — right-click a commit to copy its hash or subject, or to
  compare it with the selected commit.
- **Stashes and working tree** — stashes appear as grafted tips; uncommitted
  changes appear as a pseudo commit.
- **Auto refresh** — the graph reloads when `HEAD`, refs or the index change,
  and a refresh button is always available.
- **Repository discovery** — every workspace folder plus repositories nested
  below it are listed.

## Usage

Open the graph from any of:

- the **Web Git Graph** status bar item (shown when the workspace contains a
  Git repository; disable with `webGitGraph.showStatusBarItem`),
- the graph button in the Source Control view title bar,
- the **Web Git Graph: Open Graph** command in the command palette.

When the workspace contains more than one repository, a repository picker
appears above the graph; with a single repository it stays hidden.

## Settings

| Setting | Default | Purpose |
| --- | --- | --- |
| `webGitGraph.maxDepthOfRepoSearch` | `2` | Directory levels searched below each workspace folder |
| `webGitGraph.columns` | `date, author, commit` | Columns shown beside the graph |
| `webGitGraph.date.format` | `datetime` | `datetime`, `date` or `relative` |
| `webGitGraph.date.type` | `committed` | Show the committed or authored date |
| `webGitGraph.fetchAvatars` | `false` | Load author avatars from Gravatar |
| `webGitGraph.showStatusBarItem` | `true` | Show the status bar entry point |

## Read-only by design

The extension executes only read-only Git commands (`rev-list`, `cat-file`,
`diff`, `show`, …) inside the trusted workspace folders. It never mutates a
repository: there is no checkout, merge, rebase, reset, push or fetch.

## Requirements

- `git` available on `PATH`
- A trusted, local (non-virtual) workspace
