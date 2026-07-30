import { describe, expect, it } from "vitest";
import {
  createGitGraphFetchHandler,
  type GitGraphBackend
} from "@web-git-graph/node";
import { HttpGitGraphProvider } from "@web-git-graph/web/providers/http";

const backend: GitGraphBackend = {
  async getCapabilities() {
    return {
      protocolVersion: "1",
      history: true,
      details: true,
      compare: true,
      diff: true,
      workingTree: false,
      stashes: false,
      maxPageSize: 100
    };
  },
  async listRepositories() {
    return [{ id: "repo", name: "Repository", bare: false }];
  },
  async getHistory(repositoryId) {
    return {
      commits: [
        {
          oid: "a".repeat(40),
          parents: [],
          message: "through every seam",
          kind: "commit"
        }
      ],
      refs: [],
      hasMore: false,
      repositoryId
    };
  },
  async getCommitDetails() {
    throw new Error("unused");
  },
  async compare(_repositoryId, base, head) {
    return { base, head, changes: [], additions: 0, deletions: 0 };
  },
  async getFileDiff(_repositoryId, base, head, path) {
    return { base, head, path, patch: "ok" };
  }
};

describe("Web → HTTP → Node adapter chain", () => {
  it("preserves protocol DTO semantics across both adapters", async () => {
    const handler = createGitGraphFetchHandler({ backend });
    const provider = new HttpGitGraphProvider({
      baseUrl: "http://graph.test",
      repositoryId: "repo",
      fetch: (input, init) => handler(new Request(input, init))
    });

    const page = await provider.getHistory({ limit: 10 });
    expect(page.repositoryId).toBe("repo");
    expect(page.commits[0]).toMatchObject({
      message: "through every seam",
      kind: "commit"
    });
  });
});
