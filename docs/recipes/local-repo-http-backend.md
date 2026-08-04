# Recipe: Local repository + HTTP v1 backend

**Intent:** Show a developer's (or agent's) local Git repo in the browser with a read-only backend.

**When:** Agent UIs running against workspace folders, demos of local history, or desktop apps that already have Node.

**Install:**

```bash
npm install @web-git-graph/web @web-git-graph/node @web-git-graph/protocol
```

**Start the backend (CLI):**

```bash
npx @web-git-graph/node serve --repo . \
  --cors-origin http://127.0.0.1:4173
```

Defaults: bind `127.0.0.1:4174`, read-only, serves OpenAPI. Prefer loopback; non-loopback `--host` warns.

**Connect the component:**

```ts
import "@web-git-graph/web/register";
import { HttpGitGraphProvider } from "@web-git-graph/web/providers/http";

const graph = document.querySelector("#history") as HTMLElement & {
  provider?: unknown;
};

graph.provider = new HttpGitGraphProvider({
  baseUrl: "http://127.0.0.1:4174",
  repositoryId: "local"
});
```

**Protocol surface (v1):**

| Method | Path |
| --- | --- |
| GET | `/v1/capabilities` |
| GET | `/v1/repositories` |
| GET | `/v1/repositories/{id}/history` |
| GET | `/v1/repositories/{id}/commits/{oid}` |
| POST | `/v1/repositories/{id}/compare` |
| POST | `/v1/repositories/{id}/diff` |

OpenAPI lives in `@web-git-graph/protocol/http` as `OPENAPI_DOCUMENT`. Content type: `application/vnd.web-git-graph.v1+json`.

**Pitfalls:**

- Browser clients only see opaque `repositoryId` — never put filesystem paths in the protocol.
- Configure CORS with an explicit origin; do not open CORS broadly in production.
- Deploy behind your own auth (`authorize` hook). See [SECURITY.md](../../SECURITY.md).
- Working tree / stash nodes appear when the backend supports them; bare repos skip both.
