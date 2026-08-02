import { expect, test, type Page } from "@playwright/test";

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

test("filters commits and switches theme", async ({ page }) => {
  await gotoDemo(page);
  const graph = page.locator("web-git-graph");
  await graph.locator(".search").fill("octopus-does-not-exist");
  await expect(graph.locator(".empty")).toBeVisible();
  await graph.locator(".search").fill("provider");
  await expect(graph.locator(".row")).toHaveCount(1);
  const initialTheme = await graph.getAttribute("theme");
  await graph.locator(".theme-toggle").click();
  await expect(graph).toHaveAttribute(
    "theme",
    initialTheme === "light" ? "dark" : "light"
  );
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

test("connects the demo to the local Node backend through HTTP", async ({ page }) => {
  await gotoDemo(
    page,
    "/web-git-graph/?backend=http://127.0.0.1:4174&repository=local"
  );
  const graph = page.locator("web-git-graph");

  await expect(page.locator("#status")).toContainText("127.0.0.1:4174");
  // The exact repository name proves the backend page replaced the demo
  // fixture ("web-git-graph / protocol-lab") instead of silently failing.
  await expect(graph.locator(".repository-name")).toHaveText("web-git-graph");
  await expect(graph.locator(".oid").first()).not.toHaveText("");

  await graph.locator(".row").nth(1).click();
  await expect(graph.locator(".inline-details .meta")).toContainText("Commit");
  await expect(graph.locator(".inline-details .tree-file").first()).toBeVisible();
});
