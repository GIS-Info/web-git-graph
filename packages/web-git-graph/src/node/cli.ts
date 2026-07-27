#!/usr/bin/env node
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
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
web-git-graph — read-only local Git history in your browser

Usage:
  web-git-graph serve --repo . [--port 4174] [--host 127.0.0.1]

The server is read-only and binds to loopback unless --host is explicitly set.
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
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("--port must be an integer between 1 and 65535.");
}

const backend = new LocalGitBackend({
  repositories: { local: repositoryPath },
  allowedRoots: [repositoryPath]
});
const api = createGitGraphNodeHandler({ backend });
const distDirectory = dirname(fileURLToPath(import.meta.url));

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Web Git Graph · Local</title>
  <style>
    html,body{height:100%;margin:0;background:#0c0f10}
    body{padding:18px;box-sizing:border-box}
    web-git-graph{height:calc(100vh - 36px)}
  </style>
</head>
<body>
  <web-git-graph theme="dark"></web-git-graph>
  <script type="module">
    import "/register.js";
    import { HttpGitGraphProvider } from "/http-provider.js";
    document.querySelector("web-git-graph").provider =
      new HttpGitGraphProvider({ baseUrl: location.origin, repositoryId: "local" });
  </script>
</body>
</html>`;

const server = createServer(async (request, response) => {
  const path = new URL(request.url ?? "/", `http://${request.headers.host ?? host}`).pathname;
  if (path.startsWith("/v1/")) {
    await api(request, response);
    return;
  }
  if (path === "/") {
    response.setHeader("content-type", "text/html; charset=utf-8");
    response.setHeader("content-security-policy", "default-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'");
    response.end(html);
    return;
  }
  const asset =
    path === "/register.js"
      ? resolve(distDirectory, "register.js")
      : path === "/http-provider.js"
        ? resolve(distDirectory, "providers/http.js")
        : undefined;
  if (!asset || !(await stat(asset).catch(() => undefined))) {
    response.statusCode = 404;
    response.end("Not found");
    return;
  }
  response.setHeader("content-type", "text/javascript; charset=utf-8");
  createReadStream(asset).pipe(response);
});

server.listen(port, host, () => {
  process.stdout.write(`Web Git Graph is reading ${repositoryPath}\n`);
  process.stdout.write(`Open http://${host}:${port}\n`);
  if (host !== "127.0.0.1" && host !== "::1" && host !== "localhost") {
    process.stdout.write("Warning: the read-only repository server is reachable beyond this machine.\n");
  }
});
