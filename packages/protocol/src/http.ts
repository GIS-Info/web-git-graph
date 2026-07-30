import type {
  GitGraphCapabilities,
  GitGraphCommitDetails,
  GitGraphComparison,
  GitGraphFileDiff,
  GitGraphPage,
  GitGraphRepository,
  GitGraphRevision
} from "./types";
import type { GitGraphProtocolErrorBody } from "./errors";
import { GIT_GRAPH_JSON_SCHEMAS } from "./schemas";

export const GIT_GRAPH_CONTENT_TYPE = "application/vnd.web-git-graph.v1+json";

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
