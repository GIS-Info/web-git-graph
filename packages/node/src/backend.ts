import { execFile, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { GitGraphProtocolError } from "@web-git-graph/protocol";
import type {
  GitGraphCapabilities,
  GitGraphChange,
  GitGraphCommit,
  GitGraphCommitDetails,
  GitGraphComparison,
  GitGraphFileDiff,
  GitGraphHistoryQuery,
  GitGraphPage,
  GitGraphRepository,
  GitGraphRevision,
  GitGraphRef
} from "@web-git-graph/protocol";

const execFileAsync = promisify(execFile);
const WORKTREE_OID = "__WORKTREE__";

export interface GitGraphBackend {
  getCapabilities(): Promise<GitGraphCapabilities>;
  listRepositories(signal?: AbortSignal): Promise<readonly GitGraphRepository[]>;
  getHistory(
    repositoryId: string,
    query?: GitGraphHistoryQuery,
    signal?: AbortSignal
  ): Promise<GitGraphPage>;
  getCommitDetails(
    repositoryId: string,
    revision: GitGraphRevision,
    signal?: AbortSignal
  ): Promise<GitGraphCommitDetails>;
  compare(
    repositoryId: string,
    base: GitGraphRevision,
    head: GitGraphRevision,
    signal?: AbortSignal
  ): Promise<GitGraphComparison>;
  getFileDiff(
    repositoryId: string,
    base: GitGraphRevision,
    head: GitGraphRevision,
    path: string,
    context?: number,
    signal?: AbortSignal
  ): Promise<GitGraphFileDiff>;
  getFileContent?(
    repositoryId: string,
    revision: GitGraphRevision,
    path: string,
    signal?: AbortSignal
  ): Promise<GitGraphFileContent>;
}

export interface GitGraphFileContent {
  revision: GitGraphRevision;
  path: string;
  content: string;
  binary: boolean;
  truncated: boolean;
}

export interface GitGraphSnapshot {
  id: string;
  repositoryId: string;
  tips: readonly string[];
  offset: number;
  createdAt: number;
}

export interface SnapshotStore {
  get(id: string): Promise<GitGraphSnapshot | undefined>;
  set(snapshot: GitGraphSnapshot): Promise<void>;
  delete(id: string): Promise<void>;
}

export class MemorySnapshotStore implements SnapshotStore {
  readonly #snapshots = new Map<string, GitGraphSnapshot>();
  readonly #ttlMs: number;
  readonly #maxEntries: number;

  constructor(options: { ttlMs?: number; maxEntries?: number } = {}) {
    this.#ttlMs = options.ttlMs ?? 15 * 60_000;
    this.#maxEntries = options.maxEntries ?? 100;
  }

  async get(id: string): Promise<GitGraphSnapshot | undefined> {
    const snapshot = this.#snapshots.get(id);
    if (!snapshot) return undefined;
    if (Date.now() - snapshot.createdAt > this.#ttlMs) {
      this.#snapshots.delete(id);
      return undefined;
    }
    return snapshot;
  }

  async set(snapshot: GitGraphSnapshot): Promise<void> {
    this.#snapshots.delete(snapshot.id);
    this.#snapshots.set(snapshot.id, snapshot);
    while (this.#snapshots.size > this.#maxEntries) {
      const oldest = this.#snapshots.keys().next().value as string | undefined;
      if (!oldest) break;
      this.#snapshots.delete(oldest);
    }
  }

  async delete(id: string): Promise<void> {
    this.#snapshots.delete(id);
  }
}

export interface LocalGitBackendOptions {
  repositories?: Record<string, string>;
  allowedRoots?: readonly string[];
  resolveRepository?: (
    repositoryId: string,
    signal?: AbortSignal
  ) => string | undefined | Promise<string | undefined>;
  gitBinary?: string;
  snapshotStore?: SnapshotStore;
  maxPageSize?: number;
  maxDiffBytes?: number;
  maxOutputBytes?: number;
  timeoutMs?: number;
  maxConcurrency?: number;
}

interface ResolvedRepository {
  id: string;
  path: string;
  name: string;
  bare: boolean;
  head?: string;
}

interface RawCommit {
  oid: string;
  parents: string[];
  message: string;
  author?: { name: string; email?: string };
  authoredAt?: string;
  committedAt?: string;
}

class Semaphore {
  #available: number;
  readonly #queue: Array<() => void> = [];

  constructor(count: number) {
    this.#available = Math.max(1, count);
  }

  async acquire(): Promise<() => void> {
    if (this.#available > 0) {
      this.#available -= 1;
      return () => this.release();
    }
    await new Promise<void>((resolveWait) => this.#queue.push(resolveWait));
    return () => this.release();
  }

  release(): void {
    const next = this.#queue.shift();
    if (next) next();
    else this.#available += 1;
  }
}

function isWithin(path: string, root: string): boolean {
  const value = relative(root, path);
  return value === "" || (!value.startsWith(`..${sep}`) && value !== ".." && !isAbsolute(value));
}

function encodeCursor(snapshotId: string, offset: number): string {
  return Buffer.from(JSON.stringify({ v: 1, snapshotId, offset }), "utf8").toString("base64url");
}

function decodeCursor(cursor: string): { snapshotId: string; offset: number } {
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      v?: number;
      snapshotId?: string;
      offset?: number;
    };
    if (
      value.v !== 1 ||
      typeof value.snapshotId !== "string" ||
      !Number.isInteger(value.offset) ||
      value.offset! < 0
    ) {
      throw new Error("Invalid cursor");
    }
    return { snapshotId: value.snapshotId, offset: value.offset! };
  } catch {
    throw new GitGraphProtocolError("bad_request", "Invalid pagination cursor.");
  }
}

