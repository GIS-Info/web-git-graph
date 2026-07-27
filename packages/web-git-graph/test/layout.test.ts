import { describe, expect, it } from "vitest";
import { layoutGitGraph } from "../src/layout";
import type { GitGraphCommit } from "../src/types";

const commit = (oid: string, parents: string[]): GitGraphCommit => ({
  oid,
  parents,
  message: oid,
  kind: "commit"
});

describe("layoutGitGraph", () => {
  it("keeps a linear history in one lane", () => {
    const layout = layoutGitGraph([
      commit("c", ["b"]),
      commit("b", ["a"]),
      commit("a", [])
    ]);

    expect(layout.nodes.map((node) => node.lane)).toEqual([0, 0, 0]);
    expect(layout.laneCount).toBe(1);
    expect(layout.state.lanes).toHaveLength(0);
  });

  it("allocates and rejoins a merge lane deterministically", () => {
    const commits = [
      commit("m", ["a", "b"]),
      commit("a", ["root"]),
      commit("b", ["root"]),
      commit("root", [])
    ];
    const first = layoutGitGraph(commits);
    const second = layoutGitGraph(commits);

    expect(first).toEqual(second);
    expect(first.laneCount).toBeGreaterThanOrEqual(2);
    expect(first.nodes.find((node) => node.oid === "b")?.lane).not.toBe(
      first.nodes.find((node) => node.oid === "a")?.lane
    );
    expect(first.segments.some((segment) => segment.from.lane !== segment.to.lane)).toBe(true);
  });

  it("preserves lane state when pages are appended", () => {
    const pageOne = layoutGitGraph([commit("m", ["a", "b"]), commit("a", ["root"])]);
    const pageTwo = layoutGitGraph([commit("b", ["root"]), commit("root", [])], {
      previous: pageOne.state
    });

    expect(pageTwo.nodes[0]?.row).toBe(2);
    expect(pageTwo.nodes[1]?.row).toBe(3);
    expect(pageTwo.state.lanes).toHaveLength(0);
  });

  it("retains dangling parents at a page boundary", () => {
    const layout = layoutGitGraph([commit("head", ["missing"])]);

    expect(layout.state.lanes).toEqual([
      expect.objectContaining({ target: "missing", lane: 0 })
    ]);
    expect(layout.segments.some((segment) => segment.dangling)).toBe(true);
  });

  it("supports octopus merges", () => {
    const layout = layoutGitGraph([
      commit("merge", ["a", "b", "c"]),
      commit("a", ["root"]),
      commit("b", ["root"]),
      commit("c", ["root"]),
      commit("root", [])
    ]);

    expect(layout.nodes).toHaveLength(5);
    expect(new Set(layout.nodes.slice(1, 4).map((node) => node.lane)).size).toBe(3);
  });
});
