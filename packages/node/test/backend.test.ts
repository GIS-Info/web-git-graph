import { execFile } from "node:child_process";
import { mkdtemp, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LocalGitBackend } from "../src/backend";

const exec = promisify(execFile);
let repository = "";
let backend: LocalGitBackend;
/** `backend` caps pages at 2 commits to exercise pagination; assertions about
 * which commits a walk reaches need the whole history in one page. */
let wide: LocalGitBackend;

async function git(...args: string[]): Promise<string> {
  return (await exec("git", ["-C", repository, ...args], { encoding: "utf8" })).stdout.trim();
}

describe("LocalGitBackend", () => {
  beforeAll(async () => {
    repository = await realpath(await mkdtemp(join(tmpdir(), "web-git-graph-")));
    await exec("git", ["init", "-b", "main", repository]);
    await git("config", "user.name", "Graph Test");
    await git("config", "user.email", "graph@example.test");
    await writeFile(join(repository, "README.md"), "# one\n");
    await git("add", "README.md");
    await git("commit", "-m", "initial");
    await git("switch", "-c", "feature");
    await writeFile(join(repository, "feature.txt"), "feature\n");
    await git("add", "feature.txt");
    await git("commit", "-m", "feature");
    await git("switch", "main");
    await writeFile(join(repository, "README.md"), "# two\n");
    await git("commit", "-am", "main change");
    await git("merge", "--no-ff", "feature", "-m", "merge feature");
    await writeFile(join(repository, "untracked.txt"), "local\n");
    backend = new LocalGitBackend({
      repositories: { test: repository },
      allowedRoots: [repository],
      maxPageSize: 2
    });
    wide = new LocalGitBackend({
      repositories: { test: repository },
      allowedRoots: [repository]
    });
  });

  afterAll(async () => {
    // Temporary fixtures are intentionally left to the operating system's
    // temporary-directory cleanup; no recursive deletion is performed here.
  });

  it("reads a paginated graph and working-tree pseudo commit", async () => {
    const first = await backend.getHistory("test", { limit: 2, includeWorkingTree: true });
    expect(first.commits[0]?.kind).toBe("working-tree");
    expect(first.commits.some((commit) => commit.parents.length === 2)).toBe(true);
    expect(first.hasMore).toBe(true);
    expect(first.cursor).toBeTruthy();

    const next = await backend.getHistory("test", { limit: 2, cursor: first.cursor });
    expect(next.commits.every((commit) => commit.kind !== "working-tree")).toBe(true);
  });

  it("returns details, comparison stats and a textual patch", async () => {
    const page = await backend.getHistory("test", { limit: 2, includeWorkingTree: false });
    const merge = page.commits[0]!;
    const details = await backend.getCommitDetails("test", { kind: "commit", oid: merge.oid });
    expect(details.commit.oid).toBe(merge.oid);

    const comparison = await backend.compare(
      "test",
      { kind: "commit", oid: merge.parents[0]! },
      { kind: "commit", oid: merge.oid }
    );
    expect(comparison.changes.some((change) => change.path === "feature.txt")).toBe(true);

    const diff = await backend.getFileDiff(
      "test",
      comparison.base,
      comparison.head,
      "feature.txt"
    );
    expect(diff.patch).toContain("feature.txt");
  });

  it("reads root commit details against Git's empty tree", async () => {
    const root = await git("rev-list", "--max-parents=0", "HEAD");
    const details = await backend.getCommitDetails("test", { kind: "commit", oid: root });
    expect(details.changes).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "README.md", kind: "add" })])
    );
    expect(details.commit.additions).toBeGreaterThan(0);
  });

  it("lists stashes without leaking index/untracked helper commits", async () => {
    await writeFile(join(repository, "README.md"), "# stashed\n");
    await git("add", "README.md");
    await writeFile(join(repository, "loose.txt"), "loose\n");
    await git("stash", "push", "--include-untracked", "-m", "wip");
    try {
      const stashOid = await git("rev-parse", "stash@{0}");
      const page = await wide.getHistory("test", { limit: 50, includeWorkingTree: false });

      const stash = page.commits.find((commit) => commit.oid === stashOid);
      expect(stash?.kind).toBe("stash");
      expect(stash?.parents).toHaveLength(1);
      expect(page.refs.some((ref) => ref.kind === "stash")).toBe(true);
      // The stash's index/untracked parents are reachable from the stash tip
      // but must never surface as ordinary history rows.
      expect(
        page.commits.filter((commit) => /^(index|untracked files) on /.test(commit.message))
      ).toEqual([]);

      const details = await backend.getCommitDetails("test", { kind: "stash", oid: stashOid });
      expect(details.commit.parents).toHaveLength(1);
    } finally {
      await git("stash", "pop");
      await git("restore", "--staged", "README.md");
      await git("checkout", "--", "README.md");
    }
  });

  it("walks the union of several refs and rejects unknown ones", async () => {
    const featureTip = await git("rev-parse", "feature");
    const single = await wide.getHistory("test", {
      limit: 50,
      ref: "feature",
      includeWorkingTree: false
    });
    expect(single.commits.some((commit) => commit.oid === featureTip)).toBe(true);
    // "main change" is only reachable from main, never from feature.
    expect(single.commits.some((commit) => commit.message === "main change")).toBe(false);

    const union = await wide.getHistory("test", {
      limit: 50,
      refs: ["feature", "refs/heads/main"],
      includeWorkingTree: false
    });
    expect(union.commits.some((commit) => commit.oid === featureTip)).toBe(true);
    expect(union.commits.some((commit) => commit.message === "main change")).toBe(true);

    await expect(
      backend.getHistory("test", { refs: ["feature", "no-such-branch"] })
    ).rejects.toMatchObject({ code: "revision_not_found" });
  });

  it("reads file contents at a specific revision", async () => {
    const head = await git("rev-parse", "HEAD");
    const file = await backend.getFileContent("test", { kind: "commit", oid: head }, "README.md");
    expect(file.content).toBe("# two\n");
    expect(file.binary).toBe(false);
    expect(file.truncated).toBe(false);

    await expect(
      backend.getFileContent("test", { kind: "commit", oid: head }, "missing.txt")
    ).rejects.toMatchObject({ code: "revision_not_found" });
    await expect(
      backend.getFileContent("test", { kind: "working-tree" }, "README.md")
    ).rejects.toMatchObject({ code: "unsupported" });
  });

  it("rejects paths outside allowedRoots and revision expressions", async () => {
    const denied = new LocalGitBackend({
      repositories: { denied: tmpdir() },
      allowedRoots: [repository]
    });
    await expect(denied.getHistory("denied")).rejects.toMatchObject({ code: "forbidden" });
    await expect(
      backend.getCommitDetails("test", { kind: "commit", oid: "HEAD~1" })
    ).rejects.toMatchObject({ code: "bad_request" });
  });
});
