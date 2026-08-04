#!/usr/bin/env node
/**
 * Build a static GitGraphPage snapshot from github.com/react/react so the demo
 * can render offline without burning the unauthenticated GitHub API quota.
 *
 * Prefers `gh api` when available; falls back to fetch + GITHUB_TOKEN / GH_TOKEN.
 * On network failure, leaves any existing fixture file untouched and exits 0 so
 * offline builds still succeed.
 */
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(__dirname, "../src/history-fixture.json");
const owner = "react";
const repo = "react";
const fullName = `${owner}/${repo}`;
const pageSize = 80;
const api = "https://api.github.com";

async function main() {
  try {
    const repository = await requestJson(`/repos/${owner}/${repo}`);
    const defaultBranch = repository.default_branch;
    const [commits, branches, tags] = await Promise.all([
      requestJson(
        `/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(defaultBranch)}&per_page=${pageSize}`
      ),
      requestJson(`/repos/${owner}/${repo}/branches?per_page=30`),
      requestJson(`/repos/${owner}/${repo}/tags?per_page=12`)
    ]);

    const mappedCommits = commits.map(toCommit);
    const headOid = mappedCommits[0]?.oid;
    const commitOids = new Set(mappedCommits.map((commit) => commit.oid));

    const refs = [
      {
        name: defaultBranch,
        target: headOid,
        kind: "current",
        url: `https://github.com/${fullName}/tree/${encodeURIComponent(defaultBranch)}`
      },
      {
        name: `refs/heads/${defaultBranch}`,
        target: headOid,
        kind: "head",
        url: `https://github.com/${fullName}/tree/${encodeURIComponent(defaultBranch)}`
      }
    ];

    for (const branch of branches) {
      if (branch.name === defaultBranch) continue;
      if (!commitOids.has(branch.commit.sha)) continue;
      refs.push({
        name: `refs/heads/${branch.name}`,
        target: branch.commit.sha,
        kind: "head",
        url: `https://github.com/${fullName}/tree/${encodeURIComponent(branch.name)}`
      });
      if (refs.filter((ref) => ref.kind === "head").length >= 8) break;
    }

    for (const tag of tags) {
      refs.push({
        name: `refs/tags/${tag.name}`,
        target: tag.commit.sha,
        kind: "tag",
        url: `https://github.com/${fullName}/releases/tag/${encodeURIComponent(tag.name)}`
      });
    }

    const page = {
      commits: mappedCommits,
      refs,
      head: headOid,
      hasMore: false,
      repositoryId: fullName,
      repositoryName: fullName
    };

    writeFileSync(outPath, `${JSON.stringify(page, null, 2)}\n`);
    process.stdout.write(
      `Wrote ${mappedCommits.length} commits · ${refs.length} refs from ${fullName} → ${outPath}\n`
    );
  } catch (error) {
    if (existsSync(outPath)) {
      process.stderr.write(
        `generate-history: using committed fixture (${error instanceof Error ? error.message : error})\n`
      );
      process.exit(0);
    }
    throw error;
  }
}

function toCommit(commit) {
  return {
    oid: commit.sha,
    parents: (commit.parents ?? []).map((parent) => parent.sha),
    message: commit.commit?.message ?? "",
    kind: "commit",
    author: {
      name: commit.commit?.author?.name ?? commit.author?.login ?? "Unknown",
      ...(commit.commit?.author?.email ? { email: commit.commit.author.email } : {}),
      ...(commit.author?.avatar_url ? { avatarUrl: commit.author.avatar_url } : {})
    },
    ...(commit.commit?.author?.date ? { authoredAt: commit.commit.author.date } : {}),
    ...(commit.commit?.committer?.date ? { committedAt: commit.commit.committer.date } : {}),
    url: commit.html_url
  };
}

async function requestJson(path) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || tryGhToken();
  if (canUseGh() && !process.env.FORCE_FETCH) {
    try {
      const stdout = execFileSync("gh", ["api", path.replace(/^\//, "")], {
        encoding: "utf8",
        maxBuffer: 32 * 1024 * 1024
      });
      return JSON.parse(stdout);
    } catch {
      // Fall through to fetch — useful in CI with GITHUB_TOKEN only.
    }
  }

  const response = await fetch(`${api}${path}`, {
    headers: {
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "web-git-graph-demo-fixture",
      ...(token ? { authorization: `Bearer ${token}` } : {})
    }
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub ${response.status} for ${path}: ${body.slice(0, 200)}`);
  }
  return response.json();
}

function canUseGh() {
  try {
    execFileSync("gh", ["auth", "status"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function tryGhToken() {
  try {
    return execFileSync("gh", ["auth", "token"], { encoding: "utf8" }).trim() || undefined;
  } catch {
    return undefined;
  }
}

await main();
