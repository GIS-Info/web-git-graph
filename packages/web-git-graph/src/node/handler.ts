import type { IncomingMessage, ServerResponse } from "node:http";
import {
  GIT_GRAPH_CONTENT_TYPE,
  GitGraphProtocolError,
  type GitGraphCompareRequestBody,
  type GitGraphDiffRequestBody
} from "../protocol";
import type { GitGraphRevision } from "../types";
import type { GitGraphBackend } from "./backend";

export interface GitGraphRequestContext {
  request: Request;
  repositoryId?: string;
  principal?: unknown;
}

export interface GitGraphHandlerOptions {
  backend: GitGraphBackend;
  authorize?: (
    context: GitGraphRequestContext
  ) => boolean | unknown | Promise<boolean | unknown>;
  onRequest?: (context: GitGraphRequestContext) => void | Promise<void>;
  onError?: (error: unknown, context: GitGraphRequestContext) => void | Promise<void>;
}

function isRevision(value: unknown): value is GitGraphRevision {
  if (!value || typeof value !== "object" || !("kind" in value)) return false;
  const revision = value as { kind?: string; oid?: string };
  return revision.kind === "working-tree" || ((revision.kind === "commit" || revision.kind === "stash") && typeof revision.oid === "string");
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": GIT_GRAPH_CONTENT_TYPE,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

function errorResponse(error: unknown): Response {
  const resolved =
    error instanceof GitGraphProtocolError
      ? error
      : new GitGraphProtocolError(
          "internal_error",
          error instanceof Error ? error.message : "Internal server error.",
          { status: 500, retryable: true }
        );
  return json(resolved.toJSON(), resolved.status);
}

export function createGitGraphFetchHandler(options: GitGraphHandlerOptions) {
  return async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const segments = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    const repositoryIndex = segments.indexOf("repositories");
    const repositoryId = repositoryIndex >= 0 ? segments[repositoryIndex + 1] : undefined;
    const context: GitGraphRequestContext = { request, ...(repositoryId ? { repositoryId } : {}) };
    try {
      const authorized = await options.authorize?.(context);
      if (options.authorize && !authorized) {
        throw new GitGraphProtocolError("unauthorized", "The request is not authorized.", {
          status: 401
        });
      }
      if (authorized !== true && authorized !== false && authorized !== undefined) {
        context.principal = authorized;
      }
      await options.onRequest?.(context);
      if (segments[0] !== "v1") {
        throw new GitGraphProtocolError("bad_request", "Unknown protocol route.", { status: 404 });
      }
      if (request.method === "GET" && segments[1] === "capabilities") {
        return json(await options.backend.getCapabilities());
      }
      if (request.method === "GET" && segments[1] === "repositories" && segments.length === 2) {
        return json(await options.backend.listRepositories(request.signal));
      }
      if (!repositoryId) {
        throw new GitGraphProtocolError("bad_request", "A repository id is required.");
      }
      const action = segments[repositoryIndex + 2];
      if (request.method === "GET" && action === "history") {
        const limit = url.searchParams.get("limit");
        return json(
          await options.backend.getHistory(repositoryId, {
            ...(url.searchParams.get("ref") ? { ref: url.searchParams.get("ref")! } : {}),
            ...(url.searchParams.get("cursor") ? { cursor: url.searchParams.get("cursor")! } : {}),
            ...(limit ? { limit: Number(limit) } : {}),
            includeWorkingTree: url.searchParams.get("includeWorkingTree") !== "false",
            signal: request.signal
          })
        );
      }
      if (request.method === "GET" && action === "commits" && segments[repositoryIndex + 3]) {
        const oid = segments[repositoryIndex + 3]!;
        return json(
          await options.backend.getCommitDetails(
            repositoryId,
            oid === "__WORKTREE__" ? { kind: "working-tree" } : { kind: "commit", oid },
            request.signal
          )
        );
      }
      if (request.method === "POST" && (action === "compare" || action === "diff")) {
        const body = (await request.json()) as Partial<GitGraphCompareRequestBody & GitGraphDiffRequestBody>;
        if (!isRevision(body.base) || !isRevision(body.head)) {
          throw new GitGraphProtocolError("bad_request", "base and head revisions are required.");
        }
        if (action === "compare") {
          return json(await options.backend.compare(repositoryId, body.base, body.head, request.signal));
        }
        if (typeof body.path !== "string") {
          throw new GitGraphProtocolError("bad_request", "A file path is required.");
        }
        return json(
          await options.backend.getFileDiff(
            repositoryId,
            body.base,
            body.head,
            body.path,
            body.context,
            request.signal
          )
        );
      }
      throw new GitGraphProtocolError("bad_request", "Unknown protocol route.", { status: 404 });
    } catch (error) {
      await options.onError?.(error, context);
      return errorResponse(error);
    }
  };
}

async function readRequestBody(request: IncomingMessage, maxBytes: number): Promise<Uint8Array | undefined> {
  if (request.method === "GET" || request.method === "HEAD") return undefined;
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) {
      throw new GitGraphProtocolError("output_limit", "Request body is too large.", { status: 413 });
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

export function createGitGraphNodeHandler(
  options: GitGraphHandlerOptions & { maxRequestBytes?: number }
) {
  const fetchHandler = createGitGraphFetchHandler(options);
  return async function nodeHandler(request: IncomingMessage, response: ServerResponse): Promise<void> {
    try {
      const origin = `http://${request.headers.host ?? "localhost"}`;
      const body = await readRequestBody(request, options.maxRequestBytes ?? 64_000);
      const webRequest = new Request(new URL(request.url ?? "/", origin), {
        method: request.method,
        headers: request.headers as HeadersInit,
        ...(body ? { body, duplex: "half" } as RequestInit & { duplex: "half" } : {})
      });
      const webResponse = await fetchHandler(webRequest);
      response.statusCode = webResponse.status;
      webResponse.headers.forEach((value, key) => response.setHeader(key, value));
      response.end(Buffer.from(await webResponse.arrayBuffer()));
    } catch (error) {
      const webResponse = errorResponse(error);
      response.statusCode = webResponse.status;
      webResponse.headers.forEach((value, key) => response.setHeader(key, value));
      response.end(Buffer.from(await webResponse.arrayBuffer()));
    }
  };
}
