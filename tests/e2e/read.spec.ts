import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { gzipSync } from "node:zlib";
import { checkIn, joinAs, review, uniqueName } from "./helpers";

const SCREENS = [
  "/",
  "/?view=list",
  "/stations/18-w-18th-st",
  "/ranks",
  "/ranks?by=coffee&area=downtown",
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

// The result list only: other links (Here today, favorites) can name the same buildings.
const listRows = (page: Page, name: RegExp) =>
  page.getByRole("group", { name: "Matching stations" }).getByRole("link", { name });
const chip = (page: Page, name: string) => page.getByRole("link", { name, exact: true });

test.describe("signed out", () => {
  test("every screen asks you to log in and shows no crew data", async ({ page }) => {
    for (const path of SCREENS) {
      await page.goto(path);
      await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
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
    await page.goto("/stations/dock-72");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dock 72");
    await expect(page.getByText(take).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Edit your rating" })).toBeVisible();
    await page.goto("/stations/not-a-real-station");
    await expect(page.getByText("That page isn't on the map.")).toBeVisible();
  });

  test("filters live in the URL and survive Back", async ({ page }) => {
    await page.goto("/");
    await chip(page, "List").click();
    await chip(page, "Brooklyn").click();
    await expect(page).toHaveURL(/area=brooklyn/);
    await expect(page).toHaveURL(/view=list/);
    const rows = listRows(page, /Dock 72|Dumbo Heights|195 Montague|134 N 4th/);
    await expect(rows).toHaveCount(4);
    await expect(listRows(page, /1460 Broadway/)).toHaveCount(0);

    await rows.filter({ hasText: "Dock 72" }).click();
    await expect(page).toHaveURL(/\/stations\/dock-72$/);
    await page.goBack();
    await expect(page).toHaveURL(/area=brooklyn/);
    await expect(chip(page, "Brooklyn")).toHaveAttribute("aria-current", "true");

    // Home returns to the same filtered list, not bare Explore.
    await listRows(page, /Dumbo Heights/).click();
    await expect(page).toHaveURL(/\/stations\/dumbo-heights$/);
    await page.getByRole("link", { name: "Home" }).click();
    await expect(page).toHaveURL(/area=brooklyn/);
    await expect(page).toHaveURL(/view=list/);
  });

  // A station page offers Home, not Back: after posting a review, Back would reopen the form.
  test("a station page's Home button goes to Explore, even from a shared link", async ({
    page,
  }) => {
    await page.goto("/stations/dock-72");
    await expect(page.getByRole("link", { name: "Back" })).toHaveCount(0);
    await page.getByRole("link", { name: "Home" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("the in-app Back button never leaves the app", async ({ page }) => {
    // A shared link to the rate form: the entry before isn't WeWalk, so Back goes to the
    // building instead of out of the app.
    await page.goto("/rate/dock-72");
    await page.getByRole("link", { name: "Back" }).click();
    await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/stations\/dock-72$/);
  });

  test("filters and search work before JavaScript loads (plain links and a GET form)", async ({
    browser,
  }, info) => {
    const context = await browser.newContext({ ...info.project.use, javaScriptEnabled: false });
    const page = await context.newPage();
    await joinAs(page);
    await page.goto("/");
    await chip(page, "List").click();
    await expect(page).toHaveURL(/view=list/);
    await chip(page, "Uptown").click();
    await expect(page).toHaveURL(/area=uptown/);
    await expect(listRows(page, /8 W 126th/)).toBeVisible();
    await page.getByRole("searchbox", { name: "Search stations" }).fill("park");
    await page.getByRole("searchbox", { name: "Search stations" }).press("Enter");
    await expect(page).toHaveURL(/q=park/);
    await expect(page).toHaveURL(/area=uptown/);
    await expect(listRows(page, /430 Park Ave/)).toBeVisible();
    await context.close();
  });

  test("search narrows the list", async ({ page }) => {
    await page.goto("/?view=list");
    await page.getByRole("searchbox", { name: "Search stations" }).fill("lexington");
    await expect(listRows(page, /Lexington/)).toHaveCount(3);
    await expect(page).toHaveURL(/q=lexington/);
  });

  test("rows say whether you've been or only the crew has", async ({ page, browser }, info) => {
    await checkIn(page.request, "135-madison-ave");
    const other = await (await browser.newContext({ ...info.project.use })).newPage();
    await joinAs(other);
    await other.goto("/?view=list&q=135%20madison");
    await expect(listRows(other, /135 Madison Ave/)).toContainText("Crew's been");
    await page.goto("/?view=list&q=135%20madison");
    await expect(listRows(page, /135 Madison Ave/)).toContainText("You've been");
  });

  test("tapping a map pin opens its preview", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^33 Irving Pl,/ }).click();
    const sheet = page.getByRole("dialog", { name: "33 Irving Pl preview" });
    await expect(sheet).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
    await page.getByRole("button", { name: /^33 Irving Pl,/ }).click();
    await sheet.getByRole("link", { name: "View station" }).click();
    await expect(page).toHaveURL(/\/stations\/33-irving-pl$/);
  });

  test("ranks sort by a category, then narrow to a neighborhood", async ({ page }) => {
    await review(page.request, "524-broadway", { scores: { coffee: 5 } });
    await page.goto("/ranks");
    await page.getByLabel("Rank by").selectOption("coffee");
    await expect(page).toHaveURL(/by=coffee/);
    await expect(page.getByRole("heading", { name: "Best coffee" })).toBeVisible();
    // The ranked list's own section (the page has other sections that can name buildings).
    const ranked = page.getByRole("region", { name: /^Best coffee/ });
    await expect(ranked.getByRole("link", { name: /524 Broadway/ })).toBeVisible();

    await chip(page, "Downtown").click();
    await expect(page).toHaveURL(/by=coffee/);
    await expect(page).toHaveURL(/area=downtown/);
    await expect(page.getByRole("heading", { name: "Best coffee · Downtown" })).toBeVisible();
    await chip(page, "Brooklyn").click();
    await expect(page.getByRole("heading", { name: "Best coffee · Brooklyn" })).toBeVisible();
    await expect(ranked.getByRole("link", { name: /524 Broadway/ })).toHaveCount(0);
  });

  test("the passport is personal", async ({ page, browser }, info) => {
    await checkIn(page.request, "379-w-broadway");
    await page.goto("/passport");
    const mine = page.getByRole("region", { name: "Your stamps" });
    await expect(mine.getByRole("link", { name: /^379 W Broadway, first visit/ })).toBeVisible();

    // Someone else's passport doesn't get my stamp, but shows the crew has been.
    const other = await (await browser.newContext({ ...info.project.use })).newPage();
    await joinAs(other);
    await other.goto("/passport");
    await expect(
      other
        .getByRole("region", { name: "Your stamps" })
        .getByRole("link", { name: /379 W Broadway/ }),
    ).toHaveCount(0);
    await expect(
      other.getByRole("link", { name: "379 W Broadway, not visited, the crew has been" }),
    ).toBeVisible();
  });

  test("no screen scrolls sideways, even with very long names and words", async ({
    browser,
  }, info) => {
    const page = await (await browser.newContext({ ...info.project.use })).newPage();
    await joinAs(page, `W${Math.random().toString(36).slice(2, 8)}${"W".repeat(23)}`); // 30 chars
    const word = "Supercalifragilisticexpialidociouscoldbrew".repeat(7);
    await review(page.request, "18-w-18th-st", {
      scores: { coffee: 3 },
      hotTake: word.slice(0, 120),
      body: word,
    });
    await checkIn(page.request, "18-w-18th-st", word);
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
    // A stamp in every area: each area's seal color has its own contrast.
    for (const id of ["8-w-126th-st", "1460-broadway", "154-w-14th-st", "85-broad-st", "dock-72"]) {
      await checkIn(page.request, id);
    }
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

  test("first load stays within the size budget (docs/PLAN.md §6)", async ({
    page,
    browser,
  }, info) => {
    // JS + CSS the browser downloads for a page, by URL, gzipped.
    const downloads = async (p: Page, path: string) => {
      const urls = new Set<string>();
      p.on("response", (r) => {
        const type = r.request().resourceType();
        if (type === "script" || type === "stylesheet") urls.add(r.url());
      });
      await p.goto(path, { waitUntil: "networkidle" });
      const sizes = new Map<string, number>();
      for (const url of urls)
        sizes.set(url, gzipSync(await (await p.request.get(url)).body()).length);
      return sizes;
    };
    const app = await downloads(page, "/");
    // The signed-out page is the framework (React, Next.js) plus the root layout, almost no app
    // code. What Explore downloads beyond that is ours.
    const signedOut = await downloads(
      await (await browser.newContext({ ...info.project.use })).newPage(),
      "/",
    );
    const sum = (xs: Iterable<number>) => [...xs].reduce((a, b) => a + b, 0);
    const total = sum(app.values());
    const ours = sum([...app].filter(([url]) => !signedOut.has(url)).map(([, size]) => size));
    const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
    console.log(`first-load JS + CSS: ${kb(total)} gzipped (our code: ${kb(ours)})`);
    expect(total, "total budget").toBeLessThan(200 * 1024);
    expect(ours, "our own code").toBeLessThan(40 * 1024);
  });
});
