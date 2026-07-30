import { describe, expect, it, vi } from "vitest";
import { GitHubGitGraphProvider } from "../src/providers/github";
import { HttpGitGraphProvider } from "../src/providers/http";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

describe("browser provider adapters", () => {
  it("maps the HTTP transport onto the provider interface", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
      expect(String(input)).toBe("https://graph.test/v1/capabilities");
      return json({
        protocolVersion: "1",
        history: true,
        details: true,
        compare: true,
        diff: true,
        workingTree: false,
        stashes: false,
        maxPageSize: 100
      });
    });
    const provider = new HttpGitGraphProvider({
      baseUrl: "https://graph.test/",
      repositoryId: "repo",
      fetch
    });

    await expect(provider.getCapabilities()).resolves.toMatchObject({
      protocolVersion: "1",
      history: true
    });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("normalizes GitHub history into protocol DTOs", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith("/repos/acme/project")) {
        return json({ name: "project", full_name: "acme/project", default_branch: "main" });
      }
      if (url.includes("/commits?")) {
        return json([
          {
            sha: "a".repeat(40),
            html_url: "https://github.com/acme/project/commit/a",
            parents: [],
            commit: {
              message: "initial",
              author: { name: "Ada", date: "2026-01-01T00:00:00Z" },
              committer: { date: "2026-01-01T00:00:00Z" }
            }
          }
        ]);
      }
      if (url.endsWith("/git/matching-refs/heads/")) {
        return json([{ ref: "refs/heads/main", object: { sha: "a".repeat(40), type: "commit" } }]);
      }
      if (url.endsWith("/git/matching-refs/tags/")) return json([]);
      return json({ message: "not found" }, 404);
    });
    const provider = new GitHubGitGraphProvider({
      repository: "acme/project",
      fetch,
      pageSize: 10
    });

    const page = await provider.getHistory();
    expect(page.repositoryId).toBe("acme/project");
    expect(page.commits[0]).toMatchObject({ message: "initial", kind: "commit" });
    expect(page.refs[0]).toMatchObject({ name: "main", kind: "current" });
  });
});
