# `@web-git-graph/*` 四模块与演示项目拆分计划

状态：Implemented locally（发布与 VSIX 安装验证待执行）  
日期：2026-07-30  
适用仓库：`web-git-graph`

## 1. 目标

将当前同时包含浏览器渲染、协议、Node Git 实现和 CLI 的
`web-git-graph` 包，拆分为统一 namespace 下的四个核心 module，并保留一个
独立的演示项目：

1. `@web-git-graph/protocol`
2. `@web-git-graph/web`
3. `@web-git-graph/node`
4. `@web-git-graph/vscode`
5. `@web-git-graph/demo`（私有演示项目，不是核心 module）

拆分后的目标不是增加目录数量，而是建立三个稳定 seam：

- 数据契约 seam：不同语言、进程和传输方式共享同一协议。
- 数据提供 seam：Web 可视化通过 provider adapter 获取数据。
- 宿主 seam：VS Code 只负责编辑器集成，不重新实现 Git 或图形逻辑。

每个 module 都必须是深 module：以较小的 interface 隐藏一类真实复杂性。
不创建只做转发、没有独立职责的浅 module。

演示项目是四个核心 module 的调用方、集成验证入口和线上展示站点。它不承载应当
进入核心 module 的生产实现。

## 2. 核心决策

### 2.1 统一命名

规范 workspace package 名称：

```text
@web-git-graph/protocol
@web-git-graph/web
@web-git-graph/node
@web-git-graph/vscode
@web-git-graph/demo
```

其中：

- `protocol`、`web`、`node` 发布到 npm。
- `vscode` 使用同一 package namespace 管理源码，但主要发布产物是 VSIX 和
  VS Code Marketplace 扩展；是否同时发布 npm 包不作为首期要求。
- `demo` 设置为 `private: true`，通过 GitHub Pages 等静态站点发布，不发布到
  npm。
- 当前项目尚未对外发布，不保留未加 scope 的 `web-git-graph` 兼容入口。

### 2.2 依赖方向

目标依赖图：

```text
                    @web-git-graph/protocol
                         ▲             ▲
                         │             │
              @web-git-graph/web   @web-git-graph/node
                    ▲    ▲             ▲
                    │    └──────┬──────┘
                    │           │
       @web-git-graph/demo  @web-git-graph/vscode
```

强制规则：

- `protocol` 不依赖其他三个 module。
- `web` 只依赖 `protocol`，不能依赖 Node 或 VS Code。
- `node` 只依赖 `protocol`，不能依赖 DOM、Web Component 或 VS Code。
- `vscode` 组合 `web`、`node` 和 `protocol`。
- `demo` 直接依赖 `web` 和 `protocol`；需要验证 Node 时通过 HTTP provider
  连接，不从浏览器 bundle 直接导入 `node`。
- `web` 与 `node` 之间不得直接依赖。
- 任何 package 都不得从另一个 package 的 `src/` 深层导入。

### 2.3 传输不是核心协议的一部分

HTTP JSON、VS Code `postMessage` 和进程内调用是不同 adapter。协议 module
定义数据和错误语义，但不要求调用方使用特定传输方式。

```text
Web Component
    │
    ├── GitHub provider adapter ── GitHub
    ├── HTTP provider adapter ──── Node HTTP handler
    └── VS Code RPC adapter ────── Extension Host
                                      │
                                      └── LocalGitBackend
```

## 3. 四个核心 module 与 demo 的职责

### 3.1 `@web-git-graph/protocol`

#### 隐藏的复杂性

- Git Graph 的共享领域数据。
- wire format 与 JSON Schema。
- 协议版本和 capability negotiation。
- 跨 transport 一致的错误语义。
- 向后兼容规则。

#### 对外 interface

首期导出：

```ts
export type {
  GitGraphAuthor,
  GitGraphCapabilities,
  GitGraphChange,
  GitGraphCommit,
  GitGraphCommitDetails,
  GitGraphComparison,
  GitGraphFileDiff,
  GitGraphHistoryRequest,
  GitGraphPage,
  GitGraphRef,
  GitGraphRepository,
  GitGraphRevision
};

export {
  GIT_GRAPH_CONTENT_TYPE,
  GIT_GRAPH_JSON_SCHEMAS,
  GIT_GRAPH_PROTOCOL_VERSION,
  GitGraphProtocolError,
  OPENAPI_DOCUMENT
};
```

#### 不应包含