function parseIdentity(value: string | undefined): {
  name: string;
  email?: string;
  date?: string;
} | undefined {
  if (!value) return undefined;
  const match = /^(.*) <([^>]*)> (\d+) ([+-]\d{4})$/.exec(value);
  if (!match) return { name: value };
  return {
    name: match[1] || "Unknown",
    ...(match[2] ? { email: match[2] } : {}),
    date: new Date(Number(match[3]) * 1000).toISOString()
  };
}

function parseRawCommit(oid: string, body: string): RawCommit {
  const separator = body.indexOf("\n\n");
  const header = separator >= 0 ? body.slice(0, separator) : body;
  const message = separator >= 0 ? body.slice(separator + 2).replace(/\n$/, "") : "";
  const headers = new Map<string, string[]>();
  let currentKey = "";
  for (const line of header.split("\n")) {
    if (line.startsWith(" ") && currentKey) continue;
    const space = line.indexOf(" ");
    if (space < 0) continue;
    currentKey = line.slice(0, space);
    const values = headers.get(currentKey) ?? [];
    values.push(line.slice(space + 1));
    headers.set(currentKey, values);
  }
  const author = parseIdentity(headers.get("author")?.[0]);
  const committer = parseIdentity(headers.get("committer")?.[0]);
  return {
    oid,
    parents: headers.get("parent") ?? [],
    message,
    ...(author
      ? {
          author: { name: author.name, ...(author.email ? { email: author.email } : {}) },
          ...(author.date ? { authoredAt: author.date } : {})
        }
      : {}),
    ...(committer?.date ? { committedAt: committer.date } : {})
  };
}

function mapStatus(status: string): GitGraphChange["kind"] {
  const code = status[0];
  if (code === "A" || code === "?") return "add";
  if (code === "D") return "delete";
  if (code === "R") return "rename";
  if (code === "C") return "copy";
  if (code === "M" || code === "T" || code === "U") return "modify";
  return "unknown";
}

function isFullOid(value: string): boolean {
  return /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(value);
}

export class LocalGitBackend implements GitGraphBackend {
  readonly #repositories: Record<string, string>;
  readonly #allowedRoots: readonly string[];
  readonly #resolver?: LocalGitBackendOptions["resolveRepository"];
  readonly #git: string;
  readonly #snapshots: SnapshotStore;
  readonly #maxPageSize: number;
  readonly #maxDiffBytes: number;
  readonly #maxOutputBytes: number;
  readonly #timeoutMs: number;
  readonly #semaphore: Semaphore;

