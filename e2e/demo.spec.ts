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