- Web Component。
- DOM 类型。
- Git 子进程调用。
- Node HTTP handler。
- VS Code 类型。
- GitHub token 管理。
- 带 `AbortSignal` 等运行时控制参数的 UI provider interface。

`GitGraphProvider` 属于 Web module 的数据提供 seam，不属于 wire protocol。
`GitGraphBackend` 属于 Node module 的执行 seam，也不放入 protocol。

#### 迁入文件

从当前 package 迁移：

```text
src/types.ts            → packages/protocol/src/types.ts
src/protocol.ts         → packages/protocol/src/protocol.ts
src/protocol-schemas.ts → packages/protocol/src/protocol-schemas.ts
```

迁移时将运行时 port 从 DTO 中分离，避免 protocol 依赖某个宿主的执行模型。

### 3.2 `@web-git-graph/web`

#### 隐藏的复杂性

- commit DAG 与 lane layout。
- Web Component 生命周期。
- 虚拟滚动和大历史渲染。
- commit、ref、details、compare、diff 交互。
- 浏览器侧分页和取消。
- 主题、可访问性和宿主事件。

#### 对外 interface

核心入口：

```ts
export {
  WebGitGraphElement,
  defineWebGitGraph,
  layoutGitGraph
};

export type {
  GitGraphProvider,
  WebGitGraphElementEventMap
};
```

provider interface 保持小而稳定：

```ts
export interface GitGraphProvider {
  getCapabilities(signal?: AbortSignal): Promise<GitGraphCapabilities>;
  getHistory(request?: GitGraphHistoryRequest): Promise<GitGraphPage>;
  getCommitDetails?(...): Promise<GitGraphCommitDetails>;
  compare?(...): Promise<GitGraphComparison>;
  getFileDiff?(...): Promise<GitGraphFileDiff>;
}
```

只有真正存在第二个 adapter 时才扩展 interface。worktree、实时更新和写操作通过
capability 与可选 interface 演进，不把所有宿主能力强制塞入基础 provider。

#### 内置 adapter

首期继续提供：

```text
@web-git-graph/web/providers/github
@web-git-graph/web/providers/http
```

当某个 provider 获得独立依赖、发布节奏或维护者之后，再考虑拆成新 package；
首轮拆分不继续扩大 package 数量。

#### 不应包含

- `child_process`、`fs`、`path` 等 Node builtin。
- 本地仓库路径解析。
- Git 命令字符串。
- HTTP server。
- VS Code command ID。

#### 迁入文件

```text
src/layout.ts           → packages/web/src/layout.ts
src/web-component.ts    → packages/web/src/web-component.ts
src/register.ts         → packages/web/src/register.ts
src/providers/github.ts → packages/web/src/providers/github.ts
src/providers/http.ts   → packages/web/src/providers/http.ts
```

### 3.3 `@web-git-graph/node`

#### 隐藏的复杂性

- 安全调用 Git CLI。
- repository ID 到授权路径的解析。
- Git 输出解析。
- 分页 snapshot 和 cursor。
- 超时、并发和输出大小限制。
- commit details、compare、diff 和 working tree 状态。
- HTTP/Fetch/Node handler。
- CLI 生命周期。
- 后续的 worktree 枚举和文件监听。

#### 对外 interface

进程内执行：

```ts
export interface GitGraphBackend {
  getCapabilities(): Promise<GitGraphCapabilities>;
  listRepositories(...): Promise<readonly GitGraphRepository[]>;
  getHistory(...): Promise<GitGraphPage>;
  getCommitDetails(...): Promise<GitGraphCommitDetails>;
  compare(...): Promise<GitGraphComparison>;
  getFileDiff(...): Promise<GitGraphFileDiff>;
}

export class LocalGitBackend implements GitGraphBackend {}
```

transport adapter：

```ts
export {
  createGitGraphFetchHandler,
  createGitGraphNodeHandler
};
```

CLI：

```bash
npx @web-git-graph/node serve --repo .
```

VS Code extension 必须进程内使用 `LocalGitBackend`，不得为了复用而在用户机器上
额外启动 localhost HTTP server。

#### 不应包含

- Web Component 和 DOM。
- lane layout。
- VS Code workspace 或 command。
- 远程宿主 UI。
- 未经能力协商和安全预览的 Git mutation。

#### 迁入文件

```text
src/node/backend.ts     → packages/node/src/backend.ts
src/node/handler.ts     → packages/node/src/handler.ts
src/node/cli.ts         → packages/node/src/cli.ts
src/node/index.ts       → packages/node/src/index.ts
```

