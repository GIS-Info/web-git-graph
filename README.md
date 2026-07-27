# Web Git Graph

Framework-free Git history for the web.

`web-git-graph` combines an independent commit-lane layout engine, a native Web
Component, public GitHub and HTTP providers, and a read-only local Node backend.
It is designed for embedding: the browser UI does not know whether its commits
came from GitHub, Express, Fastify, Next.js, Go, Java, or a local `git` process.

[Live demo](https://kian-zh.github.io/web-git-graph/) ·
[Protocol](#backend-neutral-http-protocol) ·
[Security](./SECURITY.md)

## Install

```bash
npm install web-git-graph
```

The package is ESM-first. The Node subpath also exposes CommonJS.

## Native Web Component

```html
<web-git-graph id="history" theme="dark"></web-git-graph>

<script type="module">
  import "web-git-graph/register";

  const graph = document.querySelector("#history");
  graph.data = {
    commits: [
      {
        oid: "b821ea6",
        parents: ["29d3b20"],
        message: "Ship the graph",
        kind: "commit",
        author: { name: "Ada" },
        committedAt: "2026-07-27T10:00:00Z"
      }
    ],
    refs: [{ name: "main", target: "b821ea6", kind: "current" }],
    head: "b821ea6",
    hasMore: false
  };
</script>
```

The same custom element works in React, Vue, Svelte, Solid, Angular, and plain
HTML. Set complex values as JavaScript properties rather than HTML attributes.

### React

```tsx
import { useEffect, useRef } from "react";
import "web-git-graph/register";
import type { GitGraphPage, WebGitGraphElement } from "web-git-graph";

export function History({ page }: { page: GitGraphPage }) {
  const ref = useRef<WebGitGraphElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.data = page;
  }, [page]);
  return <web-git-graph ref={ref} theme="dark" />;
}
```

### Events

```js
graph.addEventListener("gitgraph-commit-select", ({ detail }) => {
  console.log(detail.commit);
});

graph.addEventListener("gitgraph-compare", ({ detail }) => {
  console.log(detail.base, detail.head, detail.changes);
});
```

The component also emits `gitgraph-commit-open`, `gitgraph-file-open`,
`gitgraph-load-more`, and `gitgraph-error`.

### Theme variables

```css
web-git-graph {
  height: 680px;
  --wgg-bg: #0d1117;
  --wgg-panel: #161b22;
  --wgg-accent: #2de0ad;
  --wgg-row-height: 38px;
  --wgg-font: "My UI Font", sans-serif;
  --wgg-mono: "My Mono", monospace;
}
```

## Public GitHub provider

```ts
import "web-git-graph/register";
import { GitHubGitGraphProvider } from "web-git-graph/providers/github";

document.querySelector("web-git-graph").provider =
  new GitHubGitGraphProvider({
    repository: "kian-zh/web-git-graph"
  });
```

Unauthenticated GitHub requests are rate limited. A token can be returned by an
in-memory callback, but should never be written to a public bundle or browser
storage.

## Local Git in one command

```bash
npx web-git-graph serve --repo .
```

This launches a read-only graph at `http://127.0.0.1:4174`. It does not expose
checkout, merge, rebase, reset, or any other Git mutation.

## Embed the Node backend

```ts
import { createServer } from "node:http";
import {
  LocalGitBackend,
  createGitGraphNodeHandler
} from "web-git-graph/node";

const backend = new LocalGitBackend({
  repositories: {
    project: "/srv/repos/project"
  },
  allowedRoots: ["/srv/repos"]
});

createServer(
  createGitGraphNodeHandler({
    backend,
    authorize: ({ request }) => request.headers.has("authorization")
  })
).listen(4000);
```

The client connects with:

```ts
import { HttpGitGraphProvider } from "web-git-graph/providers/http";

graph.provider = new HttpGitGraphProvider({
  baseUrl: "https://code.example.com",
  repositoryId: "project",
  headers: () => ({
    authorization: `Bearer ${getShortLivedToken()}`
  })
});
```

`LocalGitBackend` runs Git with argument arrays, never through a shell. Browser
clients send opaque repository IDs, never filesystem paths. Repository paths
are resolved and checked against `allowedRoots`.

## Backend-neutral HTTP protocol

The versioned protocol is exported from `web-git-graph/protocol`, including
TypeScript DTOs, Draft 2020-12 JSON Schemas (`GIT_GRAPH_JSON_SCHEMAS`), and an
OpenAPI 3.1 document (`OPENAPI_DOCUMENT`).

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/v1/capabilities` | Feature negotiation |
| `GET` | `/v1/repositories` | Available opaque repository IDs |
| `GET` | `/v1/repositories/{id}/history` | Paginated commit DAG |
| `GET` | `/v1/repositories/{id}/commits/{oid}` | Commit/worktree details |
| `POST` | `/v1/repositories/{id}/compare` | Direct tree comparison |
| `POST` | `/v1/repositories/{id}/diff` | Lazy per-file unified patch |

The Fetch handler works directly in Next.js route handlers, Hono, and Bun. The
Node handler accepts `IncomingMessage`/`ServerResponse`, so it can be mounted in
native Node HTTP, Express/Nest, or Fastify through `request.raw`/`reply.raw`.
See [`examples/local-server`](./examples/local-server/README.md).

All cursors are opaque. The local implementation pins ref tips in a snapshot so
new commits cannot reorder an in-progress pagination session. The default
in-memory LRU store is appropriate for one process; clustered deployments can
provide a shared `SnapshotStore`.

## Clean-room design

The project is inspired by the density and interaction model of desktop Git
history tools, including VS Code Git Graph. Its source, data model, layout
algorithm, rendering, and protocol are independently implemented. No source
code from `mhutchie/vscode-git-graph` is included or derived.

## Development

Requires Node 20+ and pnpm 10.

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

## License

MIT
