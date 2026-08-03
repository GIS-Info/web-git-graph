import { expect, test, type Page } from "@playwright/test";

const BACKEND_DEMO = "/web-git-graph/?backend=http://127.0.0.1:4174&repository=local";

// Web fonts finishing to load between two measurements shifts the layout by a
// pixel and breaks geometry and pixel assertions on slower CI runners.
async function gotoDemo(page: Page, url = "/web-git-graph/"): Promise<void> {
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

test("renders the graph and opens commit details", async ({ page }) => {
  await gotoDemo(page);
  const graph = page.locator("web-git-graph");
  await expect(graph).toBeVisible();
  await expect(page.getByRole("heading", { name: /git history/i })).toBeVisible();

  const firstRow = graph.locator(".row").first();
  const secondRow = graph.locator(".row").nth(1);
  await firstRow.click();
  const details = graph.locator(".inline-details");
  await expect(details).toBeVisible();
  await expect(details.locator(".meta")).toContainText("a91de840");
  await expect(details.locator(".commit-body")).toContainText("Merge release");
  await expect(details.locator(".details-files")).toContainText("No file changes");
  await page.waitForTimeout(150);

  const firstBox = await firstRow.boundingBox();
  const detailsBox = await details.boundingBox();
  const secondBox = await secondRow.boundingBox();
  expect(firstBox).not.toBeNull();
  expect(detailsBox).not.toBeNull();
  expect(secondBox).not.toBeNull();
  expect(Math.abs(detailsBox!.y - (firstBox!.y + firstBox!.height))).toBeLessThanOrEqual(1);
  expect(Math.abs(secondBox!.y - (detailsBox!.y + detailsBox!.height))).toBeLessThanOrEqual(1);

  await graph.getByRole("button", { name: "Close details" }).click();
  await expect(details).toHaveCount(0);
});

test("highlights search matches without collapsing the graph", async ({ page }) => {
  await gotoDemo(page);
  const graph = page.locator("web-git-graph");
  const rowCount = await graph.locator(".row").count();

  await graph.locator(".search").fill("octopus-does-not-exist");
  await expect(graph.locator(".search-count")).toHaveText("0/0");
  // The DAG stays intact while searching: no rows are filtered away.
  await expect(graph.locator(".row")).toHaveCount(rowCount);

  await graph.locator(".search").fill("provider");
  await expect(graph.locator(".search-count")).toHaveText("1/1");
  await expect(graph.locator(".row.match")).toHaveCount(1);
  await expect(graph.locator(".row.match-current")).toHaveCount(1);
  await expect(graph.locator(".row")).toHaveCount(rowCount);

  const initialTheme = await graph.getAttribute("theme");
  await graph.locator(".theme-toggle").click();
  await expect(graph).toHaveAttribute(
    "theme",
    initialTheme === "light" ? "dark" : "light"
  );
});

test("search keeps focus and matches while typing key by key", async ({ page }) => {
  await gotoDemo(page);
  const graph = page.locator("web-git-graph");
  const search = graph.locator(".search");
  await search.click();
  await page.keyboard.type("provider", { delay: 40 });
  // Every keystroke re-renders match state; the input must survive all of
  // them without being rebuilt (which would drop focus and swallow keys).
  await expect(search).toHaveValue("provider");
  await expect(search).toBeFocused();
  await expect(graph.locator(".search-count")).toHaveText("1/1");
});

test("renders compact slashed dates and honours the column and date settings", async ({ page }) => {
  await gotoDemo(page);
  const graph = page.locator("web-git-graph");
  const date = graph.locator(".row .date").first();
  await expect(date).toHaveText(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/);

  await graph.evaluate((element) => element.setAttribute("date-format", "date"));
  await expect(date).toHaveText(/^\d{4}\/\d{2}\/\d{2}$/);
  await graph.evaluate((element) => element.setAttribute("date-format", "relative"));
  await expect(date).not.toHaveText(/^\d{4}\//);

  // Hiding a column collapses its track instead of shifting the others.
  await graph.evaluate((element) => element.setAttribute("columns", "commit"));
  await expect(graph.locator(".row .date").first()).toBeHidden();
  await expect(graph.locator(".row .author").first()).toBeHidden();
  await expect(graph.locator(".row .oid").first()).toBeVisible();
});

test("emphasises the checked-out branch with a solid chip", async ({ page }) => {
  await gotoDemo(page);
  const graph = page.locator("web-git-graph");
  const alpha = async (selector: string): Promise<number> => {
    const colour = await graph.locator(selector).first().evaluate(
      (element) => getComputedStyle(element).backgroundColor
    );
    const channels = colour.match(/[\d.]+/g) ?? [];
    return channels.length >= 4 ? Number(channels[3]) : 1;
  };
  // The current branch is filled; every other branch is a translucent tint
  // inside a lane-coloured border.
  expect(await alpha(".ref.current")).toBe(1);
  expect(await alpha(".ref.head:not(.current)")).toBeLessThan(1);

  // Remote branches recede by colour: a grey outline with no fill at all.
  await gotoDemo(page, BACKEND_DEMO);
  await expect(graph.locator(".repository-name")).toHaveText("web-git-graph");
  const remote = graph.locator(".ref.remote").first();
  await expect(remote).toBeVisible();
  expect(await alpha(".ref.remote")).toBe(0);
  expect(
    await remote.evaluate((element) => getComputedStyle(element).borderTopStyle)
  ).toBe("solid");
});

test("shows author avatars only when enabled", async ({ page }) => {
  // Gravatar is never reached in tests; the locally drawn initial must stand in.
  await page.route("**gravatar.com/**", (route) => route.abort());
  await gotoDemo(page);
  const graph = page.locator("web-git-graph");
  await expect(graph.locator(".row .avatar")).toHaveCount(0);

  await graph.evaluate((element) => element.setAttribute("avatars", ""));
  const avatar = graph.locator(".row .avatar").first();
  await expect(avatar).toBeVisible();
  await expect(avatar).toHaveText(/^[A-Z0-9?]$/);
});

test("opens a commit context menu without disturbing the selection", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await gotoDemo(page);
  const graph = page.locator("web-git-graph");
  const row = graph.locator(".row").nth(1);

  await row.click({ button: "right" });
  const menu = graph.locator(".menu[data-menu='commit']");
  await expect(menu).toBeVisible();
  // Right-clicking must not open, close or re-animate the details panel.
  await expect(graph.locator(".inline-details")).toHaveCount(0);

  const oid = (await row.locator(".oid").textContent())?.trim();
  await menu.getByText("Copy Commit Hash").click();
  await expect(menu).toHaveCount(0);
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard.startsWith(oid!)).toBe(true);

  // The same gesture on a selected row leaves the open panel in place.
  await row.click();
  await expect(graph.locator(".inline-details")).toBeVisible();
  await row.click({ button: "right" });
  await expect(graph.locator(".menu[data-menu='commit']")).toBeVisible();
  await expect(graph.locator(".inline-details")).toBeVisible();
  await expect(graph.locator(".row.selected")).toHaveCount(1);
});

