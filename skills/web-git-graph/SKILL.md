---
name: web-git-graph
description: >-
  Embeds a framework-free read-only Git history graph via `<web-git-graph>`
  (@web-git-graph/web), with GitHub/HTTP/custom providers and an optional
  Node backend (@web-git-graph/node). Use when building coding-agent UIs,
  IDE webviews, PR review surfaces, or repo explorers that need commit
  lanes, search, compare, file diffs, or a stable Git history protocol —
  not for mutating Git (checkout/merge/rebase/reset).
---

# Web Git Graph

## Quick decision

| Need | Do this |
| --- | --- |
| Embed history UI | `npm i @web-git-graph/web` + register + set `provider` |
| Public GitHub data | `GitHubGitGraphProvider` |
| Local disk repo | `npx @web-git-graph/node serve` + `HttpGitGraphProvider` |
| Own API / MCP | Implement `GitGraphProvider` |
| Types / OpenAPI only | `@web-git-graph/protocol` (+ `/http` for `OPENAPI_DOCUMENT`) |

## Minimal template

```bash
npm install @web-git-graph/web @web-git-graph/protocol
```

```html
<web-git-graph id="history" theme="dark"></web-git-graph>
<script type="module">
  import "@web-git-graph/web/register";
  import { GitHubGitGraphProvider } from "@web-git-graph/web/providers/github";

  const graph = document.querySelector("#history");
  graph.provider = new GitHubGitGraphProvider({ repository: "owner/repo" });
  graph.addEventListener("gitgraph-commit-select", (e) => {
    // Pass e.detail.commit.oid into agent context/tools
  });
</script>
```

Local backend:

```bash
npx @web-git-graph/node serve --repo . --cors-origin http://127.0.0.1:4173
```

```ts
import { HttpGitGraphProvider } from "@web-git-graph/web/providers/http";
graph.provider = new HttpGitGraphProvider({
  baseUrl: "http://127.0.0.1:4174",
  repositoryId: "local"
});
```

## Rules

- Read-only only — never invent mutation APIs on this stack.
- `provider` is a JS property; HTML attributes are for presentation (`theme`, `density`, `columns`, …).
- Call `graph.refresh()` after other tools change the working tree.
- Protocol version is `"1"`. Capabilities keys: `details` / `diff` (not `commitDetails` / `fileDiff`).
- Commit text field is `message`.

## Recipes (read on demand)

- [docs/recipes/README.md](../../docs/recipes/README.md)
- [embed-in-agent-ui.md](../../docs/recipes/embed-in-agent-ui.md)
- [local-repo-http-backend.md](../../docs/recipes/local-repo-http-backend.md)
- [github-public-repo.md](../../docs/recipes/github-public-repo.md)
- [custom-provider.md](../../docs/recipes/custom-provider.md)
- [bridge-events-to-agent-actions.md](../../docs/recipes/bridge-events-to-agent-actions.md)

## Repo contract

See [AGENTS.md](../../AGENTS.md) and [llms.txt](../../llms.txt).
