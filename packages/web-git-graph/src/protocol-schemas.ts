const oid = {
  type: "string",
  pattern: "^(?:[0-9a-fA-F]{40}|[0-9a-fA-F]{64}|__WORKTREE__)$"
} as const;

export const GIT_GRAPH_JSON_SCHEMAS = {
  revision: {
    $id: "https://web-git-graph.dev/schema/v1/revision.json",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    oneOf: [
      {
        type: "object",
        additionalProperties: false,
        required: ["kind", "oid"],
        properties: { kind: { const: "commit" }, oid }
      },
      {
        type: "object",
        additionalProperties: false,
        required: ["kind", "oid"],
        properties: {
          kind: { const: "stash" },
          oid,
          selector: { type: "string" }
        }
      },
      {
        type: "object",
        additionalProperties: false,
        required: ["kind"],
        properties: { kind: { const: "working-tree" } }
      }
    ]
  },
  commit: {
    $id: "https://web-git-graph.dev/schema/v1/commit.json",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    additionalProperties: false,
    required: ["oid", "parents", "message", "kind"],
    properties: {
      oid,
      parents: { type: "array", items: oid },
      message: { type: "string" },
      kind: { enum: ["commit", "working-tree", "stash"] },
      author: {
        type: "object",
        additionalProperties: false,
        required: ["name"],
        properties: {
          name: { type: "string" },
          email: { type: "string" },
          avatarUrl: { type: "string", format: "uri" }
        }
      },
      authoredAt: { type: "string", format: "date-time" },
      committedAt: { type: "string", format: "date-time" },
      url: { type: "string", format: "uri" },
      additions: { type: "integer", minimum: 0 },
      deletions: { type: "integer", minimum: 0 },
      changedFiles: { type: "integer", minimum: 0 },
      worktree: {
        type: "object",
        additionalProperties: false,
        required: ["staged", "unstaged", "untracked"],
        properties: {
          staged: { type: "integer", minimum: 0 },
          unstaged: { type: "integer", minimum: 0 },
          untracked: { type: "integer", minimum: 0 }
        }
      }
    }
  },
  ref: {
    $id: "https://web-git-graph.dev/schema/v1/ref.json",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    additionalProperties: false,
    required: ["name", "target", "kind"],
    properties: {
      name: { type: "string" },
      target: oid,
      kind: { enum: ["head", "remote", "tag", "stash", "current"] },
      url: { type: "string", format: "uri" }
    }
  },
  change: {
    $id: "https://web-git-graph.dev/schema/v1/change.json",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    additionalProperties: false,
    required: ["path", "kind"],
    properties: {
      path: { type: "string" },
      previousPath: { type: "string" },
      kind: {
        enum: ["add", "modify", "delete", "rename", "copy", "binary", "submodule", "unknown"]
      },
      additions: { type: "integer", minimum: 0 },
      deletions: { type: "integer", minimum: 0 },
      binary: { type: "boolean" },
      staged: { type: "boolean" },
      unavailableReason: { type: "string" }
    }
  },
  capabilities: {
    $id: "https://web-git-graph.dev/schema/v1/capabilities.json",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    additionalProperties: false,
    required: [
      "protocolVersion",
      "history",
      "details",
      "compare",
      "diff",
      "workingTree",
      "stashes",
      "maxPageSize"
    ],
    properties: {
      protocolVersion: { const: "1" },
      history: { type: "boolean" },
      details: { type: "boolean" },
      compare: { type: "boolean" },
      diff: { type: "boolean" },
      workingTree: { type: "boolean" },
      stashes: { type: "boolean" },
      maxPageSize: { type: "integer", minimum: 1, maximum: 500 },
      maxDiffBytes: { type: "integer", minimum: 0 }
    }
  },
  page: {
    $id: "https://web-git-graph.dev/schema/v1/page.json",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    additionalProperties: false,
    required: ["commits", "refs", "hasMore"],
    properties: {
      commits: {
        type: "array",
        items: { $ref: "https://web-git-graph.dev/schema/v1/commit.json" }
      },
      refs: {
        type: "array",
        items: { $ref: "https://web-git-graph.dev/schema/v1/ref.json" }
      },
      head: oid,
      cursor: { type: "string" },
      hasMore: { type: "boolean" },
      repositoryId: { type: "string" },
      repositoryName: { type: "string" }
    }
  },
  error: {
    $id: "https://web-git-graph.dev/schema/v1/error.json",
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    additionalProperties: false,
    required: ["error"],
    properties: {
      error: {
        type: "object",
        additionalProperties: false,
        required: ["code", "message", "retryable"],
        properties: {
          code: {
            enum: [
              "bad_request",
              "unauthorized",
              "forbidden",
              "repository_not_found",
              "revision_not_found",
              "snapshot_expired",
              "git_unavailable",
              "output_limit",
              "unsupported",
              "rate_limited",
              "internal_error"
            ]
          },
          message: { type: "string" },
          retryable: { type: "boolean" },
          details: { type: "object" }
        }
      }
    }
  }
} as const;

export type GitGraphJsonSchemaName = keyof typeof GIT_GRAPH_JSON_SCHEMAS;