  constructor(options: LocalGitBackendOptions = {}) {
    this.#repositories = options.repositories ?? {};
    this.#allowedRoots = options.allowedRoots?.map((root) => resolve(root)) ?? [];
    this.#resolver = options.resolveRepository;
    this.#git = options.gitBinary ?? "git";
    this.#snapshots = options.snapshotStore ?? new MemorySnapshotStore();
    this.#maxPageSize = Math.min(500, Math.max(1, options.maxPageSize ?? 200));
    this.#maxDiffBytes = Math.max(16_384, options.maxDiffBytes ?? 1_000_000);
    this.#maxOutputBytes = Math.max(this.#maxDiffBytes, options.maxOutputBytes ?? 8_000_000);
    this.#timeoutMs = Math.max(500, options.timeoutMs ?? 15_000);
    this.#semaphore = new Semaphore(options.maxConcurrency ?? 4);
  }

  async getCapabilities(): Promise<GitGraphCapabilities> {
    return {
      protocolVersion: "1",
      history: true,
      details: true,
      compare: true,
      diff: true,
      workingTree: true,
      stashes: true,
      maxPageSize: this.#maxPageSize,
      maxDiffBytes: this.#maxDiffBytes
    };
  }

  async listRepositories(signal?: AbortSignal): Promise<readonly GitGraphRepository[]> {
    const repositories: GitGraphRepository[] = [];
    for (const id of Object.keys(this.#repositories)) {
      const repository = await this.#resolveRepository(id, signal);
      repositories.push({
        id,
        name: repository.name,
        bare: repository.bare,
        ...(repository.head ? { head: repository.head } : {})
      });
    }
    return repositories;
  }

  async getHistory(
    repositoryId: string,
    request: GitGraphHistoryQuery = {},
    signal?: AbortSignal
  ): Promise<GitGraphPage> {
    const repository = await this.#resolveRepository(repositoryId, signal);
    const limit = Math.min(this.#maxPageSize, Math.max(1, request.limit ?? this.#maxPageSize));
    const refs = await this.#getRefs(repository, signal);
    const stashes = repository.bare
      ? { refs: [], auxiliaryOids: new Set<string>() }
      : await this.#getStashes(repository, signal);
    let snapshot: GitGraphSnapshot;
    let offset = 0;

    if (request.cursor) {
      const decoded = decodeCursor(request.cursor);
      const found = await this.#snapshots.get(decoded.snapshotId);
      if (!found || found.repositoryId !== repositoryId) {
        throw new GitGraphProtocolError(
          "snapshot_expired",
          "The history snapshot expired. Refresh the graph to continue.",
          { retryable: true }
        );
      }
      snapshot = found;
      offset = decoded.offset;
    } else {
      let tips: string[];
      const requested = request.refs?.length ? request.refs : request.ref ? [request.ref] : [];
      if (requested.length) {
        const targets = new Set<string>();
        for (const name of requested) {
          const matching = refs.find(
            (ref) =>
              ref.name === name ||
              ref.name.replace(/^refs\/(heads|tags|remotes)\//, "") === name
          );
          if (!matching) {
            throw new GitGraphProtocolError("revision_not_found", `Unknown ref: ${name}`);
          }
          targets.add(matching.target);
        }
        tips = [...targets];
      } else {
        tips = [
          ...new Set([...refs.map((ref) => ref.target), ...stashes.refs.map((stash) => stash.target)])
        ];
      }
      snapshot = {
        id: randomBytes(18).toString("base64url"),
        repositoryId,
        tips,
        offset: 0,
        createdAt: Date.now()
      };
      await this.#snapshots.set(snapshot);
    }

    const lines =
      snapshot.tips.length === 0
        ? []
        : (
            await this.#run(
              repository.path,
              [
                "rev-list",
                "--date-order",
                "--parents",
                `--max-count=${limit + 1}`,
                `--skip=${offset}`,
                ...snapshot.tips
              ],
              { signal }
            )
          ).stdout
            .trim()
            .split("\n")
            .filter(Boolean);
    const hasMore = lines.length > limit;
    const selected = lines.slice(0, limit);
    const oids = selected.map((line) => line.split(" ", 1)[0]!).filter(Boolean);
    const rawCommits = await this.#readCommits(repository.path, oids, signal);
    const stashByOid = new Map(stashes.refs.map((stash) => [stash.target, stash.name]));
    let commits: GitGraphCommit[] = rawCommits
      .filter((commit) => !stashes.auxiliaryOids.has(commit.oid))
      .map((commit) => ({
        oid: commit.oid,
        // A stash grafts onto its base commit only; the remaining parents are
        // the internal index/untracked commits that this page filters out.
        parents: stashByOid.has(commit.oid) ? commit.parents.slice(0, 1) : commit.parents,
        message: commit.message,
        kind: stashByOid.has(commit.oid) ? "stash" : "commit",
        ...(commit.author ? { author: commit.author } : {}),
        ...(commit.authoredAt ? { authoredAt: commit.authoredAt } : {}),
        ...(commit.committedAt ? { committedAt: commit.committedAt } : {})
      }));

    if (!request.cursor && request.includeWorkingTree !== false && !repository.bare && repository.head) {
      const status = await this.#getWorkingTreeChanges(repository, signal);
      if (status.changes.length) {
        commits = [
          {
            oid: WORKTREE_OID,
            parents: [repository.head],
            message: "Uncommitted changes",
            kind: "working-tree",
            committedAt: new Date().toISOString(),
            changedFiles: status.changes.length,
            worktree: status.counts
          },
          ...commits
        ];
      }
    }

    const nextOffset = offset + selected.length;
    return {
      commits,
      refs: [...refs, ...stashes.refs],
      ...(repository.head ? { head: repository.head } : {}),
      ...(hasMore ? { cursor: encodeCursor(snapshot.id, nextOffset) } : {}),
      hasMore,
      repositoryId,
      repositoryName: repository.name
    };
  }

  async getCommitDetails(
    repositoryId: string,
    revision: GitGraphRevision,
    signal?: AbortSignal
  ): Promise<GitGraphCommitDetails> {
    const repository = await this.#resolveRepository(repositoryId, signal);
    const refs = await this.#getRefs(repository, signal);
    if (revision.kind === "working-tree") {
      if (repository.bare || !repository.head) {
        throw new GitGraphProtocolError("unsupported", "This repository has no working tree.");
      }
      const status = await this.#getWorkingTreeChanges(repository, signal);
      return {
        commit: {
          oid: WORKTREE_OID,
          parents: [repository.head],
          message: "Uncommitted changes",
          kind: "working-tree",
          changedFiles: status.changes.length,
          worktree: status.counts
        },
        refs: [],
        changes: status.changes
      };
    }

    const oid = await this.#verifyOid(repository, revision.oid, signal);
    const [raw] = await this.#readCommits(repository.path, [oid], signal);
    if (!raw) {
      throw new GitGraphProtocolError("revision_not_found", `Commit ${oid} was not found.`);
    }
    const commit: GitGraphCommit = {
      oid: raw.oid,
      // Stash parents beyond the first are internal index/untracked commits.
      parents: revision.kind === "stash" ? raw.parents.slice(0, 1) : raw.parents,
      message: raw.message,
      kind: revision.kind,
      ...(raw.author ? { author: raw.author } : {}),
      ...(raw.authoredAt ? { authoredAt: raw.authoredAt } : {}),
      ...(raw.committedAt ? { committedAt: raw.committedAt } : {})
    };
    const head: GitGraphRevision = { kind: "commit", oid };
    const comparison = raw.parents[0]
      ? await this.compare(repositoryId, { kind: "commit", oid: raw.parents[0] }, head, signal)
      : await this.#compareWithArgs(
          repository,
          { kind: "commit", oid },
          head,
          [await this.#emptyTreeOid(repository, signal), oid],
          signal
        );
    return {
      commit: {
        ...commit,
        additions: comparison.additions,
        deletions: comparison.deletions,
        changedFiles: comparison.changes.length
      },
      refs: refs.filter((ref) => ref.target === oid),
      changes: comparison.changes,
      body: raw.message
    };
  }

  async compare(
    repositoryId: string,
    base: GitGraphRevision,
    head: GitGraphRevision,
    signal?: AbortSignal
  ): Promise<GitGraphComparison> {
    const repository = await this.#resolveRepository(repositoryId, signal);
    const args = await this.#diffRevisionArgs(repository, base, head, signal);
    return this.#compareWithArgs(repository, base, head, args, signal);
  }

  async #compareWithArgs(
    repository: ResolvedRepository,
    base: GitGraphRevision,
    head: GitGraphRevision,
    args: readonly string[],
    signal?: AbortSignal
  ): Promise<GitGraphComparison> {
    const [nameStatus, numstat] = await Promise.all([
      this.#run(repository.path, ["diff", "--no-ext-diff", "--no-textconv", "--name-status", "-z", "-M", "-C", ...args], {
        signal
      }),
      this.#run(repository.path, ["diff", "--no-ext-diff", "--no-textconv", "--numstat", "-z", "-M", "-C", ...args], {
        signal
      })
    ]);
    const changes = this.#parseNameStatus(nameStatus.stdout);
    const stats = this.#parseNumstat(numstat.stdout);
    for (const change of changes) {
      const stat = stats.get(change.path);
      if (stat) {
        change.additions = stat.additions;
        change.deletions = stat.deletions;
        change.binary = stat.binary;
      }
    }
    if (head.kind === "working-tree" && !repository.bare) {
      const worktree = await this.#getWorkingTreeChanges(repository, signal);
      for (const change of worktree.changes.filter((item) => item.kind === "add" && !changes.some((c) => c.path === item.path))) {
        changes.push(change);
      }
    }
    return {
      base,
      head,
      changes,
      additions: changes.reduce((sum, change) => sum + (change.additions ?? 0), 0),
      deletions: changes.reduce((sum, change) => sum + (change.deletions ?? 0), 0),
      truncated: changes.length >= 2_000
    };
  }

  async getFileDiff(
    repositoryId: string,
    base: GitGraphRevision,
    head: GitGraphRevision,
    path: string,
    context = 3,
    signal?: AbortSignal
  ): Promise<GitGraphFileDiff> {
    const repository = await this.#resolveRepository(repositoryId, signal);
    if (!path || path.includes("\0")) {
      throw new GitGraphProtocolError("bad_request", "A valid repository-relative file path is required.");
    }
    const args = await this.#diffRevisionArgs(repository, base, head, signal);
    const safeContext = Math.min(20, Math.max(0, Math.trunc(context)));
    const result = await this.#run(
      repository.path,
      [
        "diff",
        "--no-ext-diff",
        "--no-textconv",
        "--no-color",
        `--unified=${safeContext}`,
        ...args,
        "--",
        path
      ],
      { signal, maxBytes: this.#maxDiffBytes, allowTruncation: true }
    );
    return {
      base,
      head,
      path,
      ...(result.stdout
        ? { patch: result.stdout, ...(result.truncated ? { truncated: true } : {}) }
        : { unavailableReason: "No textual patch is available for this file." })
    };
  }

  async getFileContent(
    repositoryId: string,
    revision: GitGraphRevision,
    path: string,
    signal?: AbortSignal
  ): Promise<GitGraphFileContent> {
    const repository = await this.#resolveRepository(repositoryId, signal);
    if (!path || path.includes("\0")) {
      throw new GitGraphProtocolError("bad_request", "A valid repository-relative file path is required.");
    }
    if (revision.kind === "working-tree") {
      throw new GitGraphProtocolError(
        "unsupported",
        "Working-tree file contents must be read from the file system by the caller."
      );
    }
    const oid = await this.#verifyOid(repository, revision.oid, signal);
    const result = await this.#run(repository.path, ["show", `${oid}:${path}`], {
      signal,
      maxBytes: this.#maxDiffBytes,
      allowTruncation: true,
      allowFailure: true
    });
    if (result.code !== 0) {
      throw new GitGraphProtocolError(
        "revision_not_found",
        `${path} does not exist at ${oid}.`
      );
    }
    return {
      revision,
      path,
      content: result.stdout,
      binary: result.stdout.includes("\0"),
      truncated: result.truncated === true
    };
  }

  async #resolveRepository(id: string, signal?: AbortSignal): Promise<ResolvedRepository> {
    if (!id || id.includes("\0")) {
      throw new GitGraphProtocolError("bad_request", "Invalid repository id.");
    }
    const configured = this.#repositories[id] ?? (await this.#resolver?.(id, signal));
    if (!configured) {
      throw new GitGraphProtocolError(
        "repository_not_found",
        `Repository ${id} is not registered.`
      );
    }
    let path: string;
    try {
      path = await realpath(resolve(configured));
    } catch {
      throw new GitGraphProtocolError(
        "repository_not_found",
        `Repository ${id} is unavailable.`
      );
    }
    const allowedRoots = await Promise.all(this.#allowedRoots.map((root) => realpath(root).catch(() => resolve(root))));
    if (allowedRoots.length && !allowedRoots.some((root) => isWithin(path, root))) {
      throw new GitGraphProtocolError("forbidden", "Repository path is outside allowedRoots.");
    }
    try {
      const [bareResult, headResult] = await Promise.all([
        this.#run(path, ["rev-parse", "--is-bare-repository"], { signal }),
        this.#run(path, ["rev-parse", "--verify", "HEAD"], { signal, allowFailure: true })
      ]);
      return {
        id,
        path,
        name: path.split(sep).filter(Boolean).at(-1) ?? id,
        bare: bareResult.stdout.trim() === "true",
        ...(headResult.code === 0 ? { head: headResult.stdout.trim() } : {})
      };
    } catch (error) {
      if (error instanceof GitGraphProtocolError) throw error;
      throw new GitGraphProtocolError(
        "repository_not_found",
        `${path} is not a Git repository.`
      );
    }
  }

  async #getRefs(repository: ResolvedRepository, signal?: AbortSignal): Promise<GitGraphRef[]> {
    const result = await this.#run(
      repository.path,
      ["for-each-ref", "--format=%(refname)%09%(objectname)%09%(objecttype)", "refs/heads", "refs/remotes", "refs/tags"],
      { signal }
    );
    const refs: GitGraphRef[] = [];
    for (const line of result.stdout.split("\n")) {
      if (!line) continue;
      const [name, target] = line.split("\t");
      if (!name || !target) continue;
      refs.push({
        name,
        target,
        kind: name.startsWith("refs/heads/")
          ? "head"
          : name.startsWith("refs/remotes/")
            ? "remote"
            : "tag"
      });
    }
    if (repository.head) {
      const currentName = (
        await this.#run(repository.path, ["symbolic-ref", "--quiet", "--short", "HEAD"], {
          signal,
          allowFailure: true
        })
      ).stdout.trim();
      refs.unshift({ name: currentName || "HEAD", target: repository.head, kind: "current" });
    }
    return refs;
  }

  async #getStashes(
    repository: ResolvedRepository,
    signal?: AbortSignal
  ): Promise<{ refs: GitGraphRef[]; auxiliaryOids: Set<string> }> {
    const result = await this.#run(
      repository.path,
      ["stash", "list", "--format=%H%x09%P%x09%gd%x09%gs"],
      { signal, allowFailure: true }
    );
    const refs: GitGraphRef[] = [];
    // A stash commit's 2nd (index) and 3rd (untracked files) parents are
    // internal bookkeeping commits. They are reachable from the stash tip, so
    // rev-list would emit them as ordinary history rows unless excluded.
    const auxiliaryOids = new Set<string>();
    for (const line of result.stdout.split("\n").filter(Boolean)) {
      const [target, parents, selector, subject] = line.split("\t");
      if (!target) continue;
      refs.push({
        name: selector || subject || "stash",
        target,
        kind: "stash" as const
      });
      for (const parent of (parents ?? "").split(" ").filter(Boolean).slice(1)) {
        auxiliaryOids.add(parent);
      }
    }
    return { refs, auxiliaryOids };
  }

  async #getWorkingTreeChanges(
    repository: ResolvedRepository,
    signal?: AbortSignal
  ): Promise<{
    changes: GitGraphChange[];
    counts: { staged: number; unstaged: number; untracked: number };
  }> {
    const result = await this.#run(repository.path, ["status", "--porcelain=v2", "-z", "--untracked-files=all"], {
      signal
    });
    const records = result.stdout.split("\0");
    const changes: GitGraphChange[] = [];
    const counts = { staged: 0, unstaged: 0, untracked: 0 };
    for (let index = 0; index < records.length; index += 1) {
      const record = records[index]!;
      if (!record) continue;
      if (record.startsWith("? ")) {
        counts.untracked += 1;
        changes.push({
          path: record.slice(2),
          kind: "add",
          staged: false,
          unavailableReason: "Untracked file patches are not read automatically."
        });
        continue;
      }
      const type = record[0];
      if (type !== "1" && type !== "2" && type !== "u") continue;
      const fields = record.split(" ");
      const xy = fields[1] ?? "..";
      const pathIndex = type === "2" ? 9 : type === "1" ? 8 : 10;
      const path = fields.slice(pathIndex).join(" ");
      const previousPath = type === "2" ? records[++index] : undefined;
      const staged = xy[0] !== ".";
      const unstaged = xy[1] !== ".";
      if (staged) counts.staged += 1;
      if (unstaged) counts.unstaged += 1;
      changes.push({
        path,
        kind: mapStatus(staged ? xy[0]! : xy[1]!),
        staged,
        ...(previousPath ? { previousPath } : {})
      });
    }
    return { changes, counts };
  }

  async #verifyOid(
    repository: ResolvedRepository,
    oid: string,
    signal?: AbortSignal
  ): Promise<string> {
    if (!isFullOid(oid)) {
      throw new GitGraphProtocolError("bad_request", "Only full object ids returned by the provider are accepted.");
    }
    const result = await this.#run(repository.path, ["cat-file", "-e", `${oid}^{commit}`], {
      signal,
      allowFailure: true
    });
    if (result.code !== 0) {
      throw new GitGraphProtocolError("revision_not_found", `Commit ${oid} does not exist.`);
    }
    return oid.toLowerCase();
  }

  async #diffRevisionArgs(
    repository: ResolvedRepository,
    base: GitGraphRevision,
    head: GitGraphRevision,
    signal?: AbortSignal
  ): Promise<string[]> {
    if (base.kind === "working-tree") {
      throw new GitGraphProtocolError("unsupported", "The working tree cannot be the comparison base.");
    }
    const baseOid = await this.#verifyOid(repository, base.oid, signal);
    if (head.kind === "working-tree") {
      if (repository.bare) {
        throw new GitGraphProtocolError("unsupported", "A bare repository has no working tree.");
      }
      return [baseOid];
    }
    const headOid = await this.#verifyOid(repository, head.oid, signal);
    return [baseOid, headOid];
  }

  #parseNameStatus(output: string): GitGraphChange[] {
    const tokens = output.split("\0").filter(Boolean);
    const changes: GitGraphChange[] = [];
    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index]!;
      const tab = token.indexOf("\t");
      const status = tab >= 0 ? token.slice(0, tab) : token;
      let path = tab >= 0 ? token.slice(tab + 1) : tokens[++index] ?? "";
      let previousPath: string | undefined;
      if (status.startsWith("R") || status.startsWith("C")) {
        previousPath = path;
        path = tokens[++index] ?? "";
      }
      if (!path) continue;
      changes.push({
        path,
        kind: mapStatus(status),
        ...(previousPath ? { previousPath } : {})
      });
    }
    return changes;
  }

  #parseNumstat(output: string): Map<string, { additions: number; deletions: number; binary: boolean }> {
    const tokens = output.split("\0").filter(Boolean);
    const stats = new Map<string, { additions: number; deletions: number; binary: boolean }>();
    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index]!;
      const fields = token.split("\t");
      if (fields.length < 3) continue;
      const additions = fields[0]!;
      const deletions = fields[1]!;
      let path = fields.slice(2).join("\t");
      if (!path) {
        index += 1;
        index += 1;
        path = tokens[index] ?? "";
      }
      if (!path) continue;
      stats.set(path, {
        additions: additions === "-" ? 0 : Number(additions),
        deletions: deletions === "-" ? 0 : Number(deletions),
        binary: additions === "-" || deletions === "-"
      });
    }
    return stats;
  }

  async #emptyTreeOid(repository: ResolvedRepository, signal?: AbortSignal): Promise<string> {
    return (
      await this.#spawnWithInput(repository.path, ["hash-object", "-t", "tree", "--stdin"], "", signal)
    )
      .toString("utf8")
      .trim();
  }

  async #readCommits(path: string, oids: readonly string[], signal?: AbortSignal): Promise<RawCommit[]> {
    if (oids.length === 0) return [];
    const output = await this.#spawnWithInput(path, ["cat-file", "--batch"], `${oids.join("\n")}\n`, signal);
    const commits = new Map<string, RawCommit>();
    let offset = 0;
    while (offset < output.length) {
      const newline = output.indexOf(0x0a, offset);
      if (newline < 0) break;
      const header = output.subarray(offset, newline).toString("utf8");
      offset = newline + 1;
      const [oid, type, sizeText] = header.split(" ");
      const size = Number(sizeText);
      if (!oid || type !== "commit" || !Number.isFinite(size)) {
        throw new GitGraphProtocolError(
          "internal_error",
          `Unexpected git cat-file response: ${header}`
        );
      }
      const body = output.subarray(offset, offset + size).toString("utf8");
      offset += size + 1;
      commits.set(oid, parseRawCommit(oid, body));
    }
    return oids.map((oid) => commits.get(oid)).filter((value): value is RawCommit => Boolean(value));
  }

  async #spawnWithInput(
    path: string,
    args: readonly string[],
    input: string,
    signal?: AbortSignal
  ): Promise<Buffer> {
    const release = await this.#semaphore.acquire();
    try {
      return await new Promise<Buffer>((resolveOutput, reject) => {
        const child = spawn(this.#git, ["-C", path, ...args], {
          shell: false,
          stdio: ["pipe", "pipe", "pipe"]
        });
        const chunks: Buffer[] = [];
        const errors: Buffer[] = [];
        let size = 0;
        const timer = setTimeout(() => {
          child.kill("SIGKILL");
          reject(
            new GitGraphProtocolError("git_unavailable", "Git command timed out.", {
              retryable: true
            })
          );
        }, this.#timeoutMs);
        const abort = () => child.kill("SIGTERM");
        signal?.addEventListener("abort", abort, { once: true });
        child.stdout.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > this.#maxOutputBytes) child.kill("SIGKILL");
          else chunks.push(chunk);
        });
        child.stderr.on("data", (chunk: Buffer) => errors.push(chunk));
        child.on("error", (error) => reject(error));
        child.on("close", (code) => {
          clearTimeout(timer);
          signal?.removeEventListener("abort", abort);
          if (signal?.aborted) {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          } else if (size > this.#maxOutputBytes) {
            reject(
              new GitGraphProtocolError(
                "output_limit",
                "Git output exceeded the configured limit."
              )
            );
          } else if (code !== 0) {
            reject(
              new GitGraphProtocolError(
                "git_unavailable",
                Buffer.concat(errors).toString("utf8").trim() || "Git command failed."
              )
            );
          } else {
            resolveOutput(Buffer.concat(chunks));
          }
        });
        child.stdin.end(input);
      });
    } finally {
      release();
    }
  }

  async #run(
    path: string,
    args: readonly string[],
    options: {
      signal?: AbortSignal;
      maxBytes?: number;
      allowFailure?: boolean;
      allowTruncation?: boolean;
    } = {}
  ): Promise<{ stdout: string; stderr: string; code: number; truncated?: boolean }> {
    const release = await this.#semaphore.acquire();
    try {
      const maxBytes = options.maxBytes ?? this.#maxOutputBytes;
      try {
        const result = await execFileAsync(this.#git, ["-C", path, ...args], {
          encoding: "utf8",
          timeout: this.#timeoutMs,
          maxBuffer: maxBytes,
          signal: options.signal,
          windowsHide: true
        });
        return { stdout: result.stdout, stderr: result.stderr, code: 0 };
      } catch (error) {
        const value = error as NodeJS.ErrnoException & {
          code?: string | number;
          stdout?: string;
          stderr?: string;
          killed?: boolean;
        };
        if (options.allowTruncation && value.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
          return {
            stdout: (value.stdout ?? "").slice(0, maxBytes),
            stderr: value.stderr ?? "",
            code: 0,
            truncated: true
          };
        }
        if (options.allowFailure) {
          return {
            stdout: value.stdout ?? "",
            stderr: value.stderr ?? value.message,
            code: typeof value.code === "number" ? value.code : 1
          };
        }
        if (value.code === "ENOENT") {
          throw new GitGraphProtocolError(
            "git_unavailable",
            `Git executable not found: ${this.#git}`
          );
        }
        if (value.killed) {
          throw new GitGraphProtocolError("git_unavailable", "Git command timed out.", {
            retryable: true
          });
        }
        if (value.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
          throw new GitGraphProtocolError(
            "output_limit",
            "Git output exceeded the configured limit."
          );
        }
        throw new GitGraphProtocolError(
          "git_unavailable",
          (value.stderr ?? value.message).trim() || "Git command failed."
        );
      }
    } finally {
      release();
    }
  }
}
