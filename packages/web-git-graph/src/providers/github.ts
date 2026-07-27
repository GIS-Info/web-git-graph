import { GitGraphProtocolError } from "../protocol";
import type {
  GitGraphCapabilities,
  GitGraphChange,
  GitGraphCommit,
  GitGraphCommitDetails,
  GitGraphComparison,
  GitGraphFileDiff,
  GitGraphHistoryRequest,
  GitGraphPage,
  GitGraphProvider,
  GitGraphRef,
  GitGraphRevision
} from "../types";

interface GitHubUser {
  login?: string;
  avatar_url?: string;
}

interface GitHubCommit {
  sha: string;
  html_url: string;
  parents: Array<{ sha: string }>;
  author?: GitHubUser | null;
  commit: {
    message: string;
    author?: { name?: string; email?: string; date?: string };
    committer?: { date?: string };
  };
  files?: GitHubFile[];
}

interface GitHubFile {
  filename: string;
  previous_filename?: string;
  status: string;
  additions?: number;
  deletions?: number;
  patch?: string;
}

interface GitHubRef {
  ref: string;
  object: { sha: string; type: "commit" | "tag" };
}

interface GitHubRepository {
  name: string;
  full_name: string;
  default_branch: string;
}

interface GitHubCompare {
  files?: GitHubFile[];
  total_commits?: number;
}

export interface GitHubGitGraphProviderOptions {
  repository: string;
  token?: string | (() => string | undefined | Promise<string | undefined>);
  fetch?: typeof globalThis.fetch;
  apiBaseUrl?: string;
  pageSize?: number;
}

function parseRepository(value: string): { owner: string; repo: string } {
  const normalized = value
    .trim()
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/\.git$/, "")
    .replace(/^\/+|\/+$/g, "");
  const [owner, repo, ...rest] = normalized.split("/");
  if (!owner || !repo || rest.length) throw new TypeError(`Invalid GitHub repository: ${value}`);
  return { owner, repo };
}

function toCommit(commit: GitHubCommit): GitGraphCommit {
  return {
    oid: commit.sha,
    parents: commit.parents.map((parent) => parent.sha),
    message: commit.commit.message,
    kind: "commit",
    author: {
      name: commit.commit.author?.name ?? commit.author?.login ?? "Unknown",
      ...(commit.commit.author?.email ? { email: commit.commit.author.email } : {}),
      ...(commit.author?.avatar_url ? { avatarUrl: commit.author.avatar_url } : {})
    },
    ...(commit.commit.author?.date ? { authoredAt: commit.commit.author.date } : {}),
    ...(commit.commit.committer?.date ? { committedAt: commit.commit.committer.date } : {}),
    url: commit.html_url,
    ...(commit.files
      ? {
          additions: commit.files.reduce((sum, file) => sum + (file.additions ?? 0), 0),
          deletions: commit.files.reduce((sum, file) => sum + (file.deletions ?? 0), 0),
          changedFiles: commit.files.length
        }
      : {})
  };
}

function changeKind(status: string): GitGraphChange["kind"] {
  if (status === "added") return "add";
  if (status === "removed") return "delete";
  if (status === "modified" || status === "changed") return "modify";
  if (status === "renamed") return "rename";
  if (status === "copied") return "copy";
  return "unknown";
}

function toChange(file: GitHubFile): GitGraphChange {
  return {
    path: file.filename,
    kind: changeKind(file.status),
    ...(file.previous_filename ? { previousPath: file.previous_filename } : {}),
    ...(file.additions !== undefined ? { additions: file.additions } : {}),
    ...(file.deletions !== undefined ? { deletions: file.deletions } : {}),
    ...(!file.patch ? { unavailableReason: "GitHub did not return a textual patch for this file." } : {})
  };
}

function cursor(page: number, ref: string): string {
  return `${page}:${encodeURIComponent(ref)}`;
}