### 3.4 `@web-git-graph/vscode`

#### 隐藏的复杂性

- VS Code extension activation 和生命周期。
- workspace repository discovery。
- Webview 创建、恢复、CSP 与资源 URI。
- Webview 与 Extension Host 的 RPC。
- VS Code 主题同步。
- 打开文件、diff editor、terminal 和新窗口。
- repository/worktree watcher。
- command、context key、配置和 SecretStorage。

#### 运行模型

```text
VS Code Webview
└── @web-git-graph/web
    └── VsCodeGitGraphProvider
        │
        │ vscode.postMessage
        ▼
Extension Host
├── RPC request handler
├── @web-git-graph/node/LocalGitBackend
└── VS Code commands and workspace integration
```

`VsCodeGitGraphProvider` 是 Web 数据提供 seam 的 adapter；Extension Host RPC
handler 是同一 transport 的另一端。Git 读取与解析仍由 Node module 完成。

#### 首期功能

- 从当前 workspace 发现 Git repository。
- 打开 Git Graph Webview。
- history、details、compare 和 diff。
- 点击文件时调用 VS Code 打开文件或 diff editor。
- 跟随 VS Code 明暗主题。
- repository 变化后刷新当前 graph。
- 不包含 checkout、merge、rebase、reset 等 mutation。

#### 第二期能力

- `git worktree list --porcelain -z`。
- common repository 与 worktree 分组。
- worktree 路径、branch/detached HEAD、dirty、locked、prunable 状态。
- 打开 worktree 到当前窗口或新窗口。
- agent/task metadata adapter。
- CI、PR 和测试状态 enrichment。

### 3.5 `@web-git-graph/demo`

`demo` 是独立 workspace 应用，不是可复用 module。当前 `apps/demo` 已经实现了
首版，拆分工作以迁移依赖和强化集成验证为主，不重新开发一套展示界面。

#### 职责

- 展示 `<web-git-graph>` 的完整交互。
- 提供无需后端即可运行的内置 fixture。
- 演示公开 GitHub repository provider。
- 演示通过 HTTP provider 连接 Node backend。
- 承担浏览器 E2E、视觉回归和可访问性验证。
- 作为 GitHub Pages 的线上演示站点。
- 为 README 提供可复制的最小示例。

#### 强制规则

- `package.json` 使用 `"name": "@web-git-graph/demo"` 和 `"private": true`。
- 只能从各 package 的公开 exports 导入，不能深层导入 `src/`。
- 不实现 layout、Git 解析、协议转换等生产逻辑。
- fixture 必须与 protocol DTO 类型一致。
- GitHub Pages 构建不得包含 token、Node builtin 或本地 repository 路径。
- demo 中首先出现的新能力，在稳定后必须下沉到对应核心 module；demo 不成为
  隐藏的第五个实现。

#### 运行模式

```text
Fixture mode ────────────────┐
GitHub provider mode ────────┼── @web-git-graph/web
HTTP provider + Node backend ┘
```

## 4. 目标仓库结构

```text
web-git-graph/
├── apps/
│   └── demo/
├── packages/
│   ├── protocol/
│   │   ├── src/
│   │   ├── test/
│   │   └── package.json
│   ├── web/
│   │   ├── src/
│   │   ├── test/
│   │   └── package.json
│   ├── node/
│   │   ├── src/
│   │   ├── test/
│   │   └── package.json
│   └── vscode/
│   │   ├── src/
│   │   ├── webview/
│   │   ├── test/
│   │   └── package.json
├── e2e/
├── docs/
└── pnpm-workspace.yaml
```

## 5. 迁移原则

当前 `web-git-graph` 尚未对外推出，因此采用直接迁移：

- 不创建 compatibility package。
- 不保留旧 package 名称或 subpath re-export。
- 不增加 deprecated 入口。
- 不为旧 import path 编写兼容测试。
- 允许 workspace 内部 import 一次性切换到 `@web-git-graph/*`。
- 仍然保持现有用户可见行为、协议语义和测试基线，避免把拆包与功能重写混在一起。

## 6. 分阶段迁移

### Phase 0：冻结基线

目标：确保拆分只改变 module 位置，不改变用户可见行为。

- 记录当前 workspace 内部 exports 和行为基线。
- 保留现有 typecheck、unit、build、pack 和 Playwright 结果。
- 为 GitHub provider、HTTP provider 和 Node handler 补齐 interface 级测试。
- 建立 package dependency 检查，禁止循环依赖和深层导入。

完成条件：

