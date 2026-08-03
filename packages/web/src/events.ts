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
}
