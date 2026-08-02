# Web Git Graph

Framework-free Git history rendering for browsers, local Node backends, and
VS Code.

The repository is split into four modules with one-way dependencies:

```text
@web-git-graph/protocol
       ▲         ▲
       │         │
@web-git-graph/web   @web-git-graph/node
       ▲         ▲
       └────┬────┘
 @web-git-graph/vscode
```

[Live demo](https://gis-info.github.io/web-git-graph/) ·
[Architecture](./docs/architecture/four-module-split-plan.md) ·
[Security](./SECURITY.md)

## Modules

| Module | Responsibility |
| --- | --- |
| `@web-git-graph/protocol` | Transport-neutral DTOs, schemas, version and errors |
| `@web-git-graph/web` | Layout, Web Component and browser provider adapters |
| `@web-git-graph/node` | Local Git backend, HTTP handlers and read-only CLI |
| `@web-git-graph/vscode` | VS Code Webview and Extension Host integration |
| `@web-git-graph/demo` | Private fixture, GitHub and HTTP integration demo |

## Browser

```bash
npm install @web-git-graph/protocol @web-git-graph/web
```

```html
<web-git-graph id="history" theme="dark"></web-git-graph>

<script type="module">
  import "@web-git-graph/web/register";
  import { GitHubGitGraphProvider } from "@web-git-graph/web/providers/github";

  document.querySelector("#history").provider =
    new GitHubGitGraphProvider({ repository: "GIS-Info/web-git-graph" });
</script>
```

Shared DTOs are imported explicitly from the protocol seam:

```ts
import type { GitGraphCommit, GitGraphPage } from "@web-git-graph/protocol";
import type {
  GitGraphProvider,
  WebGitGraphElement
} from "@web-git-graph/web";
```

The component emits `gitgraph-commit-select`, `gitgraph-commit-open`,
`gitgraph-compare`, `gitgraph-file-open`, `gitgraph-load-more`, and
`gitgraph-error`.

## Local Node backend

```bash
npm install @web-git-graph/node
npx @web-git-graph/node serve --repo . \
  --cors-origin http://127.0.0.1:4173
```

The CLI starts a read-only HTTP v1 endpoint on `127.0.0.1:4174`. Browser
rendering remains in the Web module and connects through the HTTP provider:

```ts
import { HttpGitGraphProvider } from "@web-git-graph/web/providers/http";

graph.provider = new HttpGitGraphProvider({
  baseUrl: "http://127.0.0.1:4174",
  repositoryId: "local"
});
```

Embed the backend in a host application:

```ts
import { createServer } from "node:http";
import {
  LocalGitBackend,
  createGitGraphNodeHandler
} from "@web-git-graph/node";

const backend = new LocalGitBackend({
  repositories: { project: "/srv/repos/project" },
  allowedRoots: ["/srv/repos"]
});

createServer(createGitGraphNodeHandler({ backend })).listen(4000);
```

Authentication and CORS are responsibilities of the host application.
Repository paths never cross the protocol seam; browsers use opaque
`repositoryId` values.

## Protocol

```ts
import {
  GIT_GRAPH_JSON_SCHEMAS,
  GIT_GRAPH_PROTOCOL_VERSION,
  GitGraphProtocolError
} from "@web-git-graph/protocol";
import {
  GIT_GRAPH_CONTENT_TYPE,
  OPENAPI_DOCUMENT
} from "@web-git-graph/protocol/http";
```

The HTTP adapter exposes:

| Method | Route |
| --- | --- |
| `GET` | `/v1/capabilities` |
| `GET` | `/v1/repositories` |
| `GET` | `/v1/repositories/{id}/history` |
| `GET` | `/v1/repositories/{id}/commits/{oid}` |
| `POST` | `/v1/repositories/{id}/compare` |
| `POST` | `/v1/repositories/{id}/diff` |

Wire DTOs contain no `AbortSignal`, DOM type, Node type, HTTP status, or VS Code
type. Runtime cancellation remains at the Web provider and Node backend seams.

## VS Code

`@web-git-graph/vscode` bundles two isolated runtimes:

- The Webview imports the Web module and communicates only through typed RPC.
- The Extension Host calls `LocalGitBackend` in-process.

The extension does not start a localhost server and does not implement
checkout, merge, rebase, reset, or other Git mutations.

## Demo modes

The demo supports:

- deterministic fixture mode;
- public GitHub provider mode;
- HTTP provider mode.

Connect it to a local backend with:

```text
http://127.0.0.1:4173/web-git-graph/?backend=http://127.0.0.1:4174&repository=local
```

## Development

Requires Node 20+ and pnpm 10.

```bash
pnpm install
pnpm check:boundaries
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
pnpm pack:check
```

## Clean-room design

The project is inspired by the density and interaction model of desktop Git
history tools, including VS Code Git Graph. Its protocol, layout, rendering,
providers, backend, and host integrations are independently implemented.

## License

MIT
