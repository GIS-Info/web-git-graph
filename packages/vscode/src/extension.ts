import { randomBytes } from "node:crypto";
import { access, readdir } from "node:fs/promises";
import { join } from "node:path";
import * as vscode from "vscode";
import { GitGraphProtocolError, type GitGraphRevision } from "@web-git-graph/protocol";
import { LocalGitBackend } from "@web-git-graph/node";
import { isSafeRelativePath } from "./paths";
import type { GitGraphRpcRequest, GitGraphRpcResponse, GitGraphViewConfig } from "./rpc";

const VIEW_TYPE = "webGitGraph.history";
const OPEN_COMMAND = "webGitGraph.open";
const DIFF_SCHEME = "web-git-graph";
const REFRESH_NOTIFICATION = { method: "refresh" } as const;
const CONFIG_NOTIFICATION = { method: "configChanged" } as const;

interface DetectedRepository {
  id: string;
  root: vscode.Uri;
  /** Shown in the repository picker; the folder name plus its relative path. */
  name: string;
}

interface HostSession {
  key: string;
  repositories: Map<string, DetectedRepository>;
  backend: LocalGitBackend;
}

let session: HostSession | undefined;
let currentPanel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
  statusBarItem.text = "$(git-branch) Web Git Graph";
  statusBarItem.tooltip = "View the Git history graph";
  statusBarItem.command = OPEN_COMMAND;
  const updateStatusBarItem = async () => {
    const enabled = vscode.workspace
      .getConfiguration("webGitGraph")
      .get<boolean>("showStatusBarItem", true);
    if (enabled && (await detectRepositories()).size > 0) statusBarItem.show();
    else statusBarItem.hide();
  };
  // Detects repositories created or removed after startup (e.g. git init).
  const headWatcher = vscode.workspace.createFileSystemWatcher("**/.git/HEAD");
  context.subscriptions.push(
    statusBarItem,
    headWatcher,
    headWatcher.onDidCreate(() => void updateStatusBarItem()),
    headWatcher.onDidDelete(() => void updateStatusBarItem()),
    vscode.workspace.onDidChangeWorkspaceFolders(() => void updateStatusBarItem()),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("webGitGraph.showStatusBarItem")) {
        void updateStatusBarItem();
      }
    })
  );
  void updateStatusBarItem();

  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(DIFF_SCHEME, diffContentProvider),
    vscode.commands.registerCommand(OPEN_COMMAND, async () => {
      if (!vscode.workspace.isTrusted) {
        await vscode.window.showWarningMessage(
          "Trust this workspace before Web Git Graph can execute read-only Git commands."
        );
        return;
      }
      if ((await detectRepositories()).size === 0) {
        await vscode.window.showInformationMessage(
          "Open a folder or workspace containing a Git repository before launching Web Git Graph."
        );
        return;
      }
      if (currentPanel) {
        currentPanel.reveal();
        return;
      }
      const panel = vscode.window.createWebviewPanel(
        VIEW_TYPE,
        "Web Git Graph",
        vscode.ViewColumn.Active,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "dist", "webview")]
        }
      );
      attachPanel(context, panel);
    }),
    vscode.window.registerWebviewPanelSerializer(VIEW_TYPE, {
      async deserializeWebviewPanel(panel: vscode.WebviewPanel) {
        attachPanel(context, panel);
      }
    })
  );
}

export function deactivate(): void {}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function looksLikeRepository(root: string): Promise<boolean> {
  if (await pathExists(join(root, ".git"))) return true;
  // A bare repository opened directly as a workspace folder.
  return (await pathExists(join(root, "HEAD"))) && (await pathExists(join(root, "objects")));
}

/** Directories that never contain a repository worth graphing, but do contain
 * enough entries to make an unbounded scan expensive. */
const SCAN_EXCLUDED = new Set([
  "node_modules",
  "bower_components",
  "vendor",
  "Pods",
  "dist",
  "out",
  "build",
  "target",
  "coverage",
  "__pycache__",
  "venv"
]);

async function scanForRepositories(
  folder: vscode.WorkspaceFolder,
  prefix: string,
  maxDepth: number,
  found: Map<string, DetectedRepository>
): Promise<void> {
  const walk = async (relative: string, depth: number): Promise<void> => {
    const segments = relative ? relative.split("/") : [];
    const absolute = relative ? join(folder.uri.fsPath, ...segments) : folder.uri.fsPath;
    if (await looksLikeRepository(absolute)) {
      const id = relative ? `${prefix}/${relative}` : prefix;
      found.set(id, {
        id,
        root: vscode.Uri.joinPath(folder.uri, ...segments),
        name: relative ? `${folder.name}/${relative}` : folder.name
      });
      // Nested repositories inside a repository (submodules, vendored clones)
      // are left to Git itself rather than listed as siblings.
      return;
    }
    if (depth >= maxDepth) return;
    const entries = await readdir(absolute, { withFileTypes: true }).catch(() => []);
    await Promise.all(
      entries
        .filter(
          (entry) =>
            entry.isDirectory() && !entry.name.startsWith(".") && !SCAN_EXCLUDED.has(entry.name)
        )
        .map((entry) => walk(relative ? `${relative}/${entry.name}` : entry.name, depth + 1))
    );
  };
  await walk("", 0);
}

