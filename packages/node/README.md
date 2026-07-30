# @web-git-graph/node

Read-only local Git backend, snapshot pagination, HTTP handlers, and CLI.

```ts
import { LocalGitBackend, createGitGraphNodeHandler } from "@web-git-graph/node";
```

```bash
npx @web-git-graph/node serve --repo .
```

The CLI serves the HTTP v1 protocol. Browser rendering lives independently in
`@web-git-graph/web`.