function parseCursor(value: string | undefined, fallbackRef: string): { page: number; ref: string } {
  if (!value) return { page: 1, ref: fallbackRef };
  const separator = value.indexOf(":");
  const page = Number(value.slice(0, separator));
  const ref = decodeURIComponent(value.slice(separator + 1));
  if (!Number.isInteger(page) || page < 1 || !ref) {
    throw new GitGraphProtocolError("bad_request", "Invalid GitHub pagination cursor.");
  }
  return { page, ref };
}

function revisionOid(revision: GitGraphRevision): string {
  if (revision.kind === "working-tree") {
    throw new GitGraphProtocolError("unsupported", "GitHub has no working tree revision.");
  }
  return revision.oid;
}

export class GitHubGitGraphProvider implements GitGraphProvider {
  readonly owner: string;
  readonly repo: string;
  readonly #fetch: typeof globalThis.fetch;
  readonly #token?: GitHubGitGraphProviderOptions["token"];
  readonly #api: string;
  readonly #pageSize: number;
  #repository?: GitHubRepository;
  #refs?: GitGraphRef[];
  #comparisonCache = new Map<string, GitHubCompare>();

  constructor(options: GitHubGitGraphProviderOptions | string) {
    const resolved = typeof options === "string" ? { repository: options } : options;
    ({ owner: this.owner, repo: this.repo } = parseRepository(resolved.repository));
    this.#fetch = resolved.fetch ?? globalThis.fetch.bind(globalThis);
    this.#token = resolved.token;
    this.#api = (resolved.apiBaseUrl ?? "https://api.github.com").replace(/\/+$/, "");
    this.#pageSize = Math.min(100, Math.max(1, resolved.pageSize ?? 80));
  }

  async getCapabilities(): Promise<GitGraphCapabilities> {
    return {
      protocolVersion: "1",
      history: true,
      details: true,
      compare: true,
      diff: true,
      workingTree: false,
      stashes: false,
      maxPageSize: 100,
      maxDiffBytes: 1_000_000
    };
  }

