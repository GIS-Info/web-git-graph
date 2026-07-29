import { expect, test } from "@playwright/test";

test("renders the graph and opens commit details", async ({ page }) => {
  await page.goto("/web-git-graph/");
  const graph = page.locator("web-git-graph");
  await expect(graph).toBeVisible();
  await expect(page.getByRole("heading", { name: /commit dag/i })).toBeVisible();

  const firstRow = graph.locator(".row").first();
  await firstRow.click();
  await expect(graph.locator(".drawer-title")).toHaveText("Commit details");
  await expect(graph.locator(".commit-title")).toContainText("Merge release");
});

test("filters commits and switches theme", async ({ page }) => {
  await page.goto("/web-git-graph/");
  const graph = page.locator("web-git-graph");
  await graph.locator(".search").fill("octopus-does-not-exist");
  await expect(graph.locator(".empty")).toBeVisible();
  await graph.locator(".search").fill("provider");
  await expect(graph.locator(".row")).toHaveCount(1);
  await graph.locator(".theme-toggle").click();
  await expect(graph).toHaveAttribute("theme", "light");
});

test("keeps graph lanes visible while a commit row is hovered", async ({ page }) => {
  await page.goto("/web-git-graph/");
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
