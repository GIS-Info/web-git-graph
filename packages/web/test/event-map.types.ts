import type { WebGitGraphElement } from "../src";
import type { WebGitGraphElementEventMap } from "../src/events";

declare const graph: WebGitGraphElement;

// P0 acceptance: event.detail is inferred from the event name, no casts.
graph.addEventListener("gitgraph-file-open", (event) => {
  const path: string = event.detail.change.path;
  const base: { kind: string } | undefined = event.detail.base;
  void path; void base;
});
graph.addEventListener("gitgraph-compare", (event) => {
  const additions: number = event.detail.additions;
  void additions;
});
graph.addEventListener("gitgraph-commit-select", (event) => {
  const oid: string = event.detail.commit.oid;
  void oid;
});
graph.addEventListener("gitgraph-refresh", (event) => {
  const id: string | undefined = event.detail.repositoryId;
  void id;
});
graph.removeEventListener("gitgraph-error", (event) => {
  const err: unknown = event.detail.error;
  void err;
});
// removeEventListener accepts the same typed handlers.
graph.removeEventListener("gitgraph-commit-open", (event) => {
  const oid: string = event.detail.commit.oid;
  void oid;
});
// Unknown event names still fall back to the untyped base signature.
graph.addEventListener("some-random-event", (event) => {
  const e: Event = event;
  void e;
});
// The event map maps every name to a CustomEvent<detail>.
const mapTest: WebGitGraphElementEventMap = {
  "gitgraph-commit-select": new CustomEvent("gitgraph-commit-select", { detail: {} as never }),
  "gitgraph-commit-open": new CustomEvent("gitgraph-commit-open", { detail: {} as never }),
  "gitgraph-compare": new CustomEvent("gitgraph-compare", { detail: {} as never }),
  "gitgraph-file-open": new CustomEvent("gitgraph-file-open", { detail: {} as never }),
  "gitgraph-load-more": new CustomEvent("gitgraph-load-more", { detail: {} as never }),
  "gitgraph-error": new CustomEvent("gitgraph-error", { detail: {} as never }),
  "gitgraph-refresh": new CustomEvent("gitgraph-refresh", { detail: {} as never }),
  "gitgraph-context-menu": new CustomEvent("gitgraph-context-menu", { detail: {} as never })
};
void mapTest;