  async getHistory(request: GitGraphHistoryRequest = {}): Promise<GitGraphPage> {
    const repository = await this.#getRepository(request.signal);
    const parsed = parseCursor(request.cursor, request.ref ?? repository.default_branch);
    const limit = Math.min(100, Math.max(1, request.limit ?? this.#pageSize));
    const commits = await this.#request<GitHubCommit[]>(
      `/repos/${this.owner}/${this.repo}/commits?sha=${encodeURIComponent(parsed.ref)}&per_page=${limit}&page=${parsed.page}`,
      request.signal
    );
    const refs = await this.#getRefs(request.signal);
    return {
      commits: commits.map(toCommit),
      refs,
      head: refs.find((ref) => ref.kind === "current")?.target,
      cursor: commits.length === limit ? cursor(parsed.page + 1, parsed.ref) : undefined,
      hasMore: commits.length === limit,
      repositoryId: repository.full_name,
      repositoryName: repository.full_name
    };
  }

  async getCommitDetails(
    _repositoryId: string | undefined,
    revision: GitGraphRevision,
    signal?: AbortSignal
  ): Promise<GitGraphCommitDetails> {
    const oid = revisionOid(revision);
    const commit = await this.#request<GitHubCommit>(
      `/repos/${this.owner}/${this.repo}/commits/${encodeURIComponent(oid)}`,
      signal
    );
    return {
      commit: toCommit(commit),
      refs: (await this.#getRefs(signal)).filter((ref) => ref.target === oid),
      changes: (commit.files ?? []).map(toChange),
      body: commit.commit.message
    };
  }

  async compare(
    _repositoryId: string | undefined,
    base: GitGraphRevision,
    head: GitGraphRevision,
    signal?: AbortSignal
  ): Promise<GitGraphComparison> {
    const baseOid = revisionOid(base);
    const headOid = revisionOid(head);
    const result = await this.#getComparison(baseOid, headOid, signal);
    const changes = (result.files ?? []).map(toChange);
    return {
      base,
      head,
      changes,
      additions: changes.reduce((sum, file) => sum + (file.additions ?? 0), 0),
      deletions: changes.reduce((sum, file) => sum + (file.deletions ?? 0), 0),
      truncated: (result.files?.length ?? 0) >= 300
    };
  }

  async getFileDiff(
    _repositoryId: string | undefined,
    base: GitGraphRevision,
    head: GitGraphRevision,
    path: string,
    _context = 3,
    signal?: AbortSignal
  ): Promise<GitGraphFileDiff> {
    const baseOid = revisionOid(base);
    const headOid = revisionOid(head);
    const result = await this.#getComparison(baseOid, headOid, signal);
    const file = result.files?.find((item) => item.filename === path);
    if (!file) {
      throw new GitGraphProtocolError("revision_not_found", `File ${path} is not part of this comparison.`, {
        status: 404
      });
    }
    return {
      base,
      head,
      path,
      ...(file.previous_filename ? { previousPath: file.previous_filename } : {}),
      ...(file.patch
        ? { patch: file.patch }
        : { unavailableReason: "GitHub omitted this patch because it is binary or too large." })
    };
  }

  async #getRepository(signal?: AbortSignal): Promise<GitHubRepository> {
    this.#repository ??= await this.#request<GitHubRepository>(
      `/repos/${this.owner}/${this.repo}`,
      signal
    );
    return this.#repository;
  }

  async #getRefs(signal?: AbortSignal): Promise<GitGraphRef[]> {
    if (this.#refs) return this.#refs;
    const [repository, heads, tags] = await Promise.all([
      this.#getRepository(signal),
      this.#request<GitHubRef[]>(`/repos/${this.owner}/${this.repo}/git/matching-refs/heads/`, signal),
      this.#request<GitHubRef[]>(`/repos/${this.owner}/${this.repo}/git/matching-refs/tags/`, signal)
    ]);
    const refs: GitGraphRef[] = [
      ...heads.map((ref) => ({
        name: ref.ref,
        target: ref.object.sha,
        kind: "head" as const,
        url: `https://github.com/${this.owner}/${this.repo}/tree/${encodeURIComponent(ref.ref.replace("refs/heads/", ""))}`
      })),
      ...tags.map((ref) => ({
        name: ref.ref,
        target: ref.object.sha,
        kind: "tag" as const,
        url: `https://github.com/${this.owner}/${this.repo}/releases/tag/${encodeURIComponent(ref.ref.replace("refs/tags/", ""))}`
      }))
    ];
    const defaultHead = refs.find((ref) => ref.name === `refs/heads/${repository.default_branch}`);
    if (defaultHead) refs.unshift({ ...defaultHead, name: repository.default_branch, kind: "current" });
    this.#refs = refs;
    return refs;
  }

  async #getComparison(base: string, head: string, signal?: AbortSignal): Promise<GitHubCompare> {
    const key = `${base}...${head}`;
    const cached = this.#comparisonCache.get(key);
    if (cached) return cached;
    const result = await this.#request<GitHubCompare>(
      `/repos/${this.owner}/${this.repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`,
      signal
    );
    this.#comparisonCache.set(key, result);
    return result;
  }

  async #request<T>(path: string, signal?: AbortSignal): Promise<T> {
    const token =
      typeof this.#token === "function" ? await this.#token() : this.#token;
    const response = await this.#fetch(`${this.#api}${path}`, {
      signal,
      headers: {
        accept: "application/vnd.github+json",
        "x-github-api-version": "2026-03-10",
        ...(token ? { authorization: `Bearer ${token}` } : {})
      }
    });
    if (!response.ok) {
      const reset = response.headers.get("x-ratelimit-reset");
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      const rateLimited = response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0";
      throw new GitGraphProtocolError(
        rateLimited ? "rate_limited" : response.status === 404 ? "repository_not_found" : "internal_error",
        body.message ?? response.statusText,
        {
          status: response.status,
          retryable: rateLimited || response.status >= 500,
          ...(reset ? { details: { resetAt: new Date(Number(reset) * 1000).toISOString() } } : {})
        }
      );
    }
    return (await response.json()) as T;
  }
}
