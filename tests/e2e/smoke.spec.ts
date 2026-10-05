import { expect, test } from "@playwright/test";

test("home renders at phone width without horizontal scroll", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("WeWalk");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("WeWalk");

  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
});

test("body paints the theme background, not transparent", async ({ page }) => {
  await page.goto("/");
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).not.toBe("rgba(0, 0, 0, 0)");
});
