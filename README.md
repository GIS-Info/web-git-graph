<p align="center">
  <img src="./apps/demo/public/brand/web-git-graph-logo.svg" width="96" alt="Web Git Graph logo" />
</p>

<h1 align="center">Web Git Graph</h1>

<p align="center">
  A framework-free, embeddable Git history graph for browsers, local repositories, and VS Code.<br />
  为浏览器、本地仓库与 VS Code 打造的零框架、可嵌入 Git 历史图。
</p>

<p align="center">
  <a href="https://gis-info.github.io/web-git-graph/"><strong>Live Demo / 在线演示</strong></a>
  · <a href="#english">English</a>
  · <a href="#中文">中文</a>
  · <a href="./docs/architecture/four-module-split-plan.md">Architecture</a>
  · <a href="./SECURITY.md">Security</a>
</p>

---

<a id="english"></a>

## English

Web Git Graph brings the dense, productive interaction model of desktop Git
history tools to any webpage. It provides a native Web Component, deterministic
lane layout, pluggable data providers, and a hardened read-only local Git
backend—without coupling the renderer to a framework or server language.

### Why Web Git Graph?

- **Framework-free:** use `<web-git-graph>` in plain HTML, React, Vue, Svelte,
  Angular, or any environment that supports Web Components.
- **Provider-driven:** read public GitHub repositories directly, connect an HTTP
  v1 backend, or serve a local repository through Node.
- **Desktop-grade interactions:** search, ref filtering, virtual scrolling,
  inline commit details, commit comparison, and lazy file diffs.
- **Backend-neutral protocol:** DTOs, JSON Schema, and OpenAPI remain separate
  from browser and Node runtime concerns.
- **Read-only by design:** no checkout, merge, rebase, reset, or other Git
  mutation is exposed.

### Live demo

