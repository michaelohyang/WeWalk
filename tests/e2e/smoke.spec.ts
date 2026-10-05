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

// --bg in src/ui/tokens.css: #ffffff light, #0c0e0e dark
const BG = { light: "rgb(255, 255, 255)", dark: "rgb(12, 14, 14)" } as const;

test("body paints the background for the color scheme", async ({ page }, testInfo) => {
  await page.goto("/");
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe(testInfo.project.use.colorScheme === "dark" ? BG.dark : BG.light);
});

test("an explicit data-theme overrides the system color scheme", async ({ page }, testInfo) => {
  await page.goto("/");
  const forced = testInfo.project.use.colorScheme === "dark" ? "light" : "dark";
  const bg = await page.evaluate((theme) => {
    document.documentElement.dataset.theme = theme;
    return getComputedStyle(document.body).backgroundColor;
  }, forced);
  expect(bg).toBe(BG[forced]);
});
