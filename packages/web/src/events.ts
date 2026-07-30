import type {
  GitGraphChange,
  GitGraphCommit,
  GitGraphComparison
} from "@web-git-graph/protocol";

export interface WebGitGraphElementEventMap {
  "gitgraph-commit-select": CustomEvent<{ commit: GitGraphCommit }>;
  "gitgraph-commit-open": CustomEvent<{ commit: GitGraphCommit }>;
  "gitgraph-compare": CustomEvent<GitGraphComparison>;
  "gitgraph-file-open": CustomEvent<{
    change: GitGraphChange;
    comparison?: GitGraphComparison;
  }>;
  "gitgraph-load-more": CustomEvent<{ cursor?: string }>;
  "gitgraph-error": CustomEvent<{ error: unknown }>;
}
