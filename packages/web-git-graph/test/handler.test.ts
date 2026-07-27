import { describe, expect, it } from "vitest";
import { createGitGraphFetchHandler } from "../src/node/handler";
import type { GitGraphBackend } from "../src/node/backend";

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
    return [{ id: "repo", name: "Repo", bare: false }];
  },
  async getHistory(repositoryId) {
    return {
      commits: [],
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

describe("protocol handlers", () => {
  const handler = createGitGraphFetchHandler({ backend });

  it("serves capabilities and repositories", async () => {
    const capabilities = await handler(new Request("http://localhost/v1/capabilities"));
    expect(capabilities.status).toBe(200);
    expect(await capabilities.json()).toMatchObject({ protocolVersion: "1" });

    const repositories = await handler(new Request("http://localhost/v1/repositories"));
    expect(await repositories.json()).toEqual([{ id: "repo", name: "Repo", bare: false }]);
  });

  it("keeps cursor and repository ids in typed history requests", async () => {
    const response = await handler(
      new Request("http://localhost/v1/repositories/repo/history?limit=25&cursor=abc")
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ repositoryId: "repo" });
  });

  it("returns a uniform protocol error", async () => {
    const response = await handler(new Request("http://localhost/nope"));
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      error: { code: "bad_request", retryable: false }
    });
  });
});
