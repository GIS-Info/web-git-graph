/** Synthetic multi-lane history used only by e2e geometry tests. */
function commit(
  oid: string,
  parents: string[],
  message: string,
  name: string,
  committedAt: string
) {
  return { oid, parents, message, author: { name }, committedAt, kind: "commit" as const };
}

export const multiLaneFixture = {
  commits: [
    commit("a91de840", ["3f18d220", "be901ad0"], "Merge release/0.1 into main", "Mira Chen", "2026-07-27T08:18:00Z"),
    commit("3f18d220", ["86d41b10"], "docs: publish the protocol contract", "Mira Chen", "2026-07-27T07:48:00Z"),
    commit("be901ad0", ["7ae22f40", "42fb4110"], "Merge provider adapters", "Noah Kim", "2026-07-27T07:22:00Z"),
    commit("7ae22f40", ["86d41b10"], "feat(node): stream local commit objects", "Noah Kim", "2026-07-27T06:52:00Z"),
    commit("42fb4110", ["581b7c70"], "feat(web): add compare drawer", "Ari Santos", "2026-07-27T06:31:00Z"),
    commit("581b7c70", ["86d41b10"], "style: tune angular lane transitions", "Ari Santos", "2026-07-27T05:44:00Z"),
    commit("86d41b10", ["f10539a0"], "refactor: isolate layout state", "Mira Chen", "2026-07-26T17:13:00Z"),
    commit("f10539a0", ["8d68e2b0", "1ca829d0"], "Merge GitHub history loader", "Mira Chen", "2026-07-26T15:56:00Z"),
    commit("1ca829d0", ["ef7712c0"], "feat: preserve lanes across pages", "Noah Kim", "2026-07-26T15:12:00Z"),
    commit("8d68e2b0", ["ef7712c0"], "test: generate adversarial commit DAGs", "Ari Santos", "2026-07-26T14:38:00Z"),
    commit("ef7712c0", [], "Initial graph model", "Mira Chen", "2026-07-26T10:00:00Z")
  ],
  refs: [
    { name: "main", target: "a91de840", kind: "current" as const },
    { name: "refs/heads/main", target: "a91de840", kind: "head" as const },
    { name: "refs/heads/node-provider", target: "7ae22f40", kind: "head" as const },
    { name: "refs/heads/ui-compare", target: "42fb4110", kind: "head" as const },
    { name: "refs/tags/v0.1.0-rc.1", target: "3f18d220", kind: "tag" as const }
  ],
  head: "a91de840",
  hasMore: false,
  repositoryId: "fixture",
  repositoryName: "web-git-graph / protocol-lab"
};
