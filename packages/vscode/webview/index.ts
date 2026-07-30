import {
  GitGraphProtocolError,
  type GitGraphCapabilities,
  type GitGraphCommitDetails,
  type GitGraphComparison,
  type GitGraphFileDiff,
  type GitGraphPage,
  type GitGraphRepository,
  type GitGraphRevision
} from "@web-git-graph/protocol";
import type {
  GitGraphHistoryRequest,
  GitGraphProvider
} from "@web-git-graph/web";
import {
  defineWebGitGraph,
  type WebGitGraphElement
} from "@web-git-graph/web";
import type {
  GitGraphRpcMethod,
  GitGraphRpcMethods,
  GitGraphRpcResponse
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

window.addEventListener("message", (event: MessageEvent<GitGraphRpcResponse>) => {
  const response = event.data;
  const request = pending.get(response.id);
  if (!request) return;
  pending.delete(response.id);
  if ("error" in response) {
    request.reject(
      new GitGraphProtocolError(response.error.code, response.error.message, {
        retryable: response.error.retryable,
        details: response.error.details
      })
    );
  } else {
    request.resolve(response.result);
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
const state = vscode.getState() ?? {};

function applyTheme(): void {
  graph.theme = document.body.classList.contains("vscode-light") ? "light" : "dark";
}

function selectRepository(
  repositoryId: string,
  selectedOid?: string
): void {
  repositorySelect.value = repositoryId;
  graph.provider = new VsCodeGitGraphProvider(repositoryId);
  vscode.setState({ repositoryId, selectedOid });
}

const repositories = await rpc("repositories", {});
for (const repository of repositories) {
  const option = document.createElement("option");
  option.value = repository.id;
  option.textContent = repository.name;
  repositorySelect.append(option);
}

const initialRepository =
  repositories.find((repository: GitGraphRepository) => repository.id === state.repositoryId) ??
  repositories[0];
if (initialRepository) {
  selectRepository(initialRepository.id, state.selectedOid);
}

repositorySelect.addEventListener("change", () => selectRepository(repositorySelect.value));
graph.addEventListener("gitgraph-commit-select", (event) => {
  const commit = (event as CustomEvent<{ commit: { oid: string } }>).detail.commit;
  vscode.setState({ ...vscode.getState(), selectedOid: commit.oid });
});
graph.addEventListener("gitgraph-file-open", (event) => {
  const change = (event as CustomEvent<{ change: { path: string } }>).detail.change;
  const repositoryId = repositorySelect.value;
  if (repositoryId) void rpc("openFile", { repositoryId, path: change.path });
});

applyTheme();
new MutationObserver(applyTheme).observe(document.body, {
  attributes: true,
  attributeFilter: ["class"]
});
