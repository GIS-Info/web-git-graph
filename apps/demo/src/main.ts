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
import { initPage } from "./page";
import "./style.css";

type StatusState =
  | { kind: "fixture" }
  | { kind: "connecting"; repository: string }
  | { kind: "connected"; backend: string; repository: string }
  | { kind: "tip" }
  | { kind: "error"; message: string };

const messages = {
  en: {
    "nav.demo": "Demo",
    "nav.how": "How it works",
    "nav.guide": "Get started",
    "nav.protocol": "HTTP protocol",
    "theme.toDark": "Switch to dark theme",
    "theme.toLight": "Switch to light theme",
    "hero.eyebrow": "Web Component · Zero framework dependencies",
    "hero.titleA": "Git history,",
    "hero.titleB": "on any page.",
    "hero.lede": "One embeddable element that renders commit graphs from GitHub, your own backend, or a local repository — with the same UI everywhere.",
    "hero.try": "Try the live demo",
    "hero.install": "Get started",
    "hero.caption": "the actual component UI",
    "facts.framework": "framework dependencies",
    "facts.element": "custom element",
    "facts.providers": "built-in providers",
    "facts.endpoints": "read-only protocol endpoints",
    "demo.kicker": "Live demo",
    "demo.title": "Try it live.",
    "demo.description": "Search, switch refs, open commit details inline, or Ctrl/Cmd-click two commits to compare. Load any public GitHub repository.",
    "demo.history": "Repository history",
    "demo.repoLabel": "GitHub repository",
    "demo.load": "Load",
    "demo.statusFixture": "Showing fixture data. Enter a public repository to load live history.",
    "how.kicker": "How it works",
    "how.title": "Swap the data. Keep the UI.",
    "how.description": "The component talks to one small provider interface. Change where the commits come from — the layout and interactions stay identical.",
    "how.stage1.tag": "Data source",
    "how.stage1.title": "A provider fetches history",
    "how.stage1.body": "GitHub REST, an HTTP v1 backend, or local Git — all normalized to the same typed DTOs.",
    "how.stage2.tag": "Layout",
    "how.stage2.title": "Lanes are computed deterministically",
    "how.stage2.body": "The same commits always produce the same graph, and lanes stay stable across pages.",
    "how.stage3.tag": "Render",
    "how.stage3.title": "The element draws the graph",
    "how.stage3.body": "Virtualized rows in an accessible treegrid, themeable with CSS custom properties.",
    "how.noteA.title": "Read-only by design",
    "how.noteA.body": "No checkout, merge, rebase, or reset is exposed. Git commands never pass through a shell.",
    "how.noteB.title": "Any framework",
    "how.noteB.body": "The same element works in plain HTML, React, Vue, Svelte, and Angular.",
    "how.noteC.title": "One shared contract",
    "how.noteC.body": "DTOs, JSON Schemas, and the OpenAPI document live in @web-git-graph/protocol.",
    "guide.kicker": "Get started",
    "guide.title": "Install, register, connect.",
    "guide.description": "Two lines of setup, then pick where the commits come from.",
    "guide.step1": "Install",
    "guide.step2": "Register the element",
    "guide.step3": "Connect a data source",
    "connect.github.tab": "GitHub direct",
    "connect.github.body": "Read public repositories straight from the browser — no server required.",
    "connect.http.tab": "HTTP backend",
    "connect.http.body": "Serve history from your own infrastructure — any backend that implements the six read-only endpoints of the HTTP v1 protocol.",
    "connect.http.link": "Read the HTTP v1 protocol reference →",
    "connect.local.tab": "Local repository",
    "connect.local.body": "One command serves a local repository over the same protocol. It binds to 127.0.0.1, and filesystem paths never reach the browser.",
    "callout.title": "The protocol behind every backend",
    "callout.body": "Six read-only JSON endpoints, a versioned media type, and a typed error model — documented with examples.",
    "callout.action": "Protocol reference →",
    "closing.title": "History is easier to trust when you can see it.",
    "closing.demo": "Open the demo",
    "closing.github": "View on GitHub ↗",
    "footer.tagline": "Framework-free Git history for the web.",
    "common.copy": "Copy",
    "common.copied": "Copied",
    "status.fixture": "Showing fixture data. Enter a public repository to load live history.",
    "status.connecting": "Connecting to github.com/{repository}…",
    "status.connected": "Connected to {backend} · repository {repository}",
    "status.tip": "Tip: Ctrl/Cmd-click another commit to compare. Double-click to open it on GitHub.",
    "status.error": "GitHub API: {message}"
  },
  zh: {
    "nav.demo": "在线演示",
    "nav.how": "工作原理",
    "nav.guide": "快速开始",
    "nav.protocol": "HTTP 协议",
    "theme.toDark": "切换到深色主题",
    "theme.toLight": "切换到浅色主题",
    "hero.eyebrow": "原生 Web Component · 零框架依赖",
    "hero.titleA": "让 Git 历史",
    "hero.titleB": "出现在任何页面。",
    "hero.lede": "一个可嵌入的原生组件,渲染来自 GitHub、自有后端或本地仓库的提交历史——界面与交互始终一致。",
    "hero.try": "体验在线演示",
    "hero.install": "快速开始",
    "hero.caption": "组件的真实界面",
    "facts.framework": "框架依赖",
    "facts.element": "个自定义元素",
    "facts.providers": "种内置数据源",
    "facts.endpoints": "个只读协议端点",
    "demo.kicker": "在线演示",
    "demo.title": "直接试用。",
    "demo.description": "搜索、切换分支、原位展开提交详情,或按住 Ctrl/Cmd 选择两个提交进行比较。也可以载入任意公开 GitHub 仓库。",
    "demo.history": "仓库历史",
    "demo.repoLabel": "GitHub 仓库",
    "demo.load": "载入",
    "demo.statusFixture": "当前展示示例数据。输入公开仓库即可载入实时历史。",
    "how.kicker": "工作原理",
    "how.title": "换掉数据源,界面不变。",
    "how.description": "组件只依赖一个很小的 Provider 接口。无论提交来自哪里,布局和交互都保持一致。",
    "how.stage1.tag": "数据源",
    "how.stage1.title": "Provider 拉取历史",
    "how.stage1.body": "GitHub REST、HTTP v1 后端或本地 Git,统一成同一套类型化 DTO。",
    "how.stage2.tag": "布局",
    "how.stage2.title": "泳道按确定性算法计算",
    "how.stage2.body": "相同的提交永远得到相同的图,分页加载时泳道保持稳定。",
    "how.stage3.tag": "渲染",
    "how.stage3.title": "组件绘制图谱",
    "how.stage3.body": "虚拟滚动的可访问 treegrid,可用 CSS 自定义属性适配主题。",
    "how.noteA.title": "只读设计",
    "how.noteA.body": "不暴露 checkout、merge、rebase、reset;Git 命令永不经过 shell。",
    "how.noteB.title": "任意框架",
    "how.noteB.body": "同一个元素可用于原生 HTML、React、Vue、Svelte 与 Angular。",
    "how.noteC.title": "一份共享契约",
    "how.noteC.body": "DTO、JSON Schema 与 OpenAPI 文档都在 @web-git-graph/protocol 中。",
    "guide.kicker": "快速开始",
    "guide.title": "安装、注册、连接。",
    "guide.description": "两行代码完成初始化,然后选择提交数据的来源。",
    "guide.step1": "安装",
    "guide.step2": "注册组件",
    "guide.step3": "连接数据源",
    "connect.github.tab": "GitHub 直连",
    "connect.github.body": "浏览器直接读取公开仓库,无需任何服务端。",
    "connect.http.tab": "HTTP 后端",
    "connect.http.body": "用自己的基础设施提供历史数据——任何实现 HTTP v1 协议六个只读端点的后端都可以。",
    "connect.http.link": "查看 HTTP v1 协议参考 →",
    "connect.local.tab": "本地仓库",
    "connect.local.body": "一条命令即可用同一协议提供本地仓库。默认只监听 127.0.0.1,文件路径永远不会到达浏览器。",
    "callout.title": "每个后端背后的协议",
    "callout.body": "六个只读 JSON 端点、带版本的媒体类型与类型化错误模型,附完整示例。",
    "callout.action": "协议参考 →",
    "closing.title": "看得见的历史,更值得信任。",
    "closing.demo": "打开在线演示",
    "closing.github": "在 GitHub 查看 ↗",
    "footer.tagline": "为 Web 而生的零框架 Git 历史图。",
    "common.copy": "复制",
    "common.copied": "已复制",
    "status.fixture": "当前展示示例数据。输入公开仓库即可载入实时历史。",
    "status.connecting": "正在连接 github.com/{repository}…",
    "status.connected": "已连接 {backend} · 仓库 {repository}",
    "status.tip": "提示:按住 Ctrl/Cmd 选择另一个提交进行比较;双击可在 GitHub 打开。",
    "status.error": "GitHub API:{message}"
  }
};

