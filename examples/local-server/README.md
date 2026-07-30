# Server integration recipes

The protocol handler is deliberately independent from a Node web framework.

## Native Node HTTP

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

## Express / Nest middleware

Express requests and responses extend Node's `IncomingMessage` and
`ServerResponse`, so the same handler can be mounted without an Express runtime
dependency in `@web-git-graph/node`.

```ts
const handler = createGitGraphNodeHandler({ backend });
app.use("/v1", (request, response) => handler(request, response));
```

Mount the handler at the application root when using the default `/v1` routes,
or rewrite the mount path before delegation.

## Fastify

```ts
const handler = createGitGraphNodeHandler({ backend });
fastify.all("/v1/*", async (request, reply) => {
  reply.hijack();
  await handler(request.raw, reply.raw);
});
```

## Next.js Route Handler / Hono / Bun

```ts
import { createGitGraphFetchHandler } from "@web-git-graph/node";

const handler = createGitGraphFetchHandler({ backend });
export const GET = handler;
export const POST = handler;
```

Authentication and CORS belong to the host application. Use the `authorize`,
`onRequest`, and `onError` hooks to connect existing policy and observability.
