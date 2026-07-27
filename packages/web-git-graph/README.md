# web-git-graph

Framework-free Git history for any webpage, with a native Web Component,
deterministic commit-lane layout, GitHub and HTTP providers, and a read-only
local Node backend.

```bash
npm install web-git-graph
```

```html
<web-git-graph id="history" theme="dark"></web-git-graph>
<script type="module">
  import "web-git-graph/register";
  import { GitHubGitGraphProvider } from "web-git-graph/providers/github";

  document.querySelector("#history").provider =
    new GitHubGitGraphProvider({ repository: "kian-zh/web-git-graph" });
</script>
```

Read a local repository:

```bash
npx web-git-graph serve --repo .
```

Use `web-git-graph/node` to embed the local backend in native Node HTTP,
Express, Fastify, Nest, or Next.js. Use `web-git-graph/protocol` to implement
the same v1 protocol in any backend language.

Full documentation and examples:
[github.com/kian-zh/web-git-graph](https://github.com/kian-zh/web-git-graph)

MIT © kian-zh
