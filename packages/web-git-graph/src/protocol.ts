import type {
  GitGraphCapabilities,
  GitGraphCommitDetails,
  GitGraphComparison,
  GitGraphFileDiff,
  GitGraphPage,
  GitGraphRepository,
  GitGraphRevision
} from "./types";
import { GIT_GRAPH_JSON_SCHEMAS } from "./protocol-schemas";

export { GIT_GRAPH_JSON_SCHEMAS } from "./protocol-schemas";
export type { GitGraphJsonSchemaName } from "./protocol-schemas";

export const GIT_GRAPH_PROTOCOL_VERSION = "1" as const;
export const GIT_GRAPH_CONTENT_TYPE = "application/vnd.web-git-graph.v1+json";

export type GitGraphErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "repository_not_found"
  | "revision_not_found"
  | "snapshot_expired"
  | "git_unavailable"
  | "output_limit"
  | "unsupported"
  | "rate_limited"
  | "internal_error";

export interface GitGraphProtocolErrorBody {
  error: {
    code: GitGraphErrorCode;
    message: string;
    retryable: boolean;
    details?: Record<string, unknown>;
  };
}

export class GitGraphProtocolError extends Error {
  readonly code: GitGraphErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(
    code: GitGraphErrorCode,
    message: string,
    options: {
      status?: number;
      retryable?: boolean;
      details?: Record<string, unknown>;
    } = {}
  ) {
    super(message);
    this.name = "GitGraphProtocolError";
    this.code = code;
    this.status = options.status ?? 400;
    this.retryable = options.retryable ?? false;
    this.details = options.details;
  }

  toJSON(): GitGraphProtocolErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        retryable: this.retryable,
        ...(this.details ? { details: this.details } : {})
      }
    };
  }
}

export interface GitGraphCompareRequestBody {
  base: GitGraphRevision;
  head: GitGraphRevision;
}

export interface GitGraphDiffRequestBody extends GitGraphCompareRequestBody {
  path: string;
  context?: number;
}

export type GitGraphProtocolResponse =
  | GitGraphCapabilities
  | readonly GitGraphRepository[]
  | GitGraphPage
  | GitGraphCommitDetails
  | GitGraphComparison
  | GitGraphFileDiff
  | GitGraphProtocolErrorBody;

export const OPENAPI_DOCUMENT = {
  openapi: "3.1.0",
  info: {
    title: "Web Git Graph Protocol",
    version: "1.0.0",
    description: "Framework and language neutral read-only Git graph protocol."
  },
  components: {
    schemas: {
      Revision: GIT_GRAPH_JSON_SCHEMAS.revision,
      Commit: GIT_GRAPH_JSON_SCHEMAS.commit,
      Ref: GIT_GRAPH_JSON_SCHEMAS.ref,
      Change: GIT_GRAPH_JSON_SCHEMAS.change,
      Capabilities: GIT_GRAPH_JSON_SCHEMAS.capabilities,
      Page: GIT_GRAPH_JSON_SCHEMAS.page,
      Error: GIT_GRAPH_JSON_SCHEMAS.error
    }
  },
  paths: {
    "/v1/capabilities": { get: { operationId: "getCapabilities" } },
    "/v1/repositories": { get: { operationId: "listRepositories" } },
    "/v1/repositories/{id}/history": { get: { operationId: "getHistory" } },
    "/v1/repositories/{id}/commits/{oid}": { get: { operationId: "getCommitDetails" } },
    "/v1/repositories/{id}/compare": { post: { operationId: "compare" } },
    "/v1/repositories/{id}/diff": { post: { operationId: "getFileDiff" } }
  }
} as const;
