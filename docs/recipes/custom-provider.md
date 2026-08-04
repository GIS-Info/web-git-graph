# Recipe: Custom provider (your API / MCP)

**Intent:** Feed `<web-git-graph>` from your own Git service, agent MCP bridge, or in-process backend.

**When:** Host already has commit/history APIs and only needs the renderer + lane layout.

**Contract** (`GitGraphProvider` from `@web-git-graph/web`):

```ts
import type {
  GitGraphCapabilities,
  GitGraphCommitDetails,
  GitGraphComparison,
  GitGraphFileDiff,
  GitGraphPage,
  GitGraphRevision
} from "@web-git-graph/protocol";
import type {
  GitGraphHistoryRequest,
  GitGraphProvider
} from "@web-git-graph/web";

export class MyGitGraphProvider implements GitGraphProvider {
  async getCapabilities(signal?: AbortSignal): Promise<GitGraphCapabilities> {
    return {
      protocolVersion: "1",
      history: true,
      details: true,
      compare: true,
      diff: true,
      workingTree: false,
      stashes: false,
      maxPageSize: 100
    };
  }

  async getHistory(request?: GitGraphHistoryRequest): Promise<GitGraphPage> {
    // Map your API / MCP tool result → GitGraphPage
    // Include commits[].oid, parents, message, kind, author, refs as needed
    throw new Error("implement me");
  }

  async getCommitDetails?.(
    repositoryId: string | undefined,
    revision: GitGraphRevision,
    signal?: AbortSignal
  ): Promise<GitGraphCommitDetails> {
    throw new Error("implement me");
  }

  async compare?.(
    repositoryId: string | undefined,
    base: GitGraphRevision,
    head: GitGraphRevision,
    signal?: AbortSignal
  ): Promise<GitGraphComparison> {
    throw new Error("implement me");
  }

  async getFileDiff?(
    repositoryId: string | undefined,
    base: GitGraphRevision,
    head: GitGraphRevision,
    path: string,
    context?: number,
    signal?: AbortSignal
  ): Promise<GitGraphFileDiff> {
    throw new Error("implement me");
  }
}
```

**Wire it:**

```ts
import "@web-git-graph/web/register";

graph.provider = new MyGitGraphProvider();
```

**Tips:**

- Omit optional methods you cannot support; set matching capability flags (`details`, `compare`, `diff`) to `false` so the UI hides those actions.
- Align field shapes with `@web-git-graph/protocol` JSON Schema (`GIT_GRAPH_JSON_SCHEMAS`) or OpenAPI (`OPENAPI_DOCUMENT` from `@web-git-graph/protocol/http`).
- Prefer opaque `repositoryId` values; do not leak host filesystem paths to the browser.
- For MCP: expose list/history/details/compare/diff tools server-side, then adapt tool results in the provider — keep the Web Component as the presentation layer only.
