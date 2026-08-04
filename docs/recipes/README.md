# Web Git Graph recipes

Task-oriented guides for coding agents and host UIs. Prefer these over architecture docs when integrating.

| Intent | Recipe |
| --- | --- |
| Embed a Git history panel in an agent / IDE webview | [embed-in-agent-ui.md](./embed-in-agent-ui.md) |
| Show a local repository over HTTP | [local-repo-http-backend.md](./local-repo-http-backend.md) |
| Load a public GitHub repository | [github-public-repo.md](./github-public-repo.md) |
| Adapt your own Git API or MCP | [custom-provider.md](./custom-provider.md) |
| Wire graph events into agent tools | [bridge-events-to-agent-actions.md](./bridge-events-to-agent-actions.md) |

## Decision tree

1. Need **UI** for commit history / lanes / compare → `@web-git-graph/web`
2. Data from **public GitHub** → `GitHubGitGraphProvider`
3. Data from **local disk** → `@web-git-graph/node` + `HttpGitGraphProvider`
4. Data from **your backend / MCP** → implement `GitGraphProvider` (see custom provider)
5. Need **types / OpenAPI only** → `@web-git-graph/protocol`

## Constraints (always)

- **Read-only**: no checkout, merge, rebase, reset, or other Git mutations.
- Complex values (`provider`, `data`, `refs`) are **JS properties**, not HTML attributes.
- Always `import "@web-git-graph/web/register"` before using `<web-git-graph>`.
- Protocol version is `"1"` (`GIT_GRAPH_PROTOCOL_VERSION`).
- Avatars default **off** (Gravatar discloses email hashes).

See also: [AGENTS.md](../../AGENTS.md), [SKILL.md](../../skills/web-git-graph/SKILL.md).