/**
 * Ids stay tied to a workspace folder index plus the repository's path inside
 * it, so they survive a rescan and never carry an absolute path across the
 * webview seam. Folders without a repository are skipped, so one plain folder
 * in a multi-root workspace cannot break the repository listing.
 */
async function detectRepositories(): Promise<Map<string, DetectedRepository>> {
  const folders = vscode.workspace.workspaceFolders ?? [];
  const maxDepth = Math.min(
    6,
    Math.max(
      0,
      vscode.workspace.getConfiguration("webGitGraph").get<number>("maxDepthOfRepoSearch", 2)
    )
  );
  const found = new Map<string, DetectedRepository>();
  await Promise.all(
    folders.map((folder, index) =>
      scanForRepositories(folder, `workspace-${index}`, maxDepth, found)
    )
  );
  return found;
}

/**
 * The backend is derived from the detected repositories and rebuilt whenever
 * workspace folders change or a repository appears or disappears on disk.
 */
async function currentSession(): Promise<HostSession> {
  const folders = vscode.workspace.workspaceFolders ?? [];
  const repositories = await detectRepositories();
  const key = [...folders.map((folder) => folder.uri.toString()), ...repositories.keys()].join("\n");
  if (session?.key !== key) {
    session = {
      key,
      repositories,
      backend: new LocalGitBackend({
        // Nested repositories stay inside their workspace folder, so the folder
        // roots remain the whole allow-list.
        repositories: Object.fromEntries(
          [...repositories].map(([id, repository]) => [id, repository.root.fsPath])
        ),
        allowedRoots: folders.map((folder) => folder.uri.fsPath)
      })
    };
  }
  return session;
}

function viewConfig(): GitGraphViewConfig {
  const settings = vscode.workspace.getConfiguration("webGitGraph");
  const format = settings.get<string>("date.format", "datetime");
  const columns = settings.get<readonly string[]>("columns", ["date", "author", "commit"]);
  return {
    dateFormat: format === "date" || format === "relative" ? format : "datetime",
    dateType: settings.get<string>("date.type", "committed") === "authored" ? "authored" : "committed",
    columns: [...columns].join(","),
    avatars: settings.get<boolean>("fetchAvatars", false)
  };
}

function attachPanel(context: vscode.ExtensionContext, panel: vscode.WebviewPanel): void {
  currentPanel = panel;
  panel.webview.options = {
    enableScripts: true,
    localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "dist", "webview")]
  };
  panel.webview.html = webviewHtml(panel.webview, context.extensionUri);

  const subscriptions: vscode.Disposable[] = [];
  let watchers: vscode.Disposable[] = [];
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  // Git touches HEAD/index/refs in quick bursts; the debounce collapses one
  // operation into a single webview reload.
  const notifyRefresh = () => {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      void panel.webview.postMessage(REFRESH_NOTIFICATION);
    }, 400);
  };
  const watchRepositories = () => {
    for (const watcher of watchers) watcher.dispose();
    watchers = (vscode.workspace.workspaceFolders ?? []).map((folder) => {
      // `**` covers repositories nested inside the folder, not just its root.
      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(folder, "**/.git/{HEAD,ORIG_HEAD,index,refs/**}")
      );
      watcher.onDidChange(notifyRefresh);
      watcher.onDidCreate(notifyRefresh);
      watcher.onDidDelete(notifyRefresh);
      return watcher;
    });
  };
  watchRepositories();
  subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      watchRepositories();
      notifyRefresh();
    }),
    vscode.workspace.onDidGrantWorkspaceTrust(() => notifyRefresh()),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("webGitGraph.maxDepthOfRepoSearch")) notifyRefresh();
      else if (event.affectsConfiguration("webGitGraph")) {
        void panel.webview.postMessage(CONFIG_NOTIFICATION);
      }
    })
  );
  panel.webview.onDidReceiveMessage(
    async (message) => {
      if (!isRpcRequest(message)) return;
      const response = await dispatchRpc(message);
      await panel.webview.postMessage(response);
    },
    undefined,
    subscriptions
  );
  panel.onDidDispose(() => {
    if (refreshTimer) clearTimeout(refreshTimer);
    for (const watcher of watchers) watcher.dispose();
    for (const subscription of subscriptions) subscription.dispose();
    if (currentPanel === panel) currentPanel = undefined;
  });
}

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

