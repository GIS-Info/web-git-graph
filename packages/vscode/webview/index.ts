import {
  GitGraphProtocolError,
  type GitGraphCapabilities,
  type GitGraphCommitDetails,
  type GitGraphComparison,
  type GitGraphFileDiff,
  type GitGraphPage,
  type GitGraphRevision
} from "@web-git-graph/protocol";
import type {
  GitGraphHistoryRequest,
  GitGraphProvider,
  WebGitGraphElementEventMap
} from "@web-git-graph/web";
import {
  defineWebGitGraph,
  type WebGitGraphElement
} from "@web-git-graph/web";
import type {
  GitGraphRpcMethod,
  GitGraphRpcMethods,
  GitGraphRpcServerMessage
} from "../src/rpc";

interface VsCodeState {
  repositoryId?: string;
  selectedOid?: string;
}

interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): VsCodeState | undefined;
  setState(state: VsCodeState): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

defineWebGitGraph();

const vscode = acquireVsCodeApi();
const pending = new Map<
  string,
  {
    resolve(value: unknown): void;
    reject(reason: unknown): void;
  }
>();
let sequence = 0;

window.addEventListener("message", (event: MessageEvent<GitGraphRpcServerMessage>) => {
  const message = event.data;
  if (!("id" in message)) {
    if (message.method === "refresh") void refresh();
    return;
  }
  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id);
  if ("error" in message) {
    request.reject(
      new GitGraphProtocolError(message.error.code, message.error.message, {
        retryable: message.error.retryable,
        details: message.error.details
      })
    );
  } else {
    request.resolve(message.result);
  }
});

function rpc<Method extends GitGraphRpcMethod>(
  method: Method,
  params: GitGraphRpcMethods[Method]["params"],
  signal?: AbortSignal
): Promise<GitGraphRpcMethods[Method]["result"]> {
  const id = `${Date.now().toString(36)}-${sequence++}`;
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("The operation was aborted.", "AbortError"));
      return;
    }
    const abort = () => {
      pending.delete(id);
      reject(new DOMException("The operation was aborted.", "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });
    pending.set(id, {
      resolve(value) {
        signal?.removeEventListener("abort", abort);
        resolve(value as GitGraphRpcMethods[Method]["result"]);
      },
      reject(reason) {
        signal?.removeEventListener("abort", abort);
        reject(reason);
      }
    });
    vscode.postMessage({ id, method, params });
  });
}

class VsCodeGitGraphProvider implements GitGraphProvider {
  constructor(readonly repositoryId: string) {}

  getCapabilities(signal?: AbortSignal): Promise<GitGraphCapabilities> {
    return rpc("capabilities", {}, signal);
  }

  async getHistory(request: GitGraphHistoryRequest = {}): Promise<GitGraphPage> {
    const { repositoryId: _repositoryId, signal, ...query } = request;
    const page = await rpc(
      "history",
      { repositoryId: this.repositoryId, query },
      signal
    );
    const savedState = vscode.getState();

    if (
      savedState?.repositoryId === this.repositoryId &&
      savedState.selectedOid &&
      page.commits.some((commit) => commit.oid === savedState.selectedOid)
    ) {
      window.setTimeout(() => {
        graph.selectCommit(savedState.selectedOid!);
        graph.focusCommit(savedState.selectedOid!);
      });
    }

    return page;
  }

  getCommitDetails(
    _repositoryId: string | undefined,
    revision: GitGraphRevision,
    signal?: AbortSignal
  ): Promise<GitGraphCommitDetails> {
    return rpc("details", { repositoryId: this.repositoryId, revision }, signal);
  }

  compare(
    _repositoryId: string | undefined,
    base: GitGraphRevision,
    head: GitGraphRevision,
    signal?: AbortSignal
  ): Promise<GitGraphComparison> {
    return rpc("compare", { repositoryId: this.repositoryId, base, head }, signal);
  }

  getFileDiff(
    _repositoryId: string | undefined,
    base: GitGraphRevision,
    head: GitGraphRevision,
    path: string,
    context = 3,
    signal?: AbortSignal
  ): Promise<GitGraphFileDiff> {
    return rpc(
      "diff",
      { repositoryId: this.repositoryId, base, head, path, context },
      signal
    );
  }
}

const graph = document.querySelector<WebGitGraphElement>("#graph")!;
const repositorySelect = document.querySelector<HTMLSelectElement>("#repository")!;

function applyTheme(): void {
  graph.theme = document.body.classList.contains("vscode-light") ? "light" : "dark";
}

function selectRepository(repositoryId: string, selectedOid?: string): void {
  repositorySelect.value = repositoryId;
  graph.provider = new VsCodeGitGraphProvider(repositoryId);
  vscode.setState({ repositoryId, selectedOid });
}

async function loadRepositories(): Promise<void> {
  const repositories = await rpc("repositories", {});
  const state = vscode.getState() ?? {};
  const preferred = repositorySelect.value || state.repositoryId;
  repositorySelect.replaceChildren();
  for (const repository of repositories) {
    const option = document.createElement("option");
    option.value = repository.id;
    option.textContent = repository.name;
    repositorySelect.append(option);
  }
  const target =
    repositories.find((repository) => repository.id === preferred) ?? repositories[0];
  if (target) selectRepository(target.id, state.selectedOid);
}

// Pushed by the extension host when .git changes, workspace folders change or
// workspace trust is granted. Reloading through loadRepositories keeps the
// repository list, the graph and the saved commit selection in sync.
async function refresh(): Promise<void> {
  try {
    await loadRepositories();
  } catch (error) {
    console.error("Web Git Graph refresh failed", error);
  }
}

repositorySelect.addEventListener("change", () => selectRepository(repositorySelect.value));
graph.addEventListener("gitgraph-commit-select", (event) => {
  const commit = (event as WebGitGraphElementEventMap["gitgraph-commit-select"]).detail.commit;
  vscode.setState({ ...vscode.getState(), selectedOid: commit.oid });
});
graph.addEventListener("gitgraph-file-open", (event) => {
  const detail = (event as WebGitGraphElementEventMap["gitgraph-file-open"]).detail;
  const repositoryId = repositorySelect.value;
  if (!repositoryId) return;
  // VS Code shows revision diffs in its native diff editor instead of the
  // component's inline patch view.
  event.preventDefault();
  const { change, base, head } = detail;
  if (base && head) {
    void rpc("openDiff", {
      repositoryId,
      path: change.path,
      ...(change.previousPath ? { previousPath: change.previousPath } : {}),
      kind: change.kind,
      ...(change.binary ? { binary: true } : {}),
      base,
      head
    });
  } else {
    // No diff context (e.g. a root commit): fall back to the working-tree file.
    void rpc("openFile", { repositoryId, path: change.path });
  }
});

applyTheme();
new MutationObserver(applyTheme).observe(document.body, {
  attributes: true,
  attributeFilter: ["class"]
});
await refresh();
