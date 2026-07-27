import {
  GIT_GRAPH_CONTENT_TYPE,
  GitGraphProtocolError,
  type GitGraphProtocolErrorBody
} from "../protocol";
import type {
  GitGraphCapabilities,
  GitGraphCommitDetails,
  GitGraphComparison,
  GitGraphFileDiff,
  GitGraphHistoryRequest,
  GitGraphPage,
  GitGraphProvider,
  GitGraphRepository,
  GitGraphRevision
} from "../types";

export interface HttpGitGraphProviderOptions {
  baseUrl: string;
  repositoryId?: string;
  fetch?: typeof globalThis.fetch;
  headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>);
}

export class HttpGitGraphProvider implements GitGraphProvider {
  readonly baseUrl: string;
  readonly repositoryId?: string;
  readonly #fetch: typeof globalThis.fetch;
  readonly #headers?: HttpGitGraphProviderOptions["headers"];

  constructor(options: HttpGitGraphProviderOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.repositoryId = options.repositoryId;
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.#headers = options.headers;
  }

  async getCapabilities(signal?: AbortSignal): Promise<GitGraphCapabilities> {
    return this.#request("/v1/capabilities", { signal });
  }

  async listRepositories(signal?: AbortSignal): Promise<readonly GitGraphRepository[]> {
    return this.#request("/v1/repositories", { signal });
  }

  async getHistory(request: GitGraphHistoryRequest = {}): Promise<GitGraphPage> {
    const repositoryId = request.repositoryId ?? this.repositoryId;
    if (!repositoryId) throw new TypeError("repositoryId is required");
    const query = new URLSearchParams();
    if (request.ref) query.set("ref", request.ref);
    if (request.cursor) query.set("cursor", request.cursor);
    if (request.limit) query.set("limit", String(request.limit));
    if (request.includeWorkingTree !== undefined) {
      query.set("includeWorkingTree", String(request.includeWorkingTree));
    }
    return this.#request(
      `/v1/repositories/${encodeURIComponent(repositoryId)}/history?${query.toString()}`,
      { signal: request.signal }
    );
  }

  async getCommitDetails(
    repositoryId: string | undefined,
    revision: GitGraphRevision,
    signal?: AbortSignal
  ): Promise<GitGraphCommitDetails> {
    const id = repositoryId ?? this.repositoryId;
    if (!id) throw new TypeError("repositoryId is required");
    const oid = revision.kind === "working-tree" ? "__WORKTREE__" : revision.oid;
    return this.#request(
      `/v1/repositories/${encodeURIComponent(id)}/commits/${encodeURIComponent(oid)}`,
      { signal }
    );
  }

  async compare(
    repositoryId: string | undefined,
    base: GitGraphRevision,
    head: GitGraphRevision,
    signal?: AbortSignal
  ): Promise<GitGraphComparison> {
    return this.#post(repositoryId, "compare", { base, head }, signal);
  }

  async getFileDiff(
    repositoryId: string | undefined,
    base: GitGraphRevision,
    head: GitGraphRevision,
    path: string,
    context = 3,
    signal?: AbortSignal
  ): Promise<GitGraphFileDiff> {
    return this.#post(repositoryId, "diff", { base, head, path, context }, signal);
  }

  async #post<T>(
    repositoryId: string | undefined,
    action: "compare" | "diff",
    body: unknown,
    signal?: AbortSignal
  ): Promise<T> {
    const id = repositoryId ?? this.repositoryId;
    if (!id) throw new TypeError("repositoryId is required");
    return this.#request(`/v1/repositories/${encodeURIComponent(id)}/${action}`, {
      method: "POST",
      body: JSON.stringify(body),
      signal
    });
  }

  async #request<T>(path: string, init: RequestInit): Promise<T> {
    const configured = typeof this.#headers === "function" ? await this.#headers() : this.#headers;
    const headers = new Headers(configured);
    headers.set("accept", GIT_GRAPH_CONTENT_TYPE);
    if (init.body) headers.set("content-type", "application/json");
    const response = await this.#fetch(`${this.baseUrl}${path}`, { ...init, headers });
    const body = (await response.json()) as T | GitGraphProtocolErrorBody;
    if (!response.ok) {
      const error = (body as GitGraphProtocolErrorBody).error;
      throw new GitGraphProtocolError(error?.code ?? "internal_error", error?.message ?? response.statusText, {
        status: response.status,
        retryable: error?.retryable ?? response.status >= 500,
        details: error?.details
      });
    }
    return body as T;
  }
}