const graph = document.querySelector<WebGitGraphElement>("#graph")!;
const form = document.querySelector<HTMLFormElement>("#repo-form")!;
const repositoryInput = document.querySelector<HTMLInputElement>("#repository")!;
const status = document.querySelector<HTMLElement>("#status")!;

let statusState: StatusState = { kind: "fixture" };

const page = initPage({
  messages,
  documentTitle: {
    en: "Web Git Graph — Git history for the web",
    zh: "Web Git Graph — 为 Web 而生的 Git 历史图"
  },
  onLocale: renderStatus,
  onTheme: (theme) => {
    graph.theme = theme;
  }
});

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
graph.theme = page.theme;
renderStatus();

const query = new URLSearchParams(window.location.search);
const backendUrl = query.get("backend");
if (backendUrl) {
  const repositoryId = query.get("repository") ?? "local";
  graph.provider = new HttpGitGraphProvider({
    baseUrl: backendUrl,
    repositoryId
  });
  statusState = { kind: "connected", backend: backendUrl, repository: repositoryId };
  renderStatus();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const repository = repositoryInput.value.trim();
  if (!repository) return;
  const normalized = repository.replace(/^https?:\/\/github.com\//, "");
  statusState = { kind: "connecting", repository: normalized };
  renderStatus();
  graph.provider = new GitHubGitGraphProvider({ repository, pageSize: 80 });
  graph.addEventListener(
    "gitgraph-error",
    (error) => {
      const message = error.detail.error instanceof Error ? error.detail.error.message : String(error.detail.error);
      statusState = { kind: "error", message };
      renderStatus();
    },
    { once: true }
  );
  window.setTimeout(() => {
    if (statusState.kind === "connecting") {
      statusState = { kind: "tip" };
      renderStatus();
    }
  }, 900);
});

const tabs = document.querySelectorAll<HTMLButtonElement>("[data-tab]");
const panels = document.querySelectorAll<HTMLElement>("[data-tab-panel]");
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((button) => button.setAttribute("aria-selected", String(button === tab)));
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.tabPanel !== tab.dataset.tab;
    });
  });
});

function renderStatus(): void {
  if (statusState.kind === "fixture") {
    status.textContent = page.t("status.fixture");
  } else if (statusState.kind === "connecting") {
    status.textContent = page.t("status.connecting", { repository: statusState.repository });
  } else if (statusState.kind === "connected") {
    status.textContent = page.t("status.connected", {
      backend: statusState.backend,
      repository: statusState.repository
    });
  } else if (statusState.kind === "tip") {
    status.textContent = page.t("status.tip");
  } else {
    status.textContent = page.t("status.error", { message: statusState.message });
  }
}

function commit(
  oid: string,
  parents: string[],
  message: string,
  name: string,
  committedAt: string
): GitGraphCommit {
  return { oid, parents, message, author: { name }, committedAt, kind: "commit" };
}