Open the [interactive GitHub Pages demo](https://gis-info.github.io/web-git-graph/).
It includes fixture data, public GitHub repository loading, commit details,
comparison, search, bilingual content, and light/dark themes.

### Quick start

Install the browser renderer and shared protocol types:

```bash
npm install @web-git-graph/web @web-git-graph/protocol
```

Register the element and connect a provider:

```html
<web-git-graph id="history" theme="dark"></web-git-graph>

<script type="module">
  import "@web-git-graph/web/register";
  import { GitHubGitGraphProvider } from "@web-git-graph/web/providers/github";

  document.querySelector("#history").provider =
    new GitHubGitGraphProvider({
      repository: "GIS-Info/web-git-graph"
    });
</script>
```

Complex values are assigned as JavaScript properties. The custom element name
and provider API stay the same across frameworks.

### Architecture

```text
@web-git-graph/protocol
       ▲         ▲
       │         │
@web-git-graph/web   @web-git-graph/node
       ▲         ▲
       └────┬────┘
  web-git-graph (vscode)
```

| Module | Responsibility |
| --- | --- |
| `@web-git-graph/protocol` | Transport-neutral DTOs, schemas, protocol version, OpenAPI, and errors |
| `@web-git-graph/web` | Lane layout, Web Component, GitHub provider, and HTTP provider |
| `@web-git-graph/node` | Local Git backend, snapshot pagination, HTTP handlers, and read-only CLI |
| `web-git-graph` (VS Code) | VS Code Webview, typed RPC, and Extension Host integration |
| `@web-git-graph/demo` | Private GitHub Pages application and integration fixture |

The dependency graph is intentionally one-way. The protocol contains no DOM,
Node, HTTP-status, or VS Code types. The Web package contains no Node builtin,
and the Node package contains no renderer.

### Use a local repository

Start the read-only HTTP v1 backend:

```bash
npm install @web-git-graph/node
npx @web-git-graph/node serve --repo . \
  --cors-origin http://127.0.0.1:4173
```

Then connect the browser component:

```ts
import { HttpGitGraphProvider } from "@web-git-graph/web/providers/http";

graph.provider = new HttpGitGraphProvider({
  baseUrl: "http://127.0.0.1:4174",
  repositoryId: "local"
});
```

The CLI binds to `127.0.0.1:4174` by default. Browser clients only receive an
opaque `repositoryId`; local filesystem paths never cross the protocol seam.

### Events and theming

The component emits:

```text
gitgraph-commit-select   gitgraph-commit-open
gitgraph-compare         gitgraph-file-open
gitgraph-load-more       gitgraph-error
```

Use the `theme` and `density` properties plus `--wgg-*` CSS custom properties
to adapt the component to a host application.

### Development

Requires Node.js 20+ and pnpm 10.

```bash
pnpm install
pnpm check:boundaries
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
pnpm pack:check
```

---

<a id="中文"></a>

## 中文

Web Git Graph 将桌面 Git 历史工具中高密度、高效率的交互方式带到任意网页。
它提供原生 Web Component、确定性的泳道布局、可替换的数据 Provider，以及经过
安全约束的只读本地 Git 后端，同时不把渲染器绑定到任何前端框架或服务端语言。

### 为什么选择 Web Git Graph？

- **零框架依赖：** `<web-git-graph>` 可用于原生 HTML、React、Vue、Svelte、
  Angular，以及任何支持 Web Components 的环境。
- **Provider 驱动：** 可直接读取公开 GitHub 仓库、连接 HTTP v1 后端，或通过
  Node 提供本地 Git 仓库数据。
- **桌面级交互：** 支持搜索、ref 过滤、虚拟滚动、原位置展开提交详情、提交比较
  与按需文件 diff。
- **后端无关协议：** DTO、JSON Schema 与 OpenAPI 独立于浏览器和 Node 运行时。
- **只读设计：** 不暴露 checkout、merge、rebase、reset 等 Git 写操作。

### 在线演示

打开 [GitHub Pages 在线演示](https://gis-info.github.io/web-git-graph/)。
页面内置示例数据、公开 GitHub 仓库加载、提交详情、比较、搜索、中英文切换，
以及深色/浅色主题。

### 快速开始

安装浏览器渲染器和共享协议类型：

```bash
npm install @web-git-graph/web @web-git-graph/protocol
```

注册组件并连接 Provider：

```html
<web-git-graph id="history" theme="dark"></web-git-graph>

<script type="module">
  import "@web-git-graph/web/register";
  import { GitHubGitGraphProvider } from "@web-git-graph/web/providers/github";

  document.querySelector("#history").provider =
    new GitHubGitGraphProvider({
      repository: "GIS-Info/web-git-graph"
    });
</script>
```

复杂值通过 JavaScript 属性传入。无论宿主使用什么框架，自定义元素名称和
Provider API 都保持一致。

### 架构

```text
@web-git-graph/protocol
       ▲         ▲
       │         │
@web-git-graph/web   @web-git-graph/node
       ▲         ▲
       └────┬────┘
  web-git-graph (vscode)
```

| 模块 | 职责 |
| --- | --- |
| `@web-git-graph/protocol` | 与传输无关的 DTO、Schema、协议版本、OpenAPI 与错误类型 |
| `@web-git-graph/web` | 泳道布局、Web Component、GitHub Provider 与 HTTP Provider |
| `@web-git-graph/node` | 本地 Git 后端、快照分页、HTTP handlers 与只读 CLI |
| `web-git-graph`（VS Code） | VS Code Webview、类型化 RPC 与 Extension Host 集成 |
| `@web-git-graph/demo` | 私有 GitHub Pages 应用与集成测试样例 |

依赖方向保持单向：Protocol 不包含 DOM、Node、HTTP 状态码或 VS Code 类型；
Web 包不包含 Node builtin；Node 包也不包含任何渲染实现。

### 显示本地仓库

启动只读 HTTP v1 后端：

```bash
npm install @web-git-graph/node
npx @web-git-graph/node serve --repo . \
  --cors-origin http://127.0.0.1:4173
```

然后在浏览器端连接：

```ts
import { HttpGitGraphProvider } from "@web-git-graph/web/providers/http";

graph.provider = new HttpGitGraphProvider({
  baseUrl: "http://127.0.0.1:4174",
  repositoryId: "local"
});
```

CLI 默认监听 `127.0.0.1:4174`。浏览器只会接触不透明的 `repositoryId`，
本地文件路径永远不会跨越协议边界。

### 事件与主题

组件会发出以下事件：

```text
gitgraph-commit-select   gitgraph-commit-open
gitgraph-compare         gitgraph-file-open
gitgraph-load-more       gitgraph-error
```

可以通过 `theme`、`density` 属性以及 `--wgg-*` CSS 自定义属性适配宿主应用。

### 本地开发

需要 Node.js 20+ 与 pnpm 10。

```bash
pnpm install
pnpm check:boundaries
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
pnpm pack:check
```

## Clean-room implementation / 独立实现

The project is inspired by the density and interaction model of desktop Git
history tools, including VS Code Git Graph. Its protocol, layout, rendering,
providers, backend, and host integrations are independently implemented.

本项目借鉴桌面 Git 历史工具（包括 VS Code Git Graph）的信息密度与交互模型，
但协议、布局、渲染、Provider、后端与宿主集成均为独立实现。

## License / 许可证

MIT
