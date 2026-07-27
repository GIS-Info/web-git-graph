import { layoutGitGraph, type GitGraphLayout } from "./layout";
import type {
  GitGraphCommit,
  GitGraphCommitDetails,
  GitGraphComparison,
  GitGraphFileDiff,
  GitGraphPage,
  GitGraphProvider,
  GitGraphRef,
  GitGraphRevision
} from "./types";

const ELEMENT_NAME = "web-git-graph";
const PALETTE = ["#e3008c", "#007acc", "#00c853", "#ff8c00", "#b180d7", "#00b7c3", "#dcdcaa"];

const STYLES = `
:host {
  --wgg-bg: #1e1e1e;
  --wgg-panel: #252526;
  --wgg-panel-raised: #2d2d30;
  --wgg-ink: #d4d4d4;
  --wgg-muted: #a9a9a9;
  --wgg-faint: #777;
  --wgg-line: #3c3c3c;
  --wgg-hover: #2a2d2e;
  --wgg-selected: #37373d;
  --wgg-accent: #3794ff;
  --wgg-warning: #cca700;
  --wgg-row-height: 24px;
  --wgg-graph-width: 72px;
  --wgg-date-width: 142px;
  --wgg-author-width: 150px;
  --wgg-commit-width: 82px;
  --wgg-font: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --wgg-mono: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  display: block;
  min-height: 420px;
  color: var(--wgg-ink);
  font-family: var(--wgg-font);
  background: var(--wgg-bg);
  border: 1px solid var(--wgg-line);
  overflow: hidden;
  color-scheme: dark;
}
:host([theme="light"]) {
  --wgg-bg: #ffffff;
  --wgg-panel: #f3f3f3;
  --wgg-panel-raised: #f8f8f8;
  --wgg-ink: #333333;
  --wgg-muted: #616161;
  --wgg-faint: #8e8e8e;
  --wgg-line: #d4d4d4;
  --wgg-hover: #f0f0f0;
  --wgg-selected: #e4e6f1;
  color-scheme: light;
}
:host([density="compact"]) { --wgg-row-height: 20px; }
* { box-sizing: border-box; }
button, input, select { font: inherit; color: inherit; }
button { cursor: pointer; }
.shell { min-height: inherit; height: 100%; display: grid; grid-template-rows: auto minmax(0, 1fr); }
.toolbar {
  min-height: 42px;
  display: flex;
  gap: 16px;
  align-items: center;
  padding: 6px 10px;
  background: var(--wgg-panel);
  border-bottom: 1px solid var(--wgg-line);
  font-size: 12px;
}
.branch-control, .remote-control { display: flex; align-items: center; gap: 7px; white-space: nowrap; }
.branch-control strong, .remote-control { font-weight: 600; }
.branch-control select { width: min(250px, 28vw); }
.remote-control input { margin: 0; accent-color: var(--wgg-accent); }
.repository-name {
  min-width: 0; flex: 1; color: var(--wgg-muted); overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; text-align: center;
}
.search {
  width: min(240px, 25vw); height: 28px; border: 1px solid var(--wgg-line); background: var(--wgg-bg);
  border-radius: 2px; padding: 4px 7px; outline: none; font-size: 12px;
}
.search:focus, select:focus, button:focus-visible { outline: 1px solid var(--wgg-accent); outline-offset: -1px; }
.tools { display: flex; align-items: center; gap: 4px; margin-left: auto; }
select, .icon-button {
  height: 28px; border: 1px solid var(--wgg-line); background: var(--wgg-bg);
  border-radius: 2px; padding: 3px 7px;
}
.icon-button { min-width: 28px; color: var(--wgg-muted); background: transparent; border-color: transparent; }
.icon-button:hover { color: var(--wgg-ink); background: var(--wgg-hover); }
.body {
  min-height: 0; position: relative; display: grid; grid-template-rows: minmax(0, 1fr) 0;
  transition: grid-template-rows 120ms ease;
}
.body.drawer-open { grid-template-rows: minmax(150px, 1fr) minmax(190px, 42%); }
.history { min-width: 0; display: grid; grid-template-rows: 34px minmax(0, 1fr); }
.header, .row {
  display: grid;
  grid-template-columns:
    var(--wgg-graph-width) minmax(220px, 1fr) var(--wgg-date-width)
    var(--wgg-author-width) var(--wgg-commit-width);
  align-items: center;
}
.header {
  padding-right: 10px; background: var(--wgg-bg); color: var(--wgg-ink);
  border-bottom: 1px solid var(--wgg-line); font-size: 12px; font-weight: 600;
}
.header > span {
  height: 100%; display: flex; align-items: center; justify-content: center;
  padding: 0 8px; border-right: 1px solid var(--wgg-line);
}
.scroller { position: relative; overflow: auto; min-height: 0; outline: none; scrollbar-color: var(--wgg-faint) transparent; }
.spacer { position: relative; min-width: 720px; }
.window { position: absolute; inset: 0 0 auto 0; }
.row {
  height: var(--wgg-row-height); padding-right: 10px;
  border-bottom: 1px solid color-mix(in srgb, var(--wgg-line) 30%, transparent);
  position: relative; cursor: default; font-size: 12px;
}
.row:hover, .row.preview { background: var(--wgg-hover); }
.row.selected { background: var(--wgg-selected); }
.row.compare { box-shadow: inset 2px 0 var(--wgg-warning); }
.row.merge .message { color: var(--wgg-muted); }
.row.working-tree .message { font-weight: 600; }
.row:focus { outline: 1px solid var(--wgg-accent); outline-offset: -1px; }
.graph-cell { height: 100%; position: relative; }
.subject { min-width: 0; display: flex; align-items: center; gap: 5px; padding: 0 4px; }
.message { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.refs { flex: 0 1 auto; display: flex; gap: 2px; min-width: 0; overflow: hidden; }
.ref {
  max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font: 10px/15px var(--wgg-font); padding: 0 5px; border: 1px solid var(--ref-color, var(--wgg-accent));
  color: var(--wgg-ink); border-radius: 2px;
}
.ref.current, .ref.head { background: var(--ref-color, var(--wgg-accent)); color: #fff; }
.ref.remote { border-color: var(--wgg-faint); color: var(--wgg-muted); }
.ref.tag { background: #0e639c; border-color: #0e639c; color: #fff; }
.ref.stash { background: #9b2f86; border-color: #9b2f86; color: #fff; }
.author, .date, .oid {
  min-width: 0; padding: 0 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: var(--wgg-ink);
}
.date, .author { text-align: center; }
.oid { font-family: var(--wgg-mono); font-size: 11px; text-align: center; }
.graph {
  position: absolute; pointer-events: none; overflow: visible;
}
.graph path { fill: none; stroke-width: 2; vector-effect: non-scaling-stroke; }
.graph circle { stroke-width: 1.5; vector-effect: non-scaling-stroke; }
.drawer {
  min-height: 0; overflow: auto; background: var(--wgg-panel); border-top: 1px solid var(--wgg-line);
  opacity: 0; pointer-events: none; transform: translateY(6px); transition: opacity 100ms ease, transform 100ms ease;
}
.drawer-open .drawer { opacity: 1; pointer-events: auto; transform: none; }
.drawer-head {
  position: sticky; top: 0; z-index: 2; display: flex; justify-content: space-between; align-items: center;
  height: 30px; padding: 0 8px; background: var(--wgg-panel-raised); border-bottom: 1px solid var(--wgg-line);
}
.drawer-title { font-size: 12px; font-weight: 600; }
.drawer-content { padding: 10px 14px 16px; }
.commit-title { margin: 0 0 8px; font-size: 13px; line-height: 1.3; font-weight: 600; }
.meta { display: grid; grid-template-columns: 70px minmax(0, 1fr); gap: 4px 8px; color: var(--wgg-muted); font-size: 11px; }
.meta dt { color: var(--wgg-faint); }
.meta dd { margin: 0; overflow-wrap: anywhere; }
.actions { display: flex; flex-wrap: wrap; gap: 5px; margin: 10px 0; }
.action {
  border: 1px solid var(--wgg-line); border-radius: 2px; background: var(--wgg-panel-raised);
  padding: 4px 8px; font-size: 11px;
}
.action.primary { border-color: var(--wgg-accent); background: #0e639c; color: #fff; }
.changes { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1px 14px; }
.change {
  width: 100%; display: grid; grid-template-columns: 20px minmax(0, 1fr) auto; gap: 7px; text-align: left;
  padding: 4px 3px; border: 1px solid transparent; border-radius: 0; background: transparent; font-size: 11px;
}
.change:hover { background: var(--wgg-hover); }
.change-code { font: 11px var(--wgg-mono); color: #4ec9b0; }
.change-path { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stats { font: 10px var(--wgg-mono); color: var(--wgg-muted); }
.patch {
  margin: 10px 0 0; padding: 10px; max-height: 420px; overflow: auto; border: 1px solid var(--wgg-line);
  background: var(--wgg-bg); font: 10px/1.55 var(--wgg-mono); white-space: pre; tab-size: 2;
}
.empty, .loading, .error { display: grid; place-items: center; min-height: 220px; color: var(--wgg-muted); text-align: center; padding: 30px; }
.error { color: #ff8585; }
.load-more { display: block; margin: 12px auto; }
@media (max-width: 760px) {
  .toolbar { gap: 8px; }
  .remote-control, .repository-name, .search { display: none; }
  .branch-control { flex: 1; }
  .branch-control select { width: 100%; }
  .header, .row { grid-template-columns: var(--wgg-graph-width) minmax(220px, 1fr) var(--wgg-commit-width); }
  .header > :nth-child(3), .header > :nth-child(4), .row > :nth-child(3), .row > :nth-child(4) { display: none; }
  .body.drawer-open { grid-template-rows: minmax(120px, 1fr) minmax(220px, 50%); }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition-duration: 0.001ms !important; animation-duration: 0.001ms !important; }
}
`;