- 当前所有测试通过。
- 当前 demo 的 fixture 与 GitHub provider 模式可作为迁移对照。
- 当前 npm tarball 内容可用于检查拆分后各 package 是否意外携带无关文件。

### Phase 1：提取 protocol

- 创建 `packages/protocol`。
- 迁移 DTO、schema、OpenAPI、error 和 protocol version。
- 将 `AbortSignal`、provider 和 backend interface 留在各自运行时 module。
- 更新剩余实现使用 workspace dependency。
- 增加 JSON Schema 与 TypeScript DTO 一致性测试。

完成条件：

- protocol package 在 Node 和浏览器中均可导入。
- package 不包含 DOM、Node builtin 或 VS Code 依赖。
- 当前 HTTP E2E 测试无需修改行为断言即可通过。

### Phase 2：提取 web

- 创建 `packages/web`。
- 迁移 layout、Web Component 和浏览器 provider。
- 让所有共享 DTO 从 `@web-git-graph/protocol` 导入。
- 使用 in-memory provider adapter 测试 Web module 的完整 interface。
- 保持现有 custom element 名称 `<web-git-graph>`。

完成条件：

- 浏览器 bundle 不包含 Node builtin。
- React/Vue/Svelte/原生 HTML 的调用方式不变。
- demo 切换到新 package 的公开 exports 后通过。

### Phase 3：提取 node

- 创建 `packages/node`。
- 迁移 backend、handler、snapshot store 和 CLI。
- 删除 Node 对 Web module 的依赖。
- 将 Node handler 的输入输出限制在 protocol DTO。
- 增加临时 Git repository 的集成测试。

完成条件：

- Node package 可在没有 Web package 的环境独立使用。
- HTTP provider 与 Node handler 通过同一套协议契约测试。
- CLI、Fetch handler 和 Node handler 均通过测试。
- 路径授权、超时、并发、输出限制没有回归。

### Phase 4：固化 demo 应用

- 保留现有 `apps/demo`、`@web-git-graph/demo` 名称和 `private: true` 设置。
- 保留 fixture 与 GitHub provider 模式。
- 增加可配置的 HTTP provider 模式，用于连接 Node backend。
- 所有依赖改为 scoped package 的公开 exports。
- 将 Playwright E2E、视觉验证和 GitHub Pages 部署集中到 demo。

完成条件：

- fixture、GitHub provider 和 HTTP provider 三种模式均能运行。
- demo 的生产 bundle 不包含 Node builtin 或敏感配置。
- GitHub Pages 部署成功。
- Playwright 测试覆盖 history、details、compare、diff 和 load-more。
- demo 不包含任何核心实现副本。

### Phase 5：实现 VS Code extension

- 创建 `packages/vscode`。
- 建立 Webview CSP、安全资源加载和主题同步。
- 实现类型安全的 request/response RPC。
- Webview 使用 `VsCodeGitGraphProvider`。
- Extension Host 进程内调用 `LocalGitBackend`。
- 将打开文件和 diff 映射到 VS Code command。

完成条件：

- 扩展不启动 HTTP server。
- Webview 无 Node 权限。
- Webview reload 后能够恢复 repository 和选中状态。
- workspace trust 未授予时不执行 Git。
- 多 root workspace 能选择 repository。
- VSIX 安装测试通过。

### Phase 6：worktree 与 AI coding 扩展

本阶段不阻塞四模块拆分。

- 在 protocol 增加 worktree DTO 和 capability。
- 在 Node module 实现 common-dir 识别和 worktree 枚举。
- 在 Web module 增加可选 worktree dashboard。
- 在 VS Code module 增加打开目录、新窗口和宿主状态关联。
- agent/task metadata 必须由宿主 adapter 提供，不根据目录名猜测。

## 7. 测试策略

interface 是主要测试表面，不为拆分后的内部文件机械复制旧测试。

### Protocol

- DTO/schema fixtures。
- error serialization。
- OpenAPI snapshot。
- protocol version compatibility。

### Web

- 纯 layout fixtures。
- in-memory provider adapter。
- Web Component 交互。
- 虚拟滚动和分页。
- 浏览器 E2E 与可访问性。

### Node

- 使用临时 Git repository 的集成测试。
- merge、tag、stash、working tree、rename、binary diff。
- timeout、output limit、concurrency、path traversal。
- HTTP handler 契约测试。
- 后续加入 linked worktree fixture。

### VS Code

