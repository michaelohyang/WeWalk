import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { E2E_CREW_CODE } from "../../playwright.config";
import { checkIn, joinAs, review, uniqueName } from "./helpers";

const main = (page: Page) => page.getByRole("main");
const score = (page: Page, category: string, n: number) =>
  page.getByRole("radiogroup", { name: category }).getByRole("radio", { name: `${n} out of 5` });
const myReviews = (page: Page, name: string) =>
  main(page)
    .getByRole("region", { name: "Reviews" })
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
    await expect(other.getByRole("heading", { name: `Sign in as ${name}` })).toBeVisible();
    await other.getByRole("button", { name: `Sign in as ${name}` }).click();
    await expect(other).toHaveURL(/\/$/);
    await other.goto("/crew");
    await expect(main(other).getByText(name).first()).toBeVisible();

    // Used up.
    const third = await (await browser.newContext({ ...info.project.use })).newPage();
    await third.goto(url!);
    await expect(third.getByText(/expired or was already used/)).toBeVisible();
    await expect(third.getByRole("button", { name: /Sign in/ })).toHaveCount(0);
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
    await expect(myReviews(page, "")).toBeInViewport(); // you see your review without scrolling
    await expect(page.getByRole("link", { name: "Edit your rating" })).toBeVisible();
  });

  test("the + button never drops you into editing an old review", async ({ page }) => {
    await review(page.request, "dumbo-heights", { scores: { coffee: 4 } });
    await page.goto("/");
    await page.getByRole("link", { name: "Rate a station" }).click();
    await expect(page.getByRole("heading", { name: "Rate a building" })).toBeVisible();

    // Checked in somewhere today and haven't reviewed it: that's the one.
    await checkIn(page.request, "750-lexington-ave");
    await page.goto("/");
    await page.getByRole("link", { name: "Rate a station" }).click();
    await expect(page).toHaveURL(/\/rate\/750-lexington-ave$/);
    await expect(page.getByRole("heading", { name: "Rate 750 Lexington Ave" })).toBeVisible();
  });

  test("scores tapped before picking the building are kept", async ({ page }) => {
    await page.goto("/rate");
    await score(page, "Coffee", 2).click();
    await page.getByLabel("Building").selectOption("1460-broadway");
    await expect(page).toHaveURL(/\/rate\/1460-broadway$/);
    await expect(score(page, "Coffee", 2)).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText("Picked up where you left off.")).toHaveCount(0);
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
    await expect(page.getByText("It posts itself the second you get a bar.")).toBeVisible();
    await expect(
      page.getByRole("status").filter({ hasText: "will post when you're back online" }),
    ).toBeVisible();

    await context.setOffline(false);
    await expect(page.getByText("Back online. Your updates are posted.")).toBeVisible({
      timeout: 10_000,
    });
    // Once it's out, you land on the station like a normal post.
    await expect(page).toHaveURL(/\/s\/199-water-st\?posted=review$/);
    await expect(main(page).getByText(take)).toHaveCount(2); // hot-take card + the review itself
    await expect(myReviews(page, "")).toHaveCount(1);
  });

  test("a shared phone: queued posts and drafts stay with whoever wrote them", async ({
    page,
    context,
  }) => {
    const take = uniqueName("Alice's unsent take");
    await page.goto("/rate/115-broadway");
    await score(page, "Coffee", 1).click();
    await page.getByRole("button", { name: /Add more/ }).click();
    await page.getByLabel("Hot take").fill(take);
    await context.setOffline(true);
    await page.getByRole("button", { name: "Post review" }).click();
    await expect(page.getByText("It posts itself the second you get a bar.")).toBeVisible();

    // Alice signs out; Bob joins on the same phone, back online.
    await context.clearCookies();
    await context.setOffline(false);
    const bob = await joinAs(page, uniqueName("Bob"));
    await page.goto("/rate/115-broadway");
    await expect(page.getByRole("heading", { name: "Rate 115 Broadway" })).toBeVisible();
    await expect(page.getByText("Picked up where you left off.")).toHaveCount(0);
    await page.getByRole("button", { name: /Add more/ }).click();
    await expect(page.getByLabel("Hot take")).toHaveValue("");

    await page.goto("/s/115-broadway");
    await expect(page.getByRole("status").filter({ hasText: "will post" })).toHaveCount(0);
    await page.waitForTimeout(1500); // give any (wrong) flush a chance to happen
    await page.reload();
    await expect(main(page).getByText(take)).toHaveCount(0);
    await expect(myReviews(page, bob)).toHaveCount(0);
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
    await page.getByRole("button", { name: "✓ Here · add note" }).click();
    const note = uniqueName("Window seat secured by 8:45."); // the station is shared by all runs
    await page.getByLabel("Today's note").fill(note);
    await page.getByRole("button", { name: "Save note" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Note added." })).toBeVisible();
    await expect(main(page).getByText(note)).toBeVisible();

    await page.reload();
    await expect(page.getByRole("button", { name: "Check in" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "✓ Here · edit note" })).toBeVisible();
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
    await page.getByRole("button", { name: "✓ Here · add note" }).click();
    await check("station with note form");
    await page.goto("/crew");
    await page.getByRole("button", { name: "Add a phone" }).click();
    await check("crew");
  });
});