function revisionFor(commit: GitGraphCommit): GitGraphRevision {
  if (commit.kind === "working-tree") return { kind: "working-tree" };
  if (commit.kind === "stash") return { kind: "stash", oid: commit.oid };
  return { kind: "commit", oid: commit.oid };
}

function shortOid(oid: string): string {
  return oid.startsWith("__") ? oid.replaceAll("_", "") : oid.slice(0, 8);
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: "2-digit",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function svgElement<K extends keyof SVGElementTagNameMap>(
  name: K,
  attributes: Record<string, string>
): SVGElementTagNameMap[K] {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}

const HTMLElementBase = (
  typeof HTMLElement === "undefined" ? class {} : HTMLElement
) as typeof HTMLElement;

export class WebGitGraphElement extends HTMLElementBase {
  static observedAttributes = ["theme", "density"];

  #provider?: GitGraphProvider;
  #page: GitGraphPage = { commits: [], refs: [], hasMore: false };
  #layout: GitGraphLayout = layoutGitGraph([]);
  #filteredCommits: readonly GitGraphCommit[] = [];
  #search = "";
  #selectedOid?: string;
  #compareOid?: string;
  #details?: GitGraphCommitDetails;
  #comparison?: GitGraphComparison;
  #fileDiff?: GitGraphFileDiff;
  #loading = false;
  #loadingMore = false;
  #error?: string;
  #abort?: AbortController;
  #rowHeight = 24;
  #overscan = 8;
  #showRemoteRefs = true;
  #root: ShadowRoot;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: "open" });
    this.#root.innerHTML = `<style>${STYLES}</style><div class="shell"></div>`;
  }

  connectedCallback(): void {
    this.#renderShell();
    if (this.#provider && this.#page.commits.length === 0) void this.#load(false);
  }

  attributeChangedCallback(): void {
    this.#rowHeight = this.getAttribute("density") === "compact" ? 20 : 24;
    this.#renderWindow();
  }

  get provider(): GitGraphProvider | undefined {
    return this.#provider;
  }

  set provider(value: GitGraphProvider | undefined) {
    this.#provider = value;
    if (this.isConnected && value) void this.#load(false);
  }

  get data(): GitGraphPage {
    return this.#page;
  }

  set data(value: GitGraphPage) {
    this.setData(value);
  }

  get theme(): string {
    return this.getAttribute("theme") ?? "dark";
  }

  set theme(value: string) {
    this.setAttribute("theme", value);
  }

  get density(): string {
    return this.getAttribute("density") ?? "comfortable";
  }

  set density(value: string) {
    this.setAttribute("density", value);
  }

  setData(page: GitGraphPage): void {
    this.#page = {
      ...page,
      commits: [...page.commits],
      refs: [...page.refs]
    };
    this.#selectedOid = undefined;
    this.#compareOid = undefined;
    this.#details = undefined;
    this.#comparison = undefined;
    this.#error = undefined;
    this.#recompute();
  }

  appendPage(page: GitGraphPage): void {
    const scrollTop = this.#root.querySelector<HTMLElement>(".scroller")?.scrollTop ?? 0;
    const seen = new Set(this.#page.commits.map((commit) => commit.oid));
    this.#page = {
      ...this.#page,
      ...page,
      commits: [...this.#page.commits, ...page.commits.filter((commit) => !seen.has(commit.oid))],
      refs: this.#mergeRefs(this.#page.refs, page.refs)
    };
    this.#recompute();
    queueMicrotask(() => {
      const scroller = this.#root.querySelector<HTMLElement>(".scroller");
      if (!scroller) return;
      scroller.scrollTop = scrollTop;
      this.#renderWindow();
    });
  }

  selectCommit(oid: string): void {
    const commit = this.#page.commits.find((item) => item.oid === oid);
    if (!commit) return;
    this.#selectedOid = oid;
    this.#compareOid = undefined;
    this.#comparison = undefined;
    this.#fileDiff = undefined;
    this.dispatchEvent(
      new CustomEvent("gitgraph-commit-select", {
        bubbles: true,
        composed: true,
        detail: { commit }
      })
    );
    void this.#loadDetails(commit);
    this.#renderWindow();
    this.#renderDrawer();
  }

  async compareCommits(baseOid: string, headOid: string): Promise<void> {
    const base = this.#page.commits.find((item) => item.oid === baseOid);
    const head = this.#page.commits.find((item) => item.oid === headOid);
    if (!base || !head || !this.#provider?.compare) return;
    this.#selectedOid = baseOid;
    this.#compareOid = headOid;
    this.#fileDiff = undefined;
    this.#renderWindow();
    this.#renderDrawer(true);
    try {
      this.#comparison = await this.#provider.compare(
        this.#page.repositoryId,
        revisionFor(base),
        revisionFor(head)
      );
      this.dispatchEvent(
        new CustomEvent("gitgraph-compare", {
          bubbles: true,
          composed: true,
          detail: this.#comparison
        })
      );
    } catch (error) {
      this.#emitError(error);
    }
    this.#renderDrawer();
  }

  focusCommit(oid: string): void {
    const index = this.#filteredCommits.findIndex((commit) => commit.oid === oid);
    if (index < 0) return;
    const scroller = this.#root.querySelector<HTMLElement>(".scroller");
    scroller?.scrollTo({ top: index * this.#rowHeight, behavior: "smooth" });
    queueMicrotask(() => {
      this.#root.querySelector<HTMLElement>(`.row[data-oid="${CSS.escape(oid)}"]`)?.focus();
    });
  }

  #mergeRefs(left: readonly GitGraphRef[], right: readonly GitGraphRef[]): GitGraphRef[] {
    const refs = new Map(left.map((ref) => [`${ref.kind}:${ref.name}`, ref]));
    for (const ref of right) refs.set(`${ref.kind}:${ref.name}`, ref);
    return [...refs.values()];
  }

  #recompute(): void {
    const needle = this.#search.trim().toLocaleLowerCase();
    this.#filteredCommits = needle
      ? this.#page.commits.filter((commit) => {
          const author = `${commit.author?.name ?? ""} ${commit.author?.email ?? ""}`;
          return `${commit.oid} ${commit.message} ${author}`.toLocaleLowerCase().includes(needle);
        })
      : this.#page.commits;
    this.#layout = layoutGitGraph(this.#filteredCommits);
    this.#renderShell();
  }

  #renderShell(): void {
    const shell = this.#root.querySelector<HTMLElement>(".shell");
    if (!shell) return;
    const repositoryName = this.#page.repositoryName ?? this.#page.repositoryId ?? "data provider";
    shell.innerHTML = `
      <div class="toolbar">
        <div class="branch-control">
          <strong>Branches:</strong>
          <select class="ref-select" aria-label="Select branch or tag"><option value="">Show All</option></select>
        </div>
        <label class="remote-control">
          <input class="remote-toggle" type="checkbox" checked>
          <span>Show Remote Branches</span>
        </label>
        <span class="repository-name"></span>
        <div class="tools">
          <input class="search" type="search" placeholder="Find commits…" aria-label="Search commits">
          <button class="icon-button theme-toggle" type="button" aria-label="Toggle theme">◐</button>
        </div>
      </div>
      <div class="body">
        <section class="history">
          <div class="header" aria-hidden="true">
            <span>Graph</span><span>Description</span><span>Date</span><span>Author</span><span>Commit</span>
          </div>
          <div class="scroller" role="treegrid" aria-label="Git commit history" tabindex="0">
            <div class="spacer"><div class="window"></div></div>
          </div>
        </section>
        <aside class="drawer" aria-label="Commit details"></aside>
      </div>`;

    shell.querySelector<HTMLElement>(".repository-name")!.textContent = repositoryName;
    const search = shell.querySelector<HTMLInputElement>(".search")!;
    search.value = this.#search;
    search.addEventListener("input", () => {
      this.#search = search.value;
      this.#recompute();
    });
    shell.querySelector(".theme-toggle")?.addEventListener("click", () => {
      this.theme = this.theme === "light" ? "dark" : "light";
    });
    const remoteToggle = shell.querySelector<HTMLInputElement>(".remote-toggle")!;
    remoteToggle.checked = this.#showRemoteRefs;
    remoteToggle.addEventListener("change", () => {
      this.#showRemoteRefs = remoteToggle.checked;
      this.#renderWindow();
    });
    const refSelect = shell.querySelector<HTMLSelectElement>(".ref-select")!;
    for (const ref of this.#page.refs.filter(
      (item) => item.kind === "head" || item.kind === "tag" || item.kind === "remote"
    )) {
      const option = document.createElement("option");
      option.value = ref.name;
      option.textContent = ref.name.replace(/^refs\/(heads|tags|remotes)\//, "");
      refSelect.append(option);
    }
    refSelect.addEventListener("change", () => void this.#load(false, refSelect.value || undefined));
    const scroller = shell.querySelector<HTMLElement>(".scroller")!;
    scroller.addEventListener("scroll", () => {
      this.#renderWindow();
      if (
        this.#page.hasMore &&
        !this.#loadingMore &&
        scroller.scrollTop + scroller.clientHeight > scroller.scrollHeight - this.#rowHeight * 4
      ) {
        void this.#load(true);
      }
    });
    scroller.addEventListener("keydown", (event) => this.#onKeyDown(event));
    this.#renderWindow();
    this.#renderDrawer();
  }

  #renderWindow(): void {
    const scroller = this.#root.querySelector<HTMLElement>(".scroller");
    const spacer = this.#root.querySelector<HTMLElement>(".spacer");
    const windowElement = this.#root.querySelector<HTMLElement>(".window");
    if (!scroller || !spacer || !windowElement) return;

    if (this.#loading && this.#page.commits.length === 0) {
      spacer.style.height = "100%";
      windowElement.innerHTML = `<div class="loading"><slot name="loading">Reading the commit DAG…</slot></div>`;
      return;
    }
    if (this.#error && this.#page.commits.length === 0) {
      spacer.style.height = "100%";
      windowElement.innerHTML = `<div class="error"><slot name="error"></slot></div>`;
      const slot = windowElement.querySelector<HTMLSlotElement>("slot");
      if (slot) slot.textContent = this.#error;
      return;
    }
    if (this.#filteredCommits.length === 0) {
      spacer.style.height = "100%";
      windowElement.innerHTML = `<div class="empty"><slot name="empty">No commits match this view.</slot></div>`;
      return;
    }

    const graphWidth = Math.max(56, this.#layout.laneCount * 16 + 24);
    this.#root.querySelector<HTMLElement>(".shell")?.style.setProperty("--wgg-graph-width", `${graphWidth}px`);
    spacer.style.height = `${this.#filteredCommits.length * this.#rowHeight + (this.#page.hasMore ? 42 : 0)}px`;
    const visibleRows = Math.ceil(Math.max(scroller.clientHeight, 420) / this.#rowHeight);
    const start = Math.max(0, Math.floor(scroller.scrollTop / this.#rowHeight) - this.#overscan);
    const end = Math.min(this.#filteredCommits.length, start + visibleRows + this.#overscan * 2);
    windowElement.style.transform = `translateY(${start * this.#rowHeight}px)`;
    windowElement.replaceChildren();

    const svg = svgElement("svg", {
      class: "graph",
      width: `${graphWidth}`,
      height: `${(end - start) * this.#rowHeight}`,
      "aria-hidden": "true"
    });
    this.#drawGraph(svg, start, end);
    windowElement.append(svg);

    const refsByTarget = new Map<string, GitGraphRef[]>();
    for (const ref of this.#page.refs) {
      if (!this.#showRemoteRefs && ref.kind === "remote") continue;
      const existing = refsByTarget.get(ref.target) ?? [];
      existing.push(ref);
      refsByTarget.set(ref.target, existing);
    }
    const nodesByOid = new Map(this.#layout.nodes.map((node) => [node.oid, node]));
    for (let index = start; index < end; index += 1) {
      const commit = this.#filteredCommits[index]!;
      const row = document.createElement("div");
      row.className = "row";
      row.classList.toggle("merge", commit.parents.length > 1);
      row.classList.toggle("working-tree", commit.kind === "working-tree");
      if (commit.oid === this.#selectedOid) row.classList.add("selected");
      if (commit.oid === this.#compareOid) row.classList.add("compare");
      row.dataset.oid = commit.oid;
      row.dataset.index = String(index);
      row.setAttribute("role", "row");
      row.tabIndex = commit.oid === this.#selectedOid || (!this.#selectedOid && index === 0) ? 0 : -1;
      row.innerHTML = `
        <div class="graph-cell" role="gridcell"></div>
        <div class="subject" role="gridcell"><div class="refs"></div><span class="message"></span></div>
        <div class="date" role="gridcell"></div>
        <div class="author" role="gridcell"></div>
        <div class="oid" role="gridcell"></div>`;
      row.querySelector<HTMLElement>(".message")!.textContent = commit.message.split("\n", 1)[0] ?? "";
      row.querySelector<HTMLElement>(".author")!.textContent = commit.author?.name ?? "—";
      row.querySelector<HTMLElement>(".date")!.textContent = formatDate(commit.committedAt ?? commit.authoredAt);
      row.querySelector<HTMLElement>(".oid")!.textContent = shortOid(commit.oid);
      const refs = row.querySelector<HTMLElement>(".refs")!;
      const seenLabels = new Set<string>();
      for (const ref of refsByTarget.get(commit.oid) ?? []) {
        const label = ref.name.replace(/^refs\/(heads|tags|remotes)\//, "");
        const dedupeKey = ref.kind === "current" || ref.kind === "head" ? `branch:${label}` : `${ref.kind}:${label}`;
        if (seenLabels.has(dedupeKey)) continue;
        seenLabels.add(dedupeKey);
        const badge = document.createElement("span");
        badge.className = `ref ${ref.kind}`;
        const prefix =
          ref.kind === "tag" ? "◇" : ref.kind === "stash" ? "≋" : ref.kind === "remote" ? "↗" : "⑂";
        badge.textContent = `${prefix} ${label}`;
        const node = nodesByOid.get(commit.oid);
        if (node) badge.style.setProperty("--ref-color", PALETTE[node.colour % PALETTE.length]!);
        refs.append(badge);
        if (seenLabels.size >= 4) break;
      }
      row.addEventListener("click", (event) => {
        if ((event.metaKey || event.ctrlKey) && this.#selectedOid && this.#selectedOid !== commit.oid) {
          void this.compareCommits(this.#selectedOid, commit.oid);
        } else {
          this.selectCommit(commit.oid);
        }
      });
      row.addEventListener("dblclick", () => {
        if (commit.url) window.open(commit.url, "_blank", "noopener,noreferrer");
        this.dispatchEvent(
          new CustomEvent("gitgraph-commit-open", {
            bubbles: true,
            composed: true,
            detail: { commit }
          })
        );
      });
      windowElement.append(row);
    }

    if (this.#page.hasMore && end === this.#filteredCommits.length) {
      const button = document.createElement("button");
      button.className = "action load-more";
      button.type = "button";
      button.textContent = this.#loadingMore ? "Loading…" : "Load more commits";
      button.disabled = this.#loadingMore;
      button.addEventListener("click", () => {
        const event = new CustomEvent("gitgraph-load-more", {
          bubbles: true,
          composed: true,
          cancelable: true,
          detail: { cursor: this.#page.cursor }
        });
        if (this.dispatchEvent(event) && this.#provider) void this.#load(true);
      });
      windowElement.append(button);
    }
  }

  #drawGraph(svg: SVGSVGElement, start: number, end: number): void {
    const x = (lane: number) => 16 + lane * 16;
    const y = (row: number) => (row - start + 0.5) * this.#rowHeight;
    for (const segment of this.#layout.segments) {
      if (segment.to.row < start || segment.from.row >= end) continue;
      const fromRow = Math.max(start, segment.from.row);
      const toRow = Math.min(end, segment.to.row);
      const x1 = x(segment.from.lane);
      const x2 = x(segment.to.lane);
      const y1 = y(fromRow);
      const y2 = y(toRow);
      const path =
        x1 === x2
          ? `M ${x1} ${y1} L ${x2} ${y2}`
          : `M ${x1} ${y1} C ${x1} ${y1 + this.#rowHeight * 0.55}, ${x2} ${y2 - this.#rowHeight * 0.55}, ${x2} ${y2}`;
      svg.append(
        svgElement("path", {
          d: path,
          stroke: PALETTE[segment.colour % PALETTE.length]!,
          ...(segment.dangling ? { "stroke-dasharray": "3 4" } : {})
        })
      );
    }
    for (const node of this.#layout.nodes) {
      if (node.row < start || node.row >= end) continue;
      const colour = node.kind === "working-tree" ? "var(--wgg-faint)" : PALETTE[node.colour % PALETTE.length]!;
      svg.append(
        svgElement("circle", {
          cx: `${x(node.lane)}`,
          cy: `${y(node.row)}`,
          r: node.kind === "working-tree" ? "4.5" : node.kind === "stash" ? "4" : "3.5",
          fill: node.oid === this.#page.head || node.kind === "working-tree" ? "var(--wgg-bg)" : colour,
          stroke: colour
        })
      );
    }
  }

  #onKeyDown(event: KeyboardEvent): void {
    const rows = [...this.#root.querySelectorAll<HTMLElement>(".row")];
    const active = this.#root.activeElement as HTMLElement | null;
    const current = rows.indexOf(active!);
    let target = current;
    if (event.key === "ArrowDown") target = Math.min(rows.length - 1, Math.max(0, current + 1));
    else if (event.key === "ArrowUp") target = Math.max(0, current - 1);
    else if (event.key === "Home") target = 0;
    else if (event.key === "End") target = rows.length - 1;
    else if (event.key === "Enter" && active?.dataset.oid) {
      this.selectCommit(active.dataset.oid);
      return;
    } else if (event.key === "Escape") {
      this.#closeDrawer();
      return;
    } else return;
    event.preventDefault();
    rows[target]?.focus();
  }

  async #loadDetails(commit: GitGraphCommit): Promise<void> {
    if (!this.#provider?.getCommitDetails) {
      this.#details = { commit, refs: this.#page.refs.filter((ref) => ref.target === commit.oid), changes: [] };
      this.#renderDrawer();
      return;
    }
    this.#renderDrawer(true);
    try {
      this.#details = await this.#provider.getCommitDetails(
        this.#page.repositoryId,
        revisionFor(commit)
      );
    } catch (error) {
      this.#emitError(error);
    }
    this.#renderDrawer();
  }

  #renderDrawer(waiting = false): void {
    const body = this.#root.querySelector<HTMLElement>(".body");
    const drawer = this.#root.querySelector<HTMLElement>(".drawer");
    if (!body || !drawer) return;
    if (!this.#selectedOid) {
      body.classList.remove("drawer-open");
      drawer.replaceChildren();
      return;
    }
    body.classList.add("drawer-open");
    drawer.innerHTML = `
      <div class="drawer-head"><span class="drawer-title"></span><button class="icon-button close" type="button" aria-label="Close details">×</button></div>
      <div class="drawer-content"></div>`;
    drawer.querySelector(".close")?.addEventListener("click", () => this.#closeDrawer());
    const title = drawer.querySelector<HTMLElement>(".drawer-title")!;
    const content = drawer.querySelector<HTMLElement>(".drawer-content")!;
    if (this.#compareOid) {
      title.textContent = "Commit comparison";
      if (waiting || !this.#comparison) {
        content.innerHTML = `<div class="loading">Calculating tree difference…</div>`;
      } else {
        this.#renderComparison(content, this.#comparison);
      }
      return;
    }
    title.textContent = "Commit details";
    const commit = this.#details?.commit ?? this.#page.commits.find((item) => item.oid === this.#selectedOid);
    if (!commit || waiting) {
      content.innerHTML = `<div class="loading">Reading commit object…</div>`;
      return;
    }
    const heading = document.createElement("h2");
    heading.className = "commit-title";
    heading.textContent = commit.message.split("\n", 1)[0] ?? commit.oid;
    content.append(heading);
    const meta = document.createElement("dl");
    meta.className = "meta";
    const fields: Array<readonly [string, string]> = [
      ["SHA", commit.oid],
      ["Author", `${commit.author?.name ?? "Unknown"}${commit.author?.email ? ` <${commit.author.email}>` : ""}`],
      ["Committed", formatDate(commit.committedAt ?? commit.authoredAt)],
      ["Parents", commit.parents.map(shortOid).join(", ") || "root commit"]
    ];
    for (const [label, value] of fields) {
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.textContent = label;
      dd.textContent = value;
      meta.append(dt, dd);
    }
    content.append(meta);
    const actions = document.createElement("div");
    actions.className = "actions";
    actions.innerHTML = `<button class="action primary copy" type="button">Copy SHA</button><button class="action compare-action" type="button">Compare with…</button>`;
    actions.querySelector(".copy")?.addEventListener("click", () => void navigator.clipboard.writeText(commit.oid));
    actions.querySelector(".compare-action")?.addEventListener("click", () => {
      title.textContent = "Select another commit";
      this.#root.querySelector<HTMLElement>(".scroller")?.focus();
    });
    if (commit.url) {
      const open = document.createElement("button");
      open.className = "action";
      open.textContent = "Open remote ↗";
      open.addEventListener("click", () => window.open(commit.url, "_blank", "noopener,noreferrer"));
      actions.append(open);
    }
    content.append(actions);
    if (this.#details?.changes.length) this.#renderChanges(content, this.#details.changes);
  }

  #renderComparison(content: HTMLElement, comparison: GitGraphComparison): void {
    const heading = document.createElement("h2");
    heading.className = "commit-title";
    heading.textContent = `${this.#revisionLabel(comparison.base)} → ${this.#revisionLabel(comparison.head)}`;
    content.append(heading);
    const summary = document.createElement("p");
    summary.className = "stats";
    summary.textContent = `${comparison.changes.length} files · +${comparison.additions} −${comparison.deletions}${comparison.truncated ? " · truncated" : ""}`;
    content.append(summary);
    this.#renderChanges(content, comparison.changes, comparison);
    if (this.#fileDiff) {
      const patch = document.createElement("pre");
      patch.className = "patch";
      patch.textContent =
        this.#fileDiff.patch ??
        this.#fileDiff.unavailableReason ??
        (this.#fileDiff.binary ? "Binary file — patch unavailable." : "No textual patch.");
      content.append(patch);
    }
  }

  #renderChanges(
    content: HTMLElement,
    changes: readonly GitGraphCommitDetails["changes"][number][],
    comparison?: GitGraphComparison
  ): void {
    const list = document.createElement("div");
    list.className = "changes";
    for (const change of changes) {
      const button = document.createElement("button");
      button.className = "change";
      button.type = "button";
      const code = document.createElement("span");
      code.className = "change-code";
      code.textContent = change.kind.slice(0, 1).toUpperCase();
      const path = document.createElement("span");
      path.className = "change-path";
      path.textContent = change.previousPath ? `${change.previousPath} → ${change.path}` : change.path;
      const stats = document.createElement("span");
      stats.className = "stats";
      stats.textContent =
        change.binary
          ? "binary"
          : `${change.additions === undefined ? "" : `+${change.additions}`} ${change.deletions === undefined ? "" : `−${change.deletions}`}`.trim();
      button.append(code, path, stats);
      button.addEventListener("click", async () => {
        this.dispatchEvent(
          new CustomEvent("gitgraph-file-open", {
            bubbles: true,
            composed: true,
            detail: { change, comparison }
          })
        );
        if (!comparison || !this.#provider?.getFileDiff) return;
        try {
          this.#fileDiff = await this.#provider.getFileDiff(
            this.#page.repositoryId,
            comparison.base,
            comparison.head,
            change.path,
            3
          );
        } catch (error) {
          this.#emitError(error);
        }
        this.#renderDrawer();
      });
      list.append(button);
    }
    content.append(list);
  }

  #revisionLabel(revision: GitGraphRevision): string {
    if (revision.kind === "working-tree") return "working tree";
    return shortOid(revision.oid);
  }

  #closeDrawer(): void {
    this.#selectedOid = undefined;
    this.#compareOid = undefined;
    this.#details = undefined;
    this.#comparison = undefined;
    this.#fileDiff = undefined;
    this.#renderWindow();
    this.#renderDrawer();
  }

  async #load(append: boolean, ref?: string): Promise<void> {
    if (!this.#provider || (append && !this.#page.hasMore)) return;
    this.#abort?.abort();
    this.#abort = new AbortController();
    this.#loading = !append;
    this.#loadingMore = append;
    this.#error = undefined;
    this.#renderWindow();
    try {
      const page = await this.#provider.getHistory({
        repositoryId: this.#page.repositoryId,
        ref,
        cursor: append ? this.#page.cursor : undefined,
        limit: 200,
        includeWorkingTree: true,
        signal: this.#abort.signal
      });
      if (append) this.appendPage(page);
      else this.setData(page);
    } catch (error) {
      if (this.#abort.signal.aborted) return;
      this.#emitError(error);
    } finally {
      this.#loading = false;
      this.#loadingMore = false;
      this.#renderWindow();
    }
  }

  #emitError(error: unknown): void {
    this.#error = error instanceof Error ? error.message : String(error);
    this.dispatchEvent(
      new CustomEvent("gitgraph-error", {
        bubbles: true,
        composed: true,
        detail: { error }
      })
    );
    this.#renderWindow();
  }
}

export function defineWebGitGraph(name = ELEMENT_NAME): typeof WebGitGraphElement {
  if (typeof customElements !== "undefined" && !customElements.get(name)) {
    customElements.define(name, WebGitGraphElement);
  }
  return WebGitGraphElement;
}

declare global {
  interface HTMLElementTagNameMap {
    "web-git-graph": WebGitGraphElement;
  }
}
