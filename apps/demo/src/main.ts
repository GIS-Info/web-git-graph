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

type Locale = "en" | "zh";
type Theme = "light" | "dark";
type StatusState =
  | { kind: "fixture" }
  | { kind: "connecting"; repository: string }
  | { kind: "connected"; backend: string; repository: string }
  | { kind: "tip" }
  | { kind: "error"; message: string };

const messages = {
  en: {
    "nav.demo": "Live demo",
    "nav.principles": "How it works",
    "nav.guide": "Get started",
    "theme.toDark": "Switch to dark theme",
    "theme.toLight": "Switch to light theme",
    "hero.eyebrow": "Framework-free · Browser native",
    "hero.titleA": "Your Git history,",
    "hero.titleB": "finally visible.",
    "hero.lede": "A focused, embeddable commit graph for any webpage. Keep the same interaction model across GitHub, your own API, and local Git.",
    "hero.try": "Explore the live demo",
    "hero.install": "Installation guide",
    "hero.artLabel": "Deterministic lane layout",
    "metrics.framework": "framework dependencies",
    "metrics.providers": "provider paths",
    "metrics.backends": "backend choices",
    "metrics.component": "Web Component",
    "demo.kicker": "Live demo",
    "demo.title": "See the graph work.",
    "demo.description": "Search history, switch refs, inspect a commit, or Ctrl/Cmd-click two commits to compare them. You can also load any public GitHub repository.",
    "demo.workspace": "Live workspace",
    "demo.history": "Repository history",
    "demo.repoLabel": "GitHub repository",
    "demo.load": "Load graph",
    "demo.statusFixture": "Showing a deterministic fixture. Enter a public repository to load live history.",
    "demo.hint": "Tip: select a commit to open details inline.",
    "principles.kicker": "How it works",
    "principles.title": "One contract. Four deep modules.",
    "principles.description": "Rendering never knows where Git data came from. A small protocol seam keeps browsers, servers, and editor hosts independently replaceable.",
    "principles.source.title": "Git source",
    "principles.source.body": "GitHub REST, HTTP v1, or local Git.",
    "principles.provider.title": "Provider adapter",
    "principles.provider.body": "Normalizes history into transport-neutral DTOs.",
    "principles.layout.title": "Lane engine",
    "principles.layout.body": "Produces deterministic nodes and merge segments.",
    "principles.view.title": "Web Component",
    "principles.view.body": "Virtualizes rows and renders an accessible treegrid.",
    "principles.noteA.title": "Stable pagination",
    "principles.noteA.body": "Opaque cursors preserve the visible graph while history grows.",
    "principles.noteB.title": "Safe by default",
    "principles.noteB.body": "Local paths stay server-side; Git commands never pass through a shell.",
    "principles.noteC.title": "Framework agnostic",
    "principles.noteC.body": "Use the same element in plain HTML, React, Vue, Svelte, or Angular.",
    "guide.kicker": "Quick start",
    "guide.title": "From install to graph in three steps.",
    "guide.description": "The browser package contains the component and provider adapters. Shared protocol types stay in their own package.",
    "guide.step1": "Install",
    "guide.step1Body": "Add the browser renderer and the shared protocol types.",
    "guide.step2": "Register",
    "guide.step2Body": "Register the native custom element once in your browser entry.",
    "guide.step3": "Connect",
    "guide.step3Body": "Choose a provider and assign it directly to the element.",
    "providers.kicker": "Choose your data path",
    "providers.title": "The UI stays the same. The provider is yours.",
    "providers.github.title": "Browser direct",
    "providers.github.body": "Read a public GitHub repository directly from the browser.",
    "providers.http.title": "HTTP protocol",
    "providers.http.body": "Connect any backend through the versioned, language-neutral HTTP contract.",
    "providers.local.title": "Local Git",
    "providers.local.body": "Serve worktrees, stashes, comparisons, and diffs from Node.",
    "closing.kicker": "Bring a desktop-grade Git graph to the web.",
    "closing.title": "History is easier to trust when you can see it.",
    "closing.demo": "Open the demo",
    "closing.github": "View on GitHub ↗",
    "footer.tagline": "Framework-free Git history for the web.",
    "common.copy": "Copy",
    "common.copied": "Copied",
    "status.fixture": "Showing a deterministic fixture. Enter a public repository to load live history.",
    "status.connecting": "Connecting to github.com/{repository}…",
    "status.connected": "Connected to {backend} · repository {repository}",
    "status.tip": "Tip: Ctrl/Cmd-click another commit to compare. Double-click to open the remote commit.",
    "status.error": "GitHub API: {message}"
  },
  zh: {
    "nav.demo": "在线演示",
    "nav.principles": "工作原理",
    "nav.guide": "使用说明",
    "theme.toDark": "切换到深色主题",
    "theme.toLight": "切换到浅色主题",
    "hero.eyebrow": "零框架依赖 · 原生浏览器组件",
    "hero.titleA": "让 Git 历史，",
    "hero.titleB": "真正清晰可见。",
    "hero.lede": "一个专注、可嵌入任意网页的提交历史图。在 GitHub、自有 API 与本地 Git 之间，始终保持一致的交互体验。",
    "hero.try": "体验在线 Demo",
    "hero.install": "查看安装说明",
    "hero.artLabel": "确定性的泳道布局",
    "metrics.framework": "框架依赖",
    "metrics.providers": "数据接入方式",
    "metrics.backends": "后端选择",
    "metrics.component": "原生 Web Component",
    "demo.kicker": "在线演示",
    "demo.title": "直接体验 Git Graph。",
    "demo.description": "搜索历史、切换分支、查看提交详情，或按住 Ctrl/Cmd 选择两个提交进行比较。也可以载入任意公开 GitHub 仓库。",
    "demo.workspace": "实时工作区",
    "demo.history": "仓库历史",
    "demo.repoLabel": "GitHub 仓库",
    "demo.load": "载入图谱",
    "demo.statusFixture": "当前展示确定性示例数据。输入公开仓库即可载入实时历史。",
    "demo.hint": "提示：选择一个提交即可在原位置展开详情。",
    "principles.kicker": "工作原理",
    "principles.title": "一套契约，四个深模块。",
    "principles.description": "渲染层无需知道 Git 数据来自哪里。清晰的协议边界让浏览器、服务端和编辑器宿主都能独立替换。",
    "principles.source.title": "Git 数据源",
    "principles.source.body": "GitHub REST、HTTP v1 或本地 Git。",
    "principles.provider.title": "Provider 适配器",
    "principles.provider.body": "将历史统一为与传输无关的 DTO。",
    "principles.layout.title": "泳道布局引擎",
    "principles.layout.body": "生成确定性的节点与合并连线。",
    "principles.view.title": "Web Component",
    "principles.view.body": "虚拟化列表并渲染可访问的 treegrid。",
    "principles.noteA.title": "稳定分页",
    "principles.noteA.body": "不透明游标让历史增长时，已显示的图谱仍保持稳定。",
    "principles.noteB.title": "默认安全",
    "principles.noteB.body": "本地路径只停留在服务端，Git 命令永不经过 shell。",
    "principles.noteC.title": "框架无关",
    "principles.noteC.body": "同一个元素可用于原生 HTML、React、Vue、Svelte 或 Angular。",
    "guide.kicker": "快速开始",
    "guide.title": "三步从安装到显示图谱。",
    "guide.description": "浏览器包包含组件和 Provider 适配器；共享协议类型则保持为独立模块。",
    "guide.step1": "安装",
    "guide.step1Body": "加入浏览器渲染器与共享协议类型。",
    "guide.step2": "注册",
    "guide.step2Body": "在浏览器入口中注册一次原生自定义元素。",
    "guide.step3": "连接数据",
    "guide.step3Body": "选择 Provider，并直接赋值给组件。",
    "providers.kicker": "选择数据接入方式",
    "providers.title": "界面始终一致，Provider 由你决定。",
    "providers.github.title": "浏览器直连",
    "providers.github.body": "直接在浏览器中读取公开 GitHub 仓库。",
    "providers.http.title": "HTTP 协议",
    "providers.http.body": "通过带版本、语言无关的 HTTP 契约连接任意后端。",
    "providers.local.title": "本地 Git",
    "providers.local.body": "通过 Node 提供 worktree、stash、比较与 diff。",
    "closing.kicker": "把桌面级 Git Graph 带到 Web。",
    "closing.title": "看得见的历史，更值得信任。",
    "closing.demo": "打开在线演示",
    "closing.github": "在 GitHub 查看 ↗",
    "footer.tagline": "为 Web 而生的零框架 Git 历史图。",
    "common.copy": "复制",
    "common.copied": "已复制",
    "status.fixture": "当前展示确定性示例数据。输入公开仓库即可载入实时历史。",
    "status.connecting": "正在连接 github.com/{repository}…",
    "status.connected": "已连接 {backend} · 仓库 {repository}",
    "status.tip": "提示：按住 Ctrl/Cmd 选择另一个提交进行比较；双击可打开远程提交。",
    "status.error": "GitHub API：{message}"
  }
} as const;