test("right-clicking a row changes nothing but the menu", async ({ page }) => {
  await gotoDemo(page);
  const graph = page.locator("web-git-graph");
  const row = graph.locator(".row").nth(3);
  await row.hover();

  const before = await graph.evaluate((element) => {
    const root = element.shadowRoot!;
    const target = root.querySelectorAll<HTMLElement>(".row")[3]!;
    const style = getComputedStyle(target);
    return {
      background: style.backgroundColor,
      focused: root.activeElement === target,
      rows: root.querySelectorAll(".row").length
    };
  });

  await row.click({ button: "right" });
  await expect(graph.locator(".menu[data-menu='commit']")).toBeVisible();
  const during = await graph.evaluate((element) => {
    const root = element.shadowRoot!;
    const target = root.querySelectorAll<HTMLElement>(".row")[3]!;
    const style = getComputedStyle(target);
    return {
      background: style.backgroundColor,
      focused: root.activeElement === target,
      rows: root.querySelectorAll(".row").length,
      marked: target.classList.contains("context-active")
    };
  });

  // The row keeps its highlight even though the menu covers the pointer, the
  // row count is untouched, and right-clicking never steals focus.
  expect(during.background).toBe(before.background);
  expect(during.rows).toBe(before.rows);
  expect(during.marked).toBe(true);
  expect(before.focused).toBe(false);
  expect(during.focused).toBe(false);

  await page.keyboard.press("Escape");
  await expect(graph.locator(".menu")).toHaveCount(0);
  await expect(graph.locator(".row.context-active")).toHaveCount(0);
});

