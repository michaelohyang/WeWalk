import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { E2E_CREW_CODE } from "../../playwright.config";
import { joinAs, review, uniqueName } from "./helpers";

const main = (page: Page) => page.getByRole("main");
const score = (page: Page, category: string, n: number) =>
  page.getByRole("radiogroup", { name: category }).getByRole("radio", { name: `${n} out of 5` });
const myReviews = (page: Page, name: string) =>
  main(page)
    .getByRole("listitem")
    .filter({ hasText: `${name} (you)` });

test.describe("joining", () => {
  test("the invite link signs you up with just a name", async ({ page }) => {
    const name = uniqueName("Dana");
    await page.goto(`/j/${E2E_CREW_CODE}`);
    await page.getByLabel("Your name").fill(name);
    await page.getByRole("button", { name: "Join" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
    await page.goto("/crew");
    await expect(main(page).getByText(name).first()).toBeVisible();
    // Already in: the invite link goes straight to the app.
    await page.goto(`/j/${E2E_CREW_CODE}`);
    await expect(page).toHaveURL(/\/$/);
  });

  test("a taken name is refused inline; a bad link explains itself", async ({
    page,
    browser,
  }, info) => {
    const name = uniqueName("Sal");
    await joinAs(page, name);
    const fresh = await (await browser.newContext({ ...info.project.use })).newPage();
    await fresh.goto(`/j/${E2E_CREW_CODE}`);
    await fresh.getByLabel("Your name").fill(name.toUpperCase());
    await fresh.getByRole("button", { name: "Join" }).click();
    await expect(fresh.getByText(/already goes by that/)).toBeVisible();
    await fresh.goto("/j/not-the-code-at-all");
    await expect(fresh.getByText("That invite link doesn't work.")).toBeVisible();
  });
});

test.describe("phones", () => {
  test("pair a second phone with a one-time link", async ({ page, browser }, info) => {
    const name = await joinAs(page);
    await page.goto("/crew");
    await page.getByRole("button", { name: "Add a phone" }).click();
    const url = await main(page)
      .getByText(/\/pair\//)
      .textContent();

    const other = await (await browser.newContext({ ...info.project.use })).newPage();
    await other.goto(url!);
    await other.getByRole("button", { name: "Sign in on this phone" }).click();
    await expect(other).toHaveURL(/\/$/);
    await other.goto("/crew");
    await expect(main(other).getByText(name).first()).toBeVisible();

    // Used up.
    const third = await (await browser.newContext({ ...info.project.use })).newPage();
    await third.goto(url!);
    await third.getByRole("button", { name: "Sign in on this phone" }).click();
    await expect(third.getByText(/expired or was already used/)).toBeVisible();
  });

  test("sign out this phone", async ({ page }) => {
    await joinAs(page);
    await page.goto("/crew");
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.getByRole("button", { name: "Sign out here" }).click();
    await expect(page.getByText("Members only.")).toBeVisible();
  });

  test("rename yourself", async ({ page }) => {
    await joinAs(page);
    const name = uniqueName("Dana K");
    await page.goto("/crew");
    await page.getByLabel("Display name").fill(name);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Name updated" })).toBeVisible();
    await expect(main(page).getByText(name).first()).toBeVisible();
  });
});

test.describe("rating", () => {
  test.beforeEach(async ({ page }) => {
    await joinAs(page);
  });

  test("a scores-only review is a few taps, and lands on the station with a new stamp", async ({
    page,
  }) => {
    const started = Date.now();
    await page.goto("/s/368-9th-ave");
    await page.getByRole("link", { name: "Rate it" }).click();
    await score(page, "Coffee", 4).click();
    await score(page, "Overall vibe", 5).click();
    await page.getByRole("button", { name: "Post review" }).click();
    await expect(page).toHaveURL(/\/s\/368-9th-ave/);
    await expect(page.getByRole("status").filter({ hasText: "New passport stamp" })).toBeVisible();
    expect(Date.now() - started).toBeLessThan(20_000);
    await expect(myReviews(page, "")).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Edit your rating" })).toBeVisible();
  });

  test("Post stays on screen within thumb reach, and taps are at least 44px", async ({ page }) => {
    await page.goto("/rate/368-9th-ave");
    const post = page.getByRole("button", { name: "Post review" });
    const box = (await post.boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    expect(box.y).toBeGreaterThan(viewport.height / 2);
    await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
    for (const target of await page.getByRole("radio").all()) {
      const b = (await target.boundingBox())!;
      expect(Math.min(b.width, b.height)).toBeGreaterThanOrEqual(44);
    }
  });

  test("errors show next to what's wrong, and nothing is sent", async ({ page }) => {
    let sent = 0;
    page.on("request", (r) => r.url().includes("/api/reviews/") && sent++);
    await page.goto("/rate/368-9th-ave");
    await page.getByRole("button", { name: "Post review" }).click();
    await expect(page.getByText("Rate at least one thing.")).toBeVisible();
    expect(sent).toBe(0);
  });

  test("rating a building you already reviewed opens your review to edit", async ({ page }) => {
    await page.goto("/rate/154-w-14th-st");
    await score(page, "Wi-Fi", 2).click();
    await page.getByRole("button", { name: "Post review" }).click();
    await expect(page).toHaveURL(/\/s\/154-w-14th-st/);

    await page.goto("/rate/154-w-14th-st");
    await expect(page.getByRole("heading", { name: "Edit your rating" })).toBeVisible();
    await expect(score(page, "Wi-Fi", 2)).toHaveAttribute("aria-checked", "true");
    await score(page, "Wi-Fi", 4).click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(/\/s\/154-w-14th-st/);
    await expect(myReviews(page, "")).toHaveCount(1);
  });

  test("a reload restores the draft", async ({ page }) => {
    await page.goto("/rate/500-7th-ave");
    await score(page, "Noise level", 1).click();
    await page.getByRole("button", { name: /Add more/ }).click();
    await page.getByLabel("Hot take").fill("Sales floor on speakerphone, all day.");
    await page.reload();
    await expect(score(page, "Noise level", 1)).toHaveAttribute("aria-checked", "true");
    await expect(page.getByLabel("Hot take")).toHaveValue("Sales floor on speakerphone, all day.");
    await expect(page.getByText("Picked up where you left off.")).toBeVisible();
  });

  test("no signal: saved on the phone, posted exactly once when it's back", async ({
    page,
    context,
  }) => {
    const take = uniqueName("Posted from the lobby");
    await page.goto("/rate/199-water-st");
    await score(page, "Coffee", 3).click();
    await page.getByRole("button", { name: /Add more/ }).click();
    await page.getByLabel("Hot take").fill(take);
    await context.setOffline(true);
    await page.getByRole("button", { name: "Post review" }).click();
    await expect(
      page.getByText("Saved on your phone. It'll post when you're back online."),
    ).toBeVisible();
    await expect(
      page.getByRole("status").filter({ hasText: "will post when you're back online" }),
    ).toBeVisible();

    await context.setOffline(false);
    await expect(page.getByText("Back online. Your updates are posted.")).toBeVisible({
      timeout: 10_000,
    });
    await page.goto("/s/199-water-st");
    await expect(main(page).getByText(take)).toHaveCount(2); // hot-take card + the review itself
    await expect(myReviews(page, "")).toHaveCount(1);
  });

  test("delete your own review, after confirming", async ({ page }) => {
    await page.goto("/rate/408-broadway");
    await score(page, "Seating comfort", 3).click();
    await page.getByRole("button", { name: "Post review" }).click();
    await expect(page).toHaveURL(/\/s\/408-broadway/);
    await myReviews(page, "").getByRole("button", { name: "Delete" }).click();
    await page
      .getByRole("group", { name: "Delete this review?" })
      .getByRole("button", { name: "Delete" })
      .click();
    await expect(page.getByRole("status").filter({ hasText: "Review deleted." })).toBeVisible();
    await expect(myReviews(page, "")).toHaveCount(0);
  });
});

test.describe("checking in", () => {
  test("one tap, then an optional note; once per day", async ({ page }) => {
    await joinAs(page);
    await page.goto("/s/575-lexington-ave");
    await page.getByRole("button", { name: "Check in" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "New passport stamp: 575 Lex" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Checked in · add note" }).click();
    await page.getByLabel("Today's note").fill("Window seat secured by 8:45.");
    await page.getByRole("button", { name: "Save note" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Note added." })).toBeVisible();
    await expect(main(page).getByText("Window seat secured by 8:45.")).toBeVisible();

    await page.reload();
    await expect(page.getByRole("button", { name: "Check in" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Edit today's note" })).toBeVisible();
  });
});

test.describe("accessibility of the write screens", () => {
  test("axe (WCAG 2.1 A/AA): join, pair, rate, station actions, crew", async ({ page }) => {
    const check = async (label: string) => {
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(
        violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
        label,
      ).toEqual([]);
    };
    await page.goto(`/j/${E2E_CREW_CODE}`);
    await check("join");
    await page.goto("/pair/some-token-that-does-not-matter-here");
    await check("pair");
    await joinAs(page);
    await review(page.request, "33-irving-pl", { scores: { coffee: 4 } });
    await page.goto("/rate/33-irving-pl");
    await page.getByRole("button", { name: /Add more/ }).click();
    await check("rate (edit, expanded)");
    await page.goto("/s/33-irving-pl");
    await page.getByRole("button", { name: "Check in" }).click();
    await page.getByRole("button", { name: "Checked in · add note" }).click();
    await check("station with note form");
    await page.goto("/crew");
    await page.getByRole("button", { name: "Add a phone" }).click();
    await check("crew");
  });
});