const graph = document.querySelector<WebGitGraphElement>("#graph")!;
const form = document.querySelector<HTMLFormElement>("#repo-form")!;
const repositoryInput = document.querySelector<HTMLInputElement>("#repository")!;
const status = document.querySelector<HTMLElement>("#status")!;
const themeButton = document.querySelector<HTMLButtonElement>("#theme-switch")!;
const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')!;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

let locale: Locale = resolveLocale();
let theme: Theme = resolveTheme();
let statusState: StatusState = { kind: "fixture" };

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
applyTheme(theme, false);
applyLocale(locale, false);
setupMotion();

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
      const message = (error as CustomEvent<{ error: Error }>).detail.error.message;
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

document.querySelectorAll<HTMLButtonElement>("[data-copy]").forEach((button) => {
  button.addEventListener("click", async () => {
    await navigator.clipboard.writeText(button.dataset.copy ?? "");
    button.textContent = translate("common.copied");
    window.setTimeout(() => {
      button.textContent = translate("common.copy");
    }, 1300);
  });
});

document.querySelectorAll<HTMLButtonElement>("[data-language]").forEach((button) => {
  button.addEventListener("click", () => {
    applyLocale(button.dataset.language === "zh" ? "zh" : "en");
  });
});

themeButton.addEventListener("click", () => {
  applyTheme(theme === "light" ? "dark" : "light");
});