async function dispatchRpc(request: GitGraphRpcRequest): Promise<GitGraphRpcResponse> {
  try {
    const result = await executeRpc(request);
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

async function executeRpc(request: GitGraphRpcRequest): Promise<unknown> {
  if (!vscode.workspace.isTrusted) {
    throw new GitGraphProtocolError(
      "forbidden",
      "Trust this workspace before Web Git Graph can execute read-only Git commands."
    );
  }
  const { backend, repositories } = await currentSession();
  switch (request.method) {
    case "config":
      return viewConfig();
    case "repositories": {
      const listed = await backend.listRepositories();
      // The backend names a repository after its own directory, which collides
      // between nested repositories; the detected display name disambiguates.
      return listed.map((repository) => ({
        ...repository,
        name: repositories.get(repository.id)?.name ?? repository.name
      }));
    }
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
      const repository = repositories.get(request.params.repositoryId);
      const path = request.params.path;
      if (!repository || !isSafeRelativePath(path)) {
        throw new GitGraphProtocolError("bad_request", "Invalid workspace file path.");
      }
      const document = await vscode.workspace.openTextDocument(
        vscode.Uri.joinPath(repository.root, ...path.split("/"))
      );
      await vscode.window.showTextDocument(document, { preview: true });
      return { opened: true };
    }
    case "openDiff": {
      const params = request.params;
      const repository = repositories.get(params.repositoryId);
      if (
        !repository ||
        !isSafeRelativePath(params.path) ||
        (params.previousPath !== undefined && !isSafeRelativePath(params.previousPath))
      ) {
        throw new GitGraphProtocolError("bad_request", "Invalid workspace file path.");
      }
      if (params.binary) {
        await vscode.window.showInformationMessage(
          `${params.path} is a binary file; no text diff is available.`
        );
        return { opened: false };
      }
      const basePath = params.previousPath ?? params.path;
      const left =
        params.kind === "add" || params.base.kind === "working-tree"
          ? emptyContentUri(basePath)
          : revisionContentUri(params.repositoryId, params.base.oid, basePath);
      const right =
        params.kind === "delete"
          ? emptyContentUri(params.path)
          : params.head.kind === "working-tree"
            ? vscode.Uri.joinPath(repository.root, ...params.path.split("/"))
            : revisionContentUri(params.repositoryId, params.head.oid, params.path);
      const title = `${params.path} (${revisionLabel(params.base)} ⟷ ${revisionLabel(params.head)})`;
      await vscode.commands.executeCommand("vscode.diff", left, right, title, {
        preview: true
      });
      return { opened: true };
    }
  }
}

function revisionLabel(revision: GitGraphRevision): string {
  return revision.kind === "working-tree" ? "Working Tree" : revision.oid.slice(0, 8);
}

interface DiffUriQuery {
  repositoryId?: string;
  oid?: string;
  path?: string;
  empty?: boolean;
}

function revisionContentUri(repositoryId: string, oid: string, path: string): vscode.Uri {
  return vscode.Uri.from({
    scheme: DIFF_SCHEME,
    // The uri path carries the file extension so the diff editor picks the
    // right language mode; the query carries what the provider needs.
    path: `/${path}`,
    query: JSON.stringify({ repositoryId, oid, path } satisfies DiffUriQuery)
  });
}

function emptyContentUri(path: string): vscode.Uri {
  return vscode.Uri.from({
    scheme: DIFF_SCHEME,
    path: `/${path}`,
    query: JSON.stringify({ empty: true } satisfies DiffUriQuery)
  });
}

const diffContentProvider: vscode.TextDocumentContentProvider = {
  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    let query: DiffUriQuery;
    try {
      query = JSON.parse(uri.query) as DiffUriQuery;
    } catch {
      return "";
    }
    if (query.empty || !query.repositoryId || !query.oid || !query.path) return "";
    const file = await (await currentSession()).backend.getFileContent(
      query.repositoryId,
      { kind: "commit", oid: query.oid },
      query.path
    );
    if (file.binary) return "(binary file)";
    return file.truncated ? `${file.content}\n… (content truncated)` : file.content;
  }
};

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
    body { display: grid; grid-template-rows: auto minmax(0, 1fr); color: var(--vscode-editor-foreground); }
    header { display: flex; align-items: center; gap: 8px; height: 36px; box-sizing: border-box; padding: 4px 8px; border-bottom: 1px solid var(--vscode-panel-border); }
    header[hidden] { display: none; }
    label { color: var(--vscode-descriptionForeground); font-size: 12px; }
    select { min-width: 220px; color: var(--vscode-dropdown-foreground); background: var(--vscode-dropdown-background); border: 1px solid var(--vscode-dropdown-border); }
    web-git-graph { min-height: 0; border: 0; }
  </style>
</head>
<body>
  <header hidden>
    <label for="repository">Repository</label>
    <select id="repository" aria-label="Repository"></select>
  </header>
  <web-git-graph id="graph"></web-git-graph>
  <script type="module" nonce="${nonce}" src="${script.toString()}"></script>
</body>
</html>`;
}
