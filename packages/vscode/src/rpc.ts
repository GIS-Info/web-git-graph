import type {
  GitGraphCapabilities,
  GitGraphChange,
  GitGraphCommitDetails,
  GitGraphComparison,
  GitGraphFileDiff,
  GitGraphHistoryQuery,
  GitGraphPage,
  GitGraphProtocolErrorBody,
  GitGraphRepository,
  GitGraphRevision
} from "@web-git-graph/protocol";
import type { GitGraphDiffRequestBody } from "@web-git-graph/protocol/http";

export interface GitGraphRpcMethods {
  repositories: {
    params: Record<string, never>;
    result: readonly GitGraphRepository[];
  };
  capabilities: {
    params: Record<string, never>;
    result: GitGraphCapabilities;
  };
  history: {
    params: { repositoryId: string; query?: GitGraphHistoryQuery };
    result: GitGraphPage;
  };
  details: {
    params: { repositoryId: string; revision: GitGraphRevision };
    result: GitGraphCommitDetails;
  };
  compare: {
    params: {
      repositoryId: string;
      base: GitGraphRevision;
      head: GitGraphRevision;
    };
    result: GitGraphComparison;
  };
  diff: {
    params: GitGraphDiffRequestBody & { repositoryId: string };
    result: GitGraphFileDiff;
  };
  openFile: {
    params: { repositoryId: string; path: string };
    result: { opened: boolean };
  };
  openDiff: {
    params: {
      repositoryId: string;
      path: string;
      previousPath?: string;
      kind: GitGraphChange["kind"];
      binary?: boolean;
      base: GitGraphRevision;
      head: GitGraphRevision;
    };
    result: { opened: boolean };
  };
}

export type GitGraphRpcMethod = keyof GitGraphRpcMethods;

export type GitGraphRpcRequest = {
  [Method in GitGraphRpcMethod]: {
    id: string;
    method: Method;
    params: GitGraphRpcMethods[Method]["params"];
  };
}[GitGraphRpcMethod];

export type GitGraphRpcResponse =
  | {
      [Method in GitGraphRpcMethod]: {
        id: string;
        method: Method;
        result: GitGraphRpcMethods[Method]["result"];
      };
    }[GitGraphRpcMethod]
  | {
      id: string;
      method: GitGraphRpcMethod;
      error: GitGraphProtocolErrorBody["error"];
    };

/** Pushed by the extension host without a matching webview request. */
export interface GitGraphRpcRefreshNotification {
  method: "refresh";
}

export type GitGraphRpcServerMessage = GitGraphRpcResponse | GitGraphRpcRefreshNotification;
