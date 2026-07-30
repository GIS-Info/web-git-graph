#!/usr/bin/env node
import { createServer } from "node:http";
import { resolve } from "node:path";
import { OPENAPI_DOCUMENT } from "@web-git-graph/protocol/http";
import { LocalGitBackend } from "./backend";
import { createGitGraphNodeHandler } from "./handler";

const args = process.argv.slice(2);
const command = args[0] && !args[0].startsWith("-") ? args.shift() : "serve";

function option(name: string, fallback?: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
}

function printHelp(): void {
  process.stdout.write(`
@web-git-graph/node — read-only local Git graph backend

Usage:
  web-git-graph serve --repo . [--port 4174] [--host 127.0.0.1]
    [--cors-origin http://127.0.0.1:4173]

The command serves the HTTP v1 protocol. Connect with
@web-git-graph/web/providers/http from a browser host.
`);
}

if (command === "help" || args.includes("--help") || args.includes("-h")) {
  printHelp();
  process.exit(0);
}

if (command !== "serve") {
  process.stderr.write(`Unknown command: ${command}\n`);
  printHelp();
  process.exit(1);
}

const repositoryPath = resolve(option("--repo", ".")!);
const host = option("--host", "127.0.0.1")!;
const port = Number(option("--port", "4174"));
const corsOrigin = option("--cors-origin");
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("--port must be an integer between 1 and 65535.");
}

const backend = new LocalGitBackend({
  repositories: { local: repositoryPath },
  allowedRoots: [repositoryPath]
});
const api = createGitGraphNodeHandler({ backend });

const server = createServer(async (request, response) => {
  if (corsOrigin) {
    response.setHeader("access-control-allow-origin", corsOrigin);
    response.setHeader("vary", "origin");
  }
  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
    response.setHeader("access-control-allow-headers", "content-type, accept");
    response.end();
    return;
  }
  const path = new URL(request.url ?? "/", `http://${request.headers.host ?? host}`).pathname;
  if (path.startsWith("/v1/")) {
    await api(request, response);
    return;
  }
  if (path === "/openapi.json") {
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.end(JSON.stringify(OPENAPI_DOCUMENT));
    return;
  }
  if (path === "/") {
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.end(
      JSON.stringify({
        name: "@web-git-graph/node",
        readOnly: true,
        repositoryId: "local",
        protocol: "/v1/capabilities",
        openapi: "/openapi.json"
      })
    );
    return;
  }
  response.statusCode = 404;
  response.end("Not found");
});

server.listen(port, host, () => {
  process.stdout.write(`Web Git Graph API is reading ${repositoryPath}\n`);
  process.stdout.write(`Protocol endpoint: http://${host}:${port}/v1/capabilities\n`);
  if (host !== "127.0.0.1" && host !== "::1" && host !== "localhost") {
    process.stdout.write(
      "Warning: the read-only repository API is reachable beyond this machine.\n"
    );
  }
});
