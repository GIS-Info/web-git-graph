import type {
  GitGraphCapabilities,
  GitGraphCommitDetails,
  GitGraphComparison,
  GitGraphFileDiff,
  GitGraphHistoryQuery,
  GitGraphPage,
  GitGraphRevision
} from "@web-git-graph/protocol";

export interface GitGraphHistoryRequest extends GitGraphHistoryQuery {
  repositoryId?: string;
  signal?: AbortSignal;
}

export interface GitGraphProvider {
  getCapabilities(signal?: AbortSignal): Promise<GitGraphCapabilities>;
  getHistory(request?: GitGraphHistoryRequest): Promise<GitGraphPage>;
  getCommitDetails?(
    repositoryId: string | undefined,
    revision: GitGraphRevision,
    signal?: AbortSignal
  ): Promise<GitGraphCommitDetails>;
  compare?(
    repositoryId: string | undefined,
    base: GitGraphRevision,
    head: GitGraphRevision,
    signal?: AbortSignal
  ): Promise<GitGraphComparison>;
  getFileDiff?(
    repositoryId: string | undefined,
    base: GitGraphRevision,
    head: GitGraphRevision,
    path: string,
    context?: number,
    signal?: AbortSignal
  ): Promise<GitGraphFileDiff>;
}
