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
  await expect(page.getByRole("heading", { name: /commit dag/i })).toBeVisible();

  const firstRow = graph.locator(".row").first();
  const secondRow = graph.locator(".row").nth(1);
  await firstRow.click();
  const details = graph.locator(".inline-details");
  await expect(details).toBeVisible();
  await expect(graph.locator(".details-title")).toHaveText("Commit details");
  await expect(graph.locator(".commit-title")).toContainText("Merge release");
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
  await graph.locator(".theme-toggle").click();
  await expect(graph).toHaveAttribute("theme", "light");
});

test("keeps graph lanes visible while a commit row is hovered", async ({ page }) => {
  await gotoDemo(page);
  const graph = page.locator("web-git-graph");
  const row = graph.locator(".row").nth(1);
  const node = graph.locator(".graph circle").nth(1);
  await row.scrollIntoViewIfNeeded();
  const box = await node.boundingBox();
  expect(box).not.toBeNull();

  const clip = {
    x: Math.floor(box!.x + box!.width / 2),
    y: Math.floor(box!.y + box!.height / 2),
    width: 1,
    height: 1
  };
  const before = await page.screenshot({ clip });
  await row.hover();
  const after = await page.screenshot({ clip });

  expect(after.equals(before)).toBe(true);
});

test("connects the demo to the local Node backend through HTTP", async ({ page }) => {
  await gotoDemo(
    page,
    "/web-git-graph/?backend=http://127.0.0.1:4174&repository=local"
  );
  const graph = page.locator("web-git-graph");

  await expect(page.locator("#status")).toContainText("127.0.0.1:4174");
  await expect(graph.locator(".row").first()).toBeVisible();
  await expect(graph.locator(".oid").first()).not.toHaveText("");
});
