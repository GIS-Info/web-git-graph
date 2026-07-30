import { describe, expect, it } from "vitest";
import type { GitGraphRpcRequest } from "../src/rpc";

describe("VS Code RPC interface", () => {
  it("keeps repository paths out of webview requests", () => {
    const request: GitGraphRpcRequest = {
      id: "1",
      method: "history",
      params: {
        repositoryId: "workspace-0",
        query: { limit: 50, includeWorkingTree: true }
      }
    };

    expect(JSON.stringify(request)).not.toContain("/Users/");
    expect(request.params.repositoryId).toBe("workspace-0");
  });
});