- RPC 编解码测试。
- Extension Host handler 测试。
- Webview provider 使用 in-memory RPC adapter。
- VS Code extension integration test。
- workspace trust、multi-root 和 Webview restore。

### Demo

- fixture、GitHub provider 和 HTTP provider 三种运行模式。
- Playwright browser E2E。
- 视觉回归和可访问性。
- GitHub Pages production build。
- bundle 中不存在 Node builtin、token 或本地 repository 路径。

### 跨 module

至少保留两条真实 adapter 链路：

```text
Web Component → HTTP provider → Node handler → LocalGitBackend
Web Component → VS Code RPC provider → Extension Host → LocalGitBackend
```

两条链路必须使用同一 protocol fixtures，防止 transport 语义漂移。

## 8. 发布策略

### 0.x 阶段

- 三个 npm package 使用同步版本；VS Code extension 使用对应版本号。
- demo 保持 private，不参与 npm version 和 publish。
- wire protocol 单独保持 `v1`，package patch/minor 发布不自动升级协议。
- CI 按受影响 package 构建，但发布时保持版本同步。
- 每次发布生成每个 package 的 tarball 检查。

### 1.0 之前

- 明确哪些 interface 已稳定。
- 为 protocol breaking change 编写迁移指南。
- VS Code extension 与 npm package 使用同一 release notes 来源。

## 9. 验收标准

拆分完成必须同时满足：

- [ ] 四个核心 package 使用 `@web-git-graph/*` namespace。
- [ ] demo 使用 `@web-git-graph/demo`，保持 private 并通过 GitHub Pages 发布。
- [ ] 依赖图无循环。
- [ ] Web package 的产物不包含 Node builtin。
- [ ] Node package 不依赖 DOM、Web Component 或 VS Code。
- [ ] Protocol package 可被非 JavaScript 后端根据 Schema/OpenAPI 实现。
- [ ] VS Code extension 复用 Web 渲染和 Node Git 实现。
- [ ] VS Code Webview 与 Extension Host 只通过明确的 RPC interface 通信。
- [ ] 当前 unit、typecheck、build、pack 和 browser E2E 全部通过。
- [ ] demo 覆盖 fixture、GitHub provider 和 HTTP provider 三种运行模式。
- [ ] 新增 Node 集成测试和 VS Code 集成测试。
- [ ] README 明确区分浏览器、Node 和 VS Code 三种使用方式。
- [ ] 没有从 `mhutchie/vscode-git-graph` 复制或派生源码。

## 10. 非目标

首轮拆分不包含：

- 重写 layout 算法。
- 增加 Git mutation。
- 一次性完成全部 worktree/AI 功能。
- 为每个 Git provider 建立独立 package。
- 改变 `<web-git-graph>` custom element 名称。
- 强制所有使用者部署 Node backend。

## 11. 主要风险及控制

### 循环依赖

风险：为了共享 `GitGraphProvider`，Node 又依赖 Web。

控制：protocol 只放 DTO 和协议；运行时 port 留在 Web/Node 各自 module。

### protocol 变成杂物包

风险：任何共享代码都被放入 protocol。

控制：只有跨进程或跨语言必须共享的数据语义进入 protocol；布局 helper、Git parser、
VS Code message helper 均留在各自 module。

### VS Code 层重复 Node 实现

风险：Extension Host 单独解析 Git 输出。

控制：Extension Host 只处理 workspace、RPC 和 VS Code 操作；Git 行为全部通过
`LocalGitBackend`。

### demo 吸收生产逻辑

风险：为了快速展示，把协议转换、layout 或 Git 解析直接写进 demo。

控制：demo 只能通过公开 interface 调用核心 module；发现缺失能力时先补到对应 module，
再由 demo 消费。

### 过早扩张 interface

风险：为尚未实现的 worktree、mutation、agent metadata 预先设计大量方法。

控制：先完成两种真实 adapter；新增能力通过 capability 和小型可选 interface 演进。

## 12. 推荐的首个实施里程碑

第一个可合并的变更只完成 Phase 0 与 Phase 1：

1. 创建 `@web-git-graph/protocol`。
2. 迁移 DTO、schema、OpenAPI、error 和版本常量。
3. 将 workspace 内部 import 直接切换到 scoped package。
4. 不迁移 Web 和 Node 实现。
5. 运行完整 typecheck、unit、build、pack 和 E2E。

这是风险最小、能够验证依赖方向的第一步。protocol 提取成功后，再分别迁移 Web 和
Node；VS Code extension 最后建立在两个稳定 module 之上。
