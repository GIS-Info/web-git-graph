# Recipe: Bridge graph events to agent actions

**Intent:** Turn user interactions on the graph into agent tools, chat context, or host commands.

**When:** Coding-agent UIs that should open files, quote commits, compare revisions, or refresh after a tool run.

**Events** (bubbling `CustomEvent`s on `<web-git-graph>`):

| Event | `detail` | Notes |
| --- | --- | --- |
| `gitgraph-commit-select` | `{ commit }` | Selection changed |
| `gitgraph-commit-open` | `{ commit }` | Open / activate commit |
| `gitgraph-compare` | `GitGraphComparison` | After Ctrl/Cmd-click compare |
| `gitgraph-file-open` | `{ change, base?, head?, comparison? }` | Cancelable; host may open the file |
| `gitgraph-load-more` | `{ cursor? }` | Cancelable; default loads next page |
| `gitgraph-error` | `{ error }` | Provider / network failure |
| `gitgraph-refresh` | `{ repositoryId? }` | Cancelable; default reloads provider |
| `gitgraph-context-menu` | `{ commit, clientX, clientY }` | Cancelable; replace built-in menu |

**Example: feed agent context + open file in host:**

```ts
import "@web-git-graph/web/register";

const graph = document.querySelector("#history")!;

graph.addEventListener("gitgraph-commit-select", (event) => {
  const { commit } = event.detail;
  agent.setContext({
    kind: "git-commit",
    oid: commit.oid,
    subject: commit.message.split("\n", 1)[0],
    parents: commit.parents
  });
});

graph.addEventListener("gitgraph-file-open", (event) => {
  event.preventDefault(); // take over default diff fetch UI if desired
  const path = event.detail.change.path;
  host.openFile(path);
});

graph.addEventListener("gitgraph-context-menu", (event) => {
  event.preventDefault();
  host.showMenu({
    x: event.detail.clientX,
    y: event.detail.clientY,
    items: [
      {
        label: "Ask agent about this commit",
        run: () => agent.prompt(`Explain commit ${event.detail.commit.oid}`)
      },
      {
        label: "Copy OID",
        run: () => navigator.clipboard.writeText(event.detail.commit.oid)
      }
    ]
  });
});

// After an agent mutates the working tree via *other* tools, refresh the graph:
(graph as HTMLElement & { refresh(): void }).refresh();
```

**Refresh after agent Git tools:**

The component is read-only. If your agent runs `git commit` / checkout via separate tools, call `graph.refresh()` (keeps scroll + open commit) or re-assign `provider`. To fully replace refresh behavior, listen for `gitgraph-refresh` and `preventDefault()`.

**Pitfalls:**

- `gitgraph-refresh` and `gitgraph-context-menu` / `gitgraph-file-open` / `gitgraph-load-more` honor `preventDefault()` / cancelable dispatch — cancel only when you fully replace the default behavior.
- Compare requires the provider's `compare` method; otherwise the UI will not offer it.
