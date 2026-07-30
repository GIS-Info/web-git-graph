import type { GitGraphCommit } from "@web-git-graph/protocol";

export interface GitGraphPoint {
  lane: number;
  row: number;
}

export interface GitGraphNode extends GitGraphPoint {
  oid: string;
  colour: number;
  kind: GitGraphCommit["kind"];
}

export interface GitGraphSegment {
  from: GitGraphPoint;
  to: GitGraphPoint;
  colour: number;
  dangling?: boolean;
}

export interface GitGraphLaneState {
  lane: number;
  target: string;
  colour: number;
  fromRow: number;
}

export interface GitGraphLayoutState {
  lanes: readonly GitGraphLaneState[];
  nextColour: number;
  rowOffset: number;
}

export interface GitGraphLayout {
  nodes: readonly GitGraphNode[];
  segments: readonly GitGraphSegment[];
  state: GitGraphLayoutState;
  laneCount: number;
}

export interface GitGraphLayoutOptions {
  previous?: GitGraphLayoutState;
}

interface MutableLane {
  lane: number;
  target: string;
  colour: number;
  fromRow: number;
}

function firstFreeLane(active: readonly MutableLane[], reserved: Set<number>): number {
  const occupied = new Set(active.map((lane) => lane.lane));
  let lane = 0;
  while (occupied.has(lane) || reserved.has(lane)) lane += 1;
  return lane;
}

/**
 * Computes a deterministic, compact Git lane layout.
 *
 * Input commits must be ordered child-before-parent. The implementation is
 * intentionally independent and only relies on the Git DAG invariants exposed
 * by the public data model.
 */
export function layoutGitGraph(
  commits: readonly GitGraphCommit[],
  options: GitGraphLayoutOptions = {}
): GitGraphLayout {
  const rowOffset = options.previous?.rowOffset ?? 0;
  const active: MutableLane[] = (options.previous?.lanes ?? []).map((lane) => ({ ...lane }));
  let nextColour = options.previous?.nextColour ?? 0;
  const nodes: GitGraphNode[] = [];
  const segments: GitGraphSegment[] = [];
  let maxLane = active.reduce((max, lane) => Math.max(max, lane.lane), -1);

  for (let localRow = 0; localRow < commits.length; localRow += 1) {
    const commit = commits[localRow]!;
    const row = rowOffset + localRow;
    const matching = active
      .filter((lane) => lane.target === commit.oid)
      .sort((a, b) => a.lane - b.lane);
    const reserved = new Set<number>();
    const primary = matching[0] ?? {
      lane: firstFreeLane(active, reserved),
      target: commit.oid,
      colour: nextColour++,
      fromRow: row
    };

    maxLane = Math.max(maxLane, primary.lane);
    nodes.push({
      oid: commit.oid,
      lane: primary.lane,
      row,
      colour: primary.colour,
      kind: commit.kind
    });

    for (const lane of active) {
      if (lane.target !== commit.oid) {
        segments.push({
          from: { lane: lane.lane, row: lane.fromRow },
          to: { lane: lane.lane, row },
          colour: lane.colour
        });
        lane.fromRow = row;
      }
    }

    for (const lane of matching) {
      segments.push({
        from: { lane: lane.lane, row: lane.fromRow },
        to: { lane: primary.lane, row },
        colour: lane.colour
      });
    }

    for (let index = active.length - 1; index >= 0; index -= 1) {
      if (active[index]!.target === commit.oid) active.splice(index, 1);
    }

    const parents = commit.parents.filter(Boolean);
    const firstParent = parents[0];
    if (firstParent) {
      active.push({
        lane: primary.lane,
        target: firstParent,
        colour: primary.colour,
        fromRow: row
      });
      reserved.add(primary.lane);
    }

    for (const parent of parents.slice(1)) {
      const existing = active.find((lane) => lane.target === parent);
      if (existing) {
        segments.push({
          from: { lane: primary.lane, row },
          to: { lane: existing.lane, row: row + 1 },
          colour: existing.colour
        });
        continue;
      }

      const lane = firstFreeLane(active, reserved);
      reserved.add(lane);
      maxLane = Math.max(maxLane, lane);
      const colour = nextColour++;
      active.push({ lane, target: parent, colour, fromRow: row });
      segments.push({
        from: { lane: primary.lane, row },
        to: { lane, row: row + 1 },
        colour
      });
    }
  }

  const endRow = rowOffset + commits.length;
  for (const lane of active) {
    if (lane.fromRow < endRow) {
      segments.push({
        from: { lane: lane.lane, row: lane.fromRow },
        to: { lane: lane.lane, row: endRow },
        colour: lane.colour,
        dangling: true
      });
      lane.fromRow = endRow;
    }
  }

  return {
    nodes,
    segments,
    state: {
      lanes: active.map((lane) => ({ ...lane })),
      nextColour,
      rowOffset: endRow
    },
    laneCount: Math.max(1, maxLane + 1)
  };
}
