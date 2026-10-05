import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { gzipSync } from "node:zlib";
import { checkIn, joinAs, review, uniqueName } from "./helpers";

const SCREENS = [
  "/",
  "/?view=list",
  "/s/18-w-18th-st",
  "/ranks",
  "/ranks?by=coffee",
  "/passport",
  "/crew",
];

async function noHorizontalScroll(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, page.url()).toBeLessThanOrEqual(clientWidth);
}

test.describe("signed out", () => {
  test("every screen shows the members-only gate and no crew data", async ({ page }) => {
    for (const path of SCREENS) {
      await page.goto(path);
      await expect(page.getByText("Members only.")).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
      // The page HTML itself must not carry crew data (not just hide it).
      expect(await page.content(), path).not.toContain("Crew favorites");
    }
  });
});

test.describe("signed in", () => {
  test.beforeEach(async ({ page }) => {
    await joinAs(page);
  });

  test("deep links open a station; unknown ones show not found", async ({ page }) => {
    const take = uniqueName("Cold brew slaps");
    await review(page.request, "dock-72", { scores: { coffee: 5, vibe: 4 }, hotTake: take });
    await page.goto("/s/dock-72");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dock 72");
    await expect(page.getByText(take).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Edit your rating" })).toBeVisible();
    await page.goto("/s/not-a-real-station");
    await expect(page.getByText("That page isn't on the map.")).toBeVisible();
  });

  test("filters live in the URL and survive Back", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "List" }).click();
    await page.getByRole("button", { name: "Brooklyn" }).click();
    await expect(page).toHaveURL(/area=brooklyn/);
    await expect(page).toHaveURL(/view=list/);
    const rows = page
      .getByRole("main")
      .getByRole("link", { name: /Dock 72|Dumbo Heights|195 Montague|134 N 4th/ });
    await expect(rows).toHaveCount(4);
    await expect(page.getByRole("link", { name: /1460 Broadway/ })).toHaveCount(0);

    await rows.filter({ hasText: "Dock 72" }).click();
    await expect(page).toHaveURL(/\/s\/dock-72$/);
    await page.goBack();
    await expect(page).toHaveURL(/area=brooklyn/);
    await expect(page.getByRole("button", { name: "Brooklyn" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("search narrows the list", async ({ page }) => {
    await page.goto("/?view=list");
    await page.getByRole("searchbox", { name: "Search stations" }).fill("lexington");
    await expect(page.getByRole("main").getByRole("link", { name: /Lexington/ })).toHaveCount(3);
    await expect(page).toHaveURL(/q=lexington/);
  });

  test("tapping a map pin opens its preview", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^33 Irving Pl,/ }).click();
    const sheet = page.getByRole("dialog", { name: "33 Irving Pl preview" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("link", { name: "View station" }).click();
    await expect(page).toHaveURL(/\/s\/33-irving-pl$/);
  });

  test("ranks sort by a category", async ({ page }) => {
    await review(page.request, "524-broadway", { scores: { coffee: 5 } });
    await page.goto("/ranks");
    await page.getByRole("link", { name: "Coffee" }).click();
    await expect(page).toHaveURL(/by=coffee/);
    await expect(page.getByRole("heading", { name: "Best for coffee" })).toBeVisible();
    await expect(page.getByRole("link", { name: /524 Broadway/ })).toBeVisible();
  });

  test("the passport is personal", async ({ page, browser }, info) => {
    await checkIn(page.request, "379-w-broadway");
    await page.goto("/passport");
    const mine = page.getByRole("region", { name: "Your stamps" });
    await expect(mine.getByRole("link", { name: /^379 W Broadway, first visit/ })).toBeVisible();

    // Someone else's passport doesn't get my stamp.
    const other = await (await browser.newContext({ ...info.project.use })).newPage();
    await joinAs(other);
    await other.goto("/passport");
    await expect(
      other
        .getByRole("region", { name: "Your stamps" })
        .getByRole("link", { name: /379 W Broadway/ }),
    ).toHaveCount(0);
  });

  test("no screen scrolls sideways", async ({ page }) => {
    for (const path of SCREENS) {
      await page.goto(path);
      await noHorizontalScroll(page);
    }
  });

  test("no accessibility violations (axe, WCAG 2.1 A/AA)", async ({ page }) => {
    await review(page.request, "33-irving-pl", {
      scores: { coffee: 4, wifi: 2 },
      hotTake: "Fine. Fine!",
    });
    for (const path of SCREENS) {
      await page.goto(path);
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(
        violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
        path,
      ).toEqual([]);
    }
  });

  test("first load ships under 150 KB of JS + CSS, gzipped", async ({ page }) => {
    const assets = new Set<string>();
    page.on("response", (r) => {
      const type = r.request().resourceType();
      if (type === "script" || type === "stylesheet") assets.add(r.url());
    });
    await page.goto("/", { waitUntil: "networkidle" });
    let total = 0;
    for (const url of assets) total += gzipSync(await (await page.request.get(url)).body()).length;
    console.log(`first-load JS + CSS: ${(total / 1024).toFixed(1)} KB gzipped`);
    expect(total).toBeLessThan(150 * 1024);
  });
});
