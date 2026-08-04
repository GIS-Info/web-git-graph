# Recipe: Public GitHub repository

**Intent:** Preview commit history for a public GitHub repo without running a Node backend.

**When:** Agent demos, documentation sites, or tools that only need remote public history.

**Install:**

```bash
npm install @web-git-graph/web @web-git-graph/protocol
```

**Code:**

```ts
import "@web-git-graph/web/register";
import { GitHubGitGraphProvider } from "@web-git-graph/web/providers/github";

const graph = document.querySelector("#history") as HTMLElement & {
  provider?: unknown;
};

graph.provider = new GitHubGitGraphProvider({
  repository: "GIS-Info/web-git-graph",
  // Optional: raise rate limits
  token: () => localStorage.getItem("github_pat") ?? undefined,
  pageSize: 50
});
```

**Options:**

| Option | Purpose |
| --- | --- |
| `repository` | `owner/repo` or `https://github.com/owner/repo` |
| `token` | string or async getter for a PAT |
| `fetch` | injectable `fetch` (tests / proxies) |
| `apiBaseUrl` | GitHub Enterprise API base |
| `pageSize` | page size for history fetches |

**Capabilities:** Working tree and stashes are disabled for GitHub (remote-only).

**Pitfalls:**

- Unauthenticated GitHub API rate limits are low; prompt for a PAT when `gitgraph-error` reports rate limiting.
- Private repos need a token with appropriate scope; never embed long-lived secrets in front-end bundles.
- This provider is for **history visualization**, not for mutating GitHub.
