import type {
  GitGraphChange,
  GitGraphCommit,
  GitGraphComparison,
  GitGraphRevision
} from "@web-git-graph/protocol";

export interface WebGitGraphElementEventMap {
  "gitgraph-commit-select": CustomEvent<{ commit: GitGraphCommit }>;
  "gitgraph-commit-open": CustomEvent<{ commit: GitGraphCommit }>;
  "gitgraph-compare": CustomEvent<GitGraphComparison>;
  "gitgraph-file-open": CustomEvent<{
    change: GitGraphChange;
    base?: GitGraphRevision;
    head?: GitGraphRevision;
    comparison?: GitGraphComparison;
  }>;
  "gitgraph-load-more": CustomEvent<{ cursor?: string }>;
  "gitgraph-error": CustomEvent<{ error: unknown }>;
  /** Cancel to take over refreshing (the host may reload the data itself). */
  "gitgraph-refresh": CustomEvent<{ repositoryId?: string }>;
  /** Cancel to replace the built-in commit context menu with a host menu. */
  "gitgraph-context-menu": CustomEvent<{
    commit: GitGraphCommit;
    clientX: number;
    clientY: number;
  }>;
}
