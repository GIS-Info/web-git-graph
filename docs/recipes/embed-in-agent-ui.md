# Recipe: Embed Git history in an agent UI

**Intent:** Add a dense, virtualized commit graph beside a coding-agent chat, review surface, or IDE webview.

**When:** Building agent hosts, PR review tools, or repo explorers that must show commit DAG / refs / search without React-specific Git UI kits.

**Install:**

```bash
npm install @web-git-graph/web @web-git-graph/protocol
```

**Minimal host:**

```html
<web-git-graph id="history" theme="dark" density="compact"></web-git-graph>

<script type="module">
  import "@web-git-graph/web/register";
  import { GitHubGitGraphProvider } from "@web-git-graph/web/providers/github";

  const graph = document.querySelector("#history");
  graph.provider = new GitHubGitGraphProvider({
    repository: "owner/repo"
  });

  graph.addEventListener("gitgraph-commit-select", (event) => {
    // Feed the selected OID into your agent tool / context
    const { oid, message } = event.detail.commit;
    console.log(oid, message.split("\n", 1)[0]);
  });
</script>
```

**React (Web Component):**

```tsx
import "@web-git-graph/web/register";
import "@web-git-graph/web/jsx";
import { useEffect, useRef } from "react";
import { GitHubGitGraphProvider } from "@web-git-graph/web/providers/github";

export function AgentGitPanel({ repository }: { repository: string }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current as HTMLElement & { provider?: unknown };
    if (!el) return;
    el.provider = new GitHubGitGraphProvider({ repository });
  }, [repository]);

  return <web-git-graph ref={ref} theme="dark" style={{ height: "100%" }} />;
}
```

**Useful attributes:** `theme` (`light`|`dark`), `density`, `columns` (`date,author,commit`), `date-format`, `date-type`, `avatars`.

**Pitfalls:**

- Set `provider` as a property after mount; do not serialize it as an attribute.
- Give the element an explicit height (`100%` / flex child); virtualization needs a bounded viewport.
- For local repos, do not point the browser at filesystem paths — use the [HTTP backend recipe](./local-repo-http-backend.md).
