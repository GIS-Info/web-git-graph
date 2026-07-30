import { randomBytes } from "node:crypto";
import { isAbsolute } from "node:path";
import * as vscode from "vscode";
import { GitGraphProtocolError } from "@web-git-graph/protocol";
import { LocalGitBackend } from "@web-git-graph/node";
import type {
  GitGraphRpcRequest,
  GitGraphRpcResponse
} from "./rpc";

const VIEW_TYPE = "webGitGraph.history";
const OPEN_COMMAND = "webGitGraph.open";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(OPEN_COMMAND, async () => {
      if (!vscode.workspace.isTrusted) {
        await vscode.window.showWarningMessage(
          "Trust this workspace before Web Git Graph can execute read-only Git commands."
        );
        return;
      }
      const folders = vscode.workspace.workspaceFolders ?? [];
      if (folders.length === 0) {
        await vscode.window.showInformationMessage(
          "Open a folder or workspace before launching Web Git Graph."
        );
        return;
      }

      const repositories = Object.fromEntries(
        folders.map((folder, index) => [`workspace-${index}`, folder.uri.fsPath])
      );
      const roots = folders.map((folder) => folder.uri.fsPath);
      const backend = new LocalGitBackend({
        repositories,
        allowedRoots: roots
      });
      const panel = vscode.window.createWebviewPanel(
        VIEW_TYPE,
        "Web Git Graph",
        vscode.ViewColumn.Active,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [
            vscode.Uri.joinPath(context.extensionUri, "dist", "webview")
          ]
        }
      );
      panel.webview.html = webviewHtml(panel.webview, context.extensionUri);
      panel.webview.onDidReceiveMessage(
        async (message) => {
          if (!isRpcRequest(message)) return;
          const response = await dispatchRpc(message, backend, folders);
          await panel.webview.postMessage(response);
        },
        undefined,
        context.subscriptions
      );
    })
  );
}

export function deactivate(): void {}

function isRpcRequest(value: unknown): value is GitGraphRpcRequest {
  if (!value || typeof value !== "object") return false;
  const request = value as Partial<GitGraphRpcRequest>;
  return (
    typeof request.id === "string" &&
    typeof request.method === "string" &&
    request.params !== null &&
    typeof request.params === "object"
  );
}

async function dispatchRpc(
  request: GitGraphRpcRequest,
  backend: LocalGitBackend,
  folders: readonly vscode.WorkspaceFolder[]
): Promise<GitGraphRpcResponse> {
  try {
    const result = await executeRpc(request, backend, folders);
    return {
      id: request.id,
      method: request.method,
      result
    } as GitGraphRpcResponse;
  } catch (error) {
    const resolved =
      error instanceof GitGraphProtocolError
        ? error
        : new GitGraphProtocolError(
            "internal_error",
            error instanceof Error ? error.message : "VS Code host request failed.",
            { cause: error }
          );
    return {
      id: request.id,
      method: request.method,
      error: resolved.toJSON().error
    };
  }
}

async function executeRpc(
  request: GitGraphRpcRequest,
  backend: LocalGitBackend,
  folders: readonly vscode.WorkspaceFolder[]
): Promise<unknown> {
  switch (request.method) {
    case "repositories":
      return backend.listRepositories();
    case "capabilities":
      return backend.getCapabilities();
    case "history":
      return backend.getHistory(request.params.repositoryId, request.params.query);
    case "details":
      return backend.getCommitDetails(
        request.params.repositoryId,
        request.params.revision
      );
    case "compare":
      return backend.compare(
        request.params.repositoryId,
        request.params.base,
        request.params.head
      );
    case "diff":
      return backend.getFileDiff(
        request.params.repositoryId,
        request.params.base,
        request.params.head,
        request.params.path,
        request.params.context
      );
    case "openFile": {
      const index = Number(request.params.repositoryId.replace(/^workspace-/, ""));
      const folder = folders[index];
      const path = request.params.path;
      if (
        !folder ||
        !path ||
        path.includes("\0") ||
        isAbsolute(path) ||
        path.split(/[\\/]/).includes("..")
      ) {
        throw new GitGraphProtocolError("bad_request", "Invalid workspace file path.");
      }
      const document = await vscode.workspace.openTextDocument(
        vscode.Uri.joinPath(folder.uri, ...path.split("/"))
      );
      await vscode.window.showTextDocument(document);
      return { opened: true };
    }
  }
}

function webviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const nonce = randomBytes(18).toString("base64");
  const script = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "dist", "webview", "webview.js")
  );
  const csp = [
    "default-src 'none'",
    `script-src 'nonce-${nonce}'`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `img-src ${webview.cspSource} https: data:`,
    `font-src ${webview.cspSource}`,
    `connect-src ${webview.cspSource}`
  ].join("; ");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <title>Web Git Graph</title>
  <style>
    html, body { height: 100%; margin: 0; background: var(--vscode-editor-background); }
    body { display: grid; grid-template-rows: 36px minmax(0, 1fr); color: var(--vscode-editor-foreground); }
    header { display: flex; align-items: center; gap: 8px; padding: 4px 8px; border-bottom: 1px solid var(--vscode-panel-border); }
    label { color: var(--vscode-descriptionForeground); font-size: 12px; }
    select { min-width: 220px; color: var(--vscode-dropdown-foreground); background: var(--vscode-dropdown-background); border: 1px solid var(--vscode-dropdown-border); }
    web-git-graph { min-height: 0; border: 0; }
  </style>
</head>
<body>
  <header>
    <label for="repository">Repository</label>
    <select id="repository" aria-label="Repository"></select>
  </header>
  <web-git-graph id="graph"></web-git-graph>
  <script type="module" nonce="${nonce}" src="${script.toString()}"></script>
</body>
</html>`;
}
