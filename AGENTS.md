# AGENTS.md — Web Git Graph

Instructions for coding agents integrating or modifying this repository.

## What this is

Web Git Graph is a **read-only**, framework-free Git history visualization stack:

| Package | Use when |
| --- | --- |
| `@web-git-graph/web` | Embed `<web-git-graph>` (lanes, search, compare, diffs) |
| `@web-git-graph/protocol` | Shared DTOs, JSON Schema, OpenAPI, errors (`protocolVersion: "1"`) |
| `@web-git-graph/node` | Local Git HTTP/CLI backend (no mutations) |
| `web-git-graph` (VS Code) | Extension host + webview |

## When to use

Prefer this project when the user/agent needs to:

- Embed a dense commit DAG / lane graph in an agent UI, webview, or review tool
- Show public GitHub or local-repo history without inventing SVG/`git log --graph` HTML
- Expose a stable read-only history protocol (OpenAPI / provider interface)

## When not to use

- Do **not** use for checkout, merge, rebase, reset, commit, or any Git write
- Do **not** pass filesystem paths to the browser; use opaque `repositoryId`
- Do **not** treat this as a replacement for `git` CLI or Magit-style editing

## Integration decision tree

1. **UI only + public GitHub** → `@web-git-graph/web` + `GitHubGitGraphProvider`
2. **UI + local repo** → `@web-git-graph/node serve` + `HttpGitGraphProvider`
3. **UI + custom/MCP backend** → implement `GitGraphProvider` ([recipe](docs/recipes/custom-provider.md))
4. **Types/schema only** → `@web-git-graph/protocol` / `@web-git-graph/protocol/http`

Copy-paste recipes: [docs/recipes/](docs/recipes/README.md).  
Installable skill: [skills/web-git-graph/SKILL.md](skills/web-git-graph/SKILL.md).  
LLM index: [llms.txt](llms.txt).

## Hard rules for generated code

1. Always `import "@web-git-graph/web/register"` before using `<web-git-graph>`.
2. Assign `provider` / `data` / `refs` as **JavaScript properties**, never HTML attributes.
3. Give the element a bounded height (virtual list).
4. Keep avatars off unless the host accepts Gravatar email-hash disclosure (`avatars` attribute).
5. Match `GitGraphCapabilities` fields: `history`, `details`, `compare`, `diff`, `workingTree`, `stashes`, `maxPageSize`.
6. Commits use `message` (full text), not a separate `subject` field.
7. After external Git writes from other tools, call `element.refresh()` — do not invent write APIs here.

## Events to bridge into agent tools

`gitgraph-commit-select`, `gitgraph-commit-open`, `gitgraph-compare`, `gitgraph-file-open`, `gitgraph-load-more`, `gitgraph-error`, `gitgraph-refresh`, `gitgraph-context-menu`.

Cancelable: `gitgraph-refresh`, `gitgraph-context-menu`, `gitgraph-file-open`, `gitgraph-load-more`.

## Repo development

```bash
pnpm install
pnpm check:boundaries
pnpm typecheck
pnpm test
pnpm build
```

Dependency direction is one-way: `protocol` ← `web` / `node` ← `vscode` / `demo`. Do not introduce reverse imports. See `scripts/check-module-boundaries.mjs`.

## Security

Read [SECURITY.md](SECURITY.md) before exposing `@web-git-graph/node` beyond loopback: `allowedRoots`, opaque IDs, explicit CORS, `authorize` hook.