test("refreshing keeps the scroll position and the open commit", async ({ page }) => {
  await gotoDemo(page, BACKEND_DEMO);
  const graph = page.locator("web-git-graph");
  await expect(graph.locator(".repository-name")).toHaveText("web-git-graph");

  await graph.locator(".row").nth(4).click();
  await expect(graph.locator(".inline-details")).toBeVisible();
  const selected = await graph.locator(".row.selected .oid").textContent();
  const scrollTop = await graph.evaluate((element) => {
    const scroller = element.shadowRoot!.querySelector<HTMLElement>(".scroller")!;
    scroller.scrollTop = 120;
    return scroller.scrollTop;
  });
  expect(scrollTop).toBe(120);

  // The host refreshes on every Git change, so a refresh must not throw the
  // reader back to the top or close what they were reading.
  await graph.locator(".refresh").click();
  await expect(graph.locator(".inline-details")).toBeVisible();
  await expect(graph.locator(".row.selected .oid")).toHaveText(selected!);
  await expect
    .poll(() =>
      graph.evaluate(
        (element) => element.shadowRoot!.querySelector<HTMLElement>(".scroller")!.scrollTop
      )
    )
    .toBe(120);
});

test("does not replay the details animation when the window re-renders", async ({ page }) => {
  await gotoDemo(page, BACKEND_DEMO);
  const graph = page.locator("web-git-graph");
  await expect(graph.locator(".repository-name")).toHaveText("web-git-graph");
  await graph.locator(".row").nth(1).click();
  const details = graph.locator(".inline-details");
  await expect(details).toBeVisible();

  // The open animation must run exactly once. Re-rendering the window — a
  // scroll tick, a right-click, any state change — used to recreate the panel
  // node and replay the fade, which is what read as a flicker.
  const replayed = await graph.evaluate(async (element) => {
    const root = element.shadowRoot!;
    const scroller = root.querySelector<HTMLElement>(".scroller")!;
    const panel = root.querySelector<HTMLElement>(".inline-details")!;
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (panel.getAnimations().length > 0) return "animation still running before the test";
    scroller.scrollTop += 40;
    scroller.dispatchEvent(new Event("scroll"));
    const current = root.querySelector<HTMLElement>(".inline-details");
    if (current !== panel) return "panel node was recreated";
    return current.getAnimations().length > 0 ? "animation replayed" : "";
  });
  expect(replayed).toBe("");
  await expect(details).toBeVisible();
});

test("filters history by several branches at once", async ({ page }) => {
  await gotoDemo(page, BACKEND_DEMO);
  const graph = page.locator("web-git-graph");
  await expect(graph.locator(".repository-name")).toHaveText("web-git-graph");
  // Each tick re-requests the history; the walked tips travel as repeated
  // `ref` query parameters.
  const walkedRefs: string[][] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith("/history")) walkedRefs.push(url.searchParams.getAll("ref"));
  });

  await graph.locator(".ref-select").click();
  const menu = graph.locator(".menu[data-menu='refs']");
  await expect(menu).toBeVisible();
  await expect(menu.locator(".menu-item").first()).toContainText("Show All");
  await expect(menu.locator(".menu-group", { hasText: "Local Branches" })).toBeVisible();

  const branch = menu.locator(".menu-item").nth(1);
  const branchName = (await branch.locator(".menu-label").textContent())!.trim();
  await branch.click();
  await expect(graph.locator(".ref-select-label")).toHaveText(branchName);
  await expect(branch.locator(".menu-check")).toHaveText("✓");
  await expect.poll(() => walkedRefs.at(-1)).toEqual([`refs/heads/${branchName}`]);

  // The menu stays open so a second ref can be ticked in the same pass.
  await expect(menu).toBeVisible();
  const tag = menu.locator(".menu-item").last();
  await tag.click();
  await expect(graph.locator(".ref-select-label")).toHaveText("2 selected");
  await expect.poll(() => walkedRefs.at(-1)?.length).toBe(2);
  await expect(graph.locator(".row").first()).toBeVisible();

  await graph.locator(".ref-select").click();
  await expect(menu).toHaveCount(0);
});