function resolveLocale(): Locale {
  const saved = localStorage.getItem("web-git-graph-locale");
  if (saved === "en" || saved === "zh") return saved;
  return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function resolveTheme(): Theme {
  const saved = localStorage.getItem("web-git-graph-theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function translate(key: keyof (typeof messages)["en"], values?: Record<string, string>): string {
  let value: string = messages[locale][key];
  for (const [name, replacement] of Object.entries(values ?? {})) {
    value = value.replace(`{${name}}`, replacement);
  }
  return value;
}

function applyLocale(next: Locale, persist = true): void {
  locale = next;
  document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  if (persist) localStorage.setItem("web-git-graph-locale", locale);
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((element) => {
    if (element.id === "status") return;
    const key = element.dataset.i18n as keyof (typeof messages)["en"];
    element.textContent = translate(key);
  });
  document.querySelectorAll<HTMLElement>("[data-i18n-aria]").forEach((element) => {
    const key = element.dataset.i18nAria as keyof (typeof messages)["en"];
    element.setAttribute("aria-label", translate(key));
  });
  document.querySelectorAll<HTMLButtonElement>("[data-language]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.language === locale));
  });
  document.title = locale === "zh"
    ? "Web Git Graph — 为 Web 而生的 Git 历史图"
    : "Web Git Graph — Git history for the web";
  updateThemeLabel();
  renderStatus();
}

function applyTheme(next: Theme, persist = true): void {
  theme = next;
  document.documentElement.dataset.theme = theme;
  graph.theme = theme;
  themeMeta.content = theme === "dark" ? "#0e120f" : "#f3f1eb";
  if (persist) localStorage.setItem("web-git-graph-theme", theme);
  updateThemeLabel();
}

function updateThemeLabel(): void {
  themeButton.setAttribute(
    "aria-label",
    translate(theme === "light" ? "theme.toDark" : "theme.toLight")
  );
}

function renderStatus(): void {
  if (statusState.kind === "fixture") {
    status.textContent = translate("status.fixture");
  } else if (statusState.kind === "connecting") {
    status.textContent = translate("status.connecting", { repository: statusState.repository });
  } else if (statusState.kind === "connected") {
    status.textContent = translate("status.connected", {
      backend: statusState.backend,
      repository: statusState.repository
    });
  } else if (statusState.kind === "tip") {
    status.textContent = translate("status.tip");
  } else {
    status.textContent = translate("status.error", { message: statusState.message });
  }
}

function setupMotion(): void {
  if (reducedMotion.matches) {
    document.querySelectorAll(".reveal").forEach((element) => element.classList.add("is-visible"));
    return;
  }
  document.documentElement.classList.add("motion");
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -8%", threshold: 0.08 }
  );
  document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));

  const art = document.querySelector<HTMLElement>(".hero-art");
  const dag = document.querySelector<SVGElement>(".hero-dag");
  art?.addEventListener("pointermove", (event) => {
    if (!dag) return;
    const bounds = art.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - .5;
    const y = (event.clientY - bounds.top) / bounds.height - .5;
    dag.style.transform = `translate(${x * 8}px, ${y * 8}px)`;
  });
  art?.addEventListener("pointerleave", () => {
    if (dag) dag.style.transform = "translate(0, 0)";
  });
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
