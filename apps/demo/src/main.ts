import "@fontsource-variable/archivo";
import "@fontsource-variable/recursive";
import "@web-git-graph/web/register";
import { GitHubGitGraphProvider } from "@web-git-graph/web/providers/github";
import { HttpGitGraphProvider } from "@web-git-graph/web/providers/http";
import type {
  GitGraphCommit,
  GitGraphPage,
  GitGraphRef
} from "@web-git-graph/protocol";
import type { WebGitGraphElement } from "@web-git-graph/web";
import "./style.css";

const graph = document.querySelector<WebGitGraphElement>("#graph")!;
const form = document.querySelector<HTMLFormElement>("#repo-form")!;
const repositoryInput = document.querySelector<HTMLInputElement>("#repository")!;
const status = document.querySelector<HTMLElement>("#status")!;

const commits: GitGraphCommit[] = [
  commit("a91de840", ["3f18d220", "be901ad0"], "Merge release/0.1 into main", "Mira Chen", "2026-07-27T08:18:00Z"),
  commit("3f18d220", ["86d41b10"], "docs: publish the protocol contract", "Mira Chen", "2026-07-27T07:48:00Z"),
  commit("be901ad0", ["7ae22f40", "42fb4110"], "Merge provider adapters", "Noah Kim", "2026-07-27T07:22:00Z"),
  commit("7ae22f40", ["86d41b10"], "feat(node): stream local commit objects", "Noah Kim", "2026-07-27T06:52:00Z"),
  commit("42fb4110", ["581b7c70"], "feat(web): add compare drawer", "Ari Santos", "2026-07-27T06:31:00Z"),
  commit("581b7c70", ["86d41b10"], "style: tune angular lane transitions", "Ari Santos", "2026-07-27T05:44:00Z"),
  commit("86d41b10", ["f10539a0"], "refactor: isolate layout state", "Mira Chen", "2026-07-26T17:13:00Z"),
  commit("f10539a0", ["8d68e2b0", "1ca829d0"], "Merge GitHub history loader", "Mira Chen", "2026-07-26T15:56:00Z"),
  commit("1ca829d0", ["ef7712c0"], "feat: preserve lanes across pages", "Noah Kim", "2026-07-26T15:12:00Z"),
  commit("8d68e2b0", ["ef7712c0"], "test: generate adversarial commit DAGs", "Ari Santos", "2026-07-26T14:38:00Z"),
  commit("ef7712c0", [], "Initial graph model", "Mira Chen", "2026-07-26T10:00:00Z")
];

const refs: GitGraphRef[] = [
  { name: "main", target: "a91de840", kind: "current" },
  { name: "refs/heads/main", target: "a91de840", kind: "head" },
  { name: "refs/heads/node-provider", target: "7ae22f40", kind: "head" },
  { name: "refs/heads/ui-compare", target: "42fb4110", kind: "head" },
  { name: "refs/tags/v0.1.0-rc.1", target: "3f18d220", kind: "tag" }
];

const fixture: GitGraphPage = {
  commits,
  refs,
  head: "a91de840",
  hasMore: false,
  repositoryId: "fixture",
  repositoryName: "web-git-graph / protocol-lab"
};

graph.data = fixture;

const query = new URLSearchParams(window.location.search);
const backendUrl = query.get("backend");
if (backendUrl) {
  const repositoryId = query.get("repository") ?? "local";
  graph.provider = new HttpGitGraphProvider({
    baseUrl: backendUrl,
    repositoryId
  });
  status.textContent = `Connected to ${backendUrl} · repository ${repositoryId}`;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const repository = repositoryInput.value.trim();
  if (!repository) return;
  status.textContent = `Connecting to github.com/${repository.replace(/^https?:\/\/github.com\//, "")}…`;
  graph.provider = new GitHubGitGraphProvider({ repository, pageSize: 80 });
  graph.addEventListener(
    "gitgraph-error",
    (error) => {
      const message = (error as CustomEvent<{ error: Error }>).detail.error.message;
      status.textContent = `GitHub API: ${message}`;
    },
    { once: true }
  );
  window.setTimeout(() => {
    status.textContent = "Tip: Ctrl/Cmd-click another commit to compare. Double-click to open the remote commit.";
  }, 900);
});

document.querySelector("#copy-install")?.addEventListener("click", async (event) => {
  await navigator.clipboard.writeText(
    "npm i @web-git-graph/web @web-git-graph/protocol"
  );
  (event.currentTarget as HTMLButtonElement).textContent = "COPIED";
});

function commit(
  oid: string,
  parents: string[],
  message: string,
  name: string,
  committedAt: string
): GitGraphCommit {
  return { oid, parents, message, author: { name }, committedAt, kind: "commit" };
}