test("refresh reloads the graph from the provider", async ({ page }) => {
  await gotoDemo(page, BACKEND_DEMO);
  const graph = page.locator("web-git-graph");
  await expect(graph.locator(".repository-name")).toHaveText("web-git-graph");

  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/history")) requests.push(request.url());
  });
  await graph.locator(".refresh").click();
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  await expect(graph.locator(".row").first()).toBeVisible();
});

test("switches and persists page language and theme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await gotoDemo(page);
  const graph = page.locator("web-git-graph");

  await page.getByRole("button", { name: "中文", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.getByRole("heading", { name: /让 Git 历史/i })).toBeVisible();

  await page.getByRole("button", { name: "切换到深色主题", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(graph).toHaveAttribute("theme", "dark");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(graph).toHaveAttribute("theme", "dark");
});

test("keeps graph lanes visible while a commit row is hovered", async ({ page }) => {
  await gotoDemo(page);
  const graph = page.locator("web-git-graph");
  await graph.locator(".row").nth(1).hover();

  // Pixel comparisons are unstable across renderers, so assert the paint
  // order directly: with hit-testing enabled on the lane SVG, the topmost
  // element at a node centre must be the commit circle, not the hovered row.
  const topmost = await graph.evaluate((element) => {
    const root = element.shadowRoot!;
    const svg = root.querySelector<SVGSVGElement>(".graph")!;
    const node = svg.querySelectorAll("circle")[1]!;
    const box = node.getBoundingClientRect();
    svg.style.pointerEvents = "auto";
    const hit = root.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    svg.style.pointerEvents = "";
    return hit?.tagName.toLowerCase() ?? null;
  });
  expect(topmost).toBe("circle");
});

test("keeps lane curves compact while commit details are expanded", async ({ page }) => {
  await gotoDemo(page);
  const graph = page.locator("web-git-graph");

  // The bend of a lane transition must always complete within one row height.
  // When the inline details panel is expanded between the two rows a segment
  // connects, the remaining gap has to be crossed vertically instead of
  // stretching the curve across the panel.
  const maxCurveSpan = async (): Promise<number> => {
    const paths = await graph.evaluate((element) => {
      const svg = element.shadowRoot!.querySelector<SVGSVGElement>(".graph")!;
      return [...svg.querySelectorAll("path")]
        .map((path) => path.getAttribute("d")!)
        .filter((d) => d.includes("C"));
    });
    expect(paths.length).toBeGreaterThan(0);
    return Math.max(
      ...paths.map((d) => {
        const tokens = d.replace(/,/g, " ").split(/\s+/);
        let lastY = 0;
        for (let index = 0; index < tokens.length; index += 1) {
          if (tokens[index] === "M" || tokens[index] === "L") {
            lastY = Number(tokens[index + 2]);
            index += 2;
          } else if (tokens[index] === "C") {
            return Number(tokens[index + 6]) - lastY;
          }
        }
        return 0;
      })
    );
  };

  // Branch-out: the selected merge commit fans out to parents on other lanes.
  await graph.locator(".row").nth(2).click();
  await expect(graph.locator(".inline-details")).toBeVisible();
  expect(await maxCurveSpan()).toBeLessThanOrEqual(25);

  // Merge-in: lanes below the expanded row converge into the next commit.
  await graph.locator(".row").nth(5).click();
  await expect(graph.locator(".inline-details")).toBeVisible();
  expect(await maxCurveSpan()).toBeLessThanOrEqual(25);
});

test("connects the demo to the local Node backend through HTTP", async ({ page }) => {
  await gotoDemo(page, BACKEND_DEMO);
  const graph = page.locator("web-git-graph");

  await expect(page.locator("#status")).toContainText("127.0.0.1:4174");
  // The exact repository name proves the backend page replaced the demo
  // fixture ("web-git-graph / protocol-lab") instead of silently failing.
  await expect(graph.locator(".repository-name")).toHaveText("web-git-graph");
  await expect(graph.locator(".oid").first()).not.toHaveText("");

  await graph.locator(".row").nth(1).click();
  await expect(graph.locator(".inline-details .meta")).toContainText("Commit");
  const firstFile = graph.locator(".inline-details .tree-file").first();
  await expect(firstFile).toBeVisible();

  // Clicking a file in single-commit details renders its patch inline.
  await firstFile.click();
  await expect(graph.locator(".inline-details .patch")).toBeVisible();
  await expect(firstFile).toHaveClass(/active/);
});
