export type GitGraphCommitKind = "commit" | "working-tree" | "stash";
export type GitGraphRefKind = "head" | "remote" | "tag" | "stash" | "current";
export type GitGraphChangeKind =
  | "add"
  | "modify"
  | "delete"
  | "rename"
  | "copy"
  | "binary"
  | "submodule"
  | "unknown";

export interface GitGraphAuthor {
  name: string;
  email?: string;
  avatarUrl?: string;
}

export interface GitGraphCommit {
  oid: string;
  parents: readonly string[];
  message: string;
  kind: GitGraphCommitKind;
  author?: GitGraphAuthor;
  authoredAt?: string;
  committedAt?: string;
  url?: string;
  additions?: number;
  deletions?: number;
  changedFiles?: number;
  worktree?: {
    staged: number;
    unstaged: number;
    untracked: number;
  };
}

export interface GitGraphRef {
  name: string;
  target: string;
  kind: GitGraphRefKind;
  url?: string;
}

export type GitGraphRevision =
  | { kind: "commit"; oid: string }
  | { kind: "stash"; oid: string }
  | { kind: "working-tree" };

export interface GitGraphChange {
  path: string;
  previousPath?: string;
  kind: GitGraphChangeKind;
  additions?: number;
  deletions?: number;
  binary?: boolean;
  staged?: boolean;
  unavailableReason?: string;
}

export interface GitGraphCommitDetails {
  commit: GitGraphCommit;
  refs: readonly GitGraphRef[];
  changes: readonly GitGraphChange[];
  body?: string;
}

export interface GitGraphComparison {
  base: GitGraphRevision;
  head: GitGraphRevision;
  changes: readonly GitGraphChange[];
  additions: number;
  deletions: number;
  truncated?: boolean;
}

export interface GitGraphFileDiff {
  base: GitGraphRevision;
  head: GitGraphRevision;
  path: string;
  previousPath?: string;
  patch?: string;
  binary?: boolean;
  truncated?: boolean;
  unavailableReason?: string;
}

export interface GitGraphCapabilities {
  protocolVersion: "1";
  history: boolean;
  details: boolean;
  compare: boolean;
  diff: boolean;
  workingTree: boolean;
  stashes: boolean;
  maxPageSize: number;
  maxDiffBytes?: number;
}

export interface GitGraphHistoryQuery {
  ref?: string;
  /** Union of tips to walk. Takes precedence over `ref` when non-empty. */
  refs?: readonly string[];
  cursor?: string;
  limit?: number;
  includeWorkingTree?: boolean;
}

export interface GitGraphPage {
  commits: readonly GitGraphCommit[];
  refs: readonly GitGraphRef[];
  head?: string;
  cursor?: string;
  hasMore: boolean;
  repositoryId?: string;
  repositoryName?: string;
}

export interface GitGraphRepository {
  id: string;
  name: string;
  bare: boolean;
  head?: string;
}
