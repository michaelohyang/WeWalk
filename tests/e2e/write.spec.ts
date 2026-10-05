import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { checkIn, joinAs, PASSWORD, review, uniqueName } from "./helpers";

const main = (page: Page) => page.getByRole("main");
const score = (page: Page, category: string, n: number) =>
  page.getByRole("radiogroup", { name: category }).getByRole("radio", { name: `${n} out of 5` });
const myReviews = (page: Page, name: string) =>
  main(page)
    .getByRole("region", { name: "Reviews" })
    .getByRole("listitem")
    .filter({ hasText: `${name} (you)` });

test.describe("accounts", () => {
  test("sign up with a username and password", async ({ page }) => {
    const name = uniqueName("Dana");
    await page.goto("/signup");
    await page.getByLabel("Username").fill(name);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign up" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
    await page.goto("/crew");
    await expect(main(page).getByText(name).first()).toBeVisible();
    // Already in: /signup and /login go straight to the app.
    await page.goto("/login");
    await expect(page).toHaveURL(/\/$/);
  });

  test("a taken username is refused inline; a wrong password says so", async ({
    page,
    browser,
  }, info) => {
    const name = uniqueName("Sal");
    await joinAs(page, name);
    const fresh = await (await browser.newContext({ ...info.project.use })).newPage();
    await fresh.goto("/signup");
    await fresh.getByLabel("Username").fill(name.toUpperCase());
    await fresh.getByLabel("Password").fill(PASSWORD);
    await fresh.getByRole("button", { name: "Sign up" }).click();
    await expect(fresh.getByText(/already goes by that/)).toBeVisible();

    await fresh.goto("/login");
    await fresh.getByLabel("Username").fill(name);
    await fresh.getByLabel("Password").fill("not my password");
    await fresh.getByRole("button", { name: "Log in" }).click();
    await expect(fresh.getByText("Wrong username or password.")).toBeVisible();
  });

  test("a shared link to a station asks you to log in, then opens that station", async ({
    page,
    browser,
  }, info) => {
    const name = await joinAs(page);
    const laptop = await (await browser.newContext({ ...info.project.use })).newPage();
    await laptop.goto("/stations/dock-72");
    await laptop.getByLabel("Username").fill(name);
    await laptop.getByLabel("Password").fill(PASSWORD);
    await laptop.getByRole("button", { name: "Log in" }).click();
    await expect(laptop.getByRole("heading", { level: 1 })).toHaveText("Dock 72");
    await expect(laptop).toHaveURL(/\/stations\/dock-72$/);
  });

  test("change your password", async ({ page, browser }, info) => {
    const name = await joinAs(page);
    await page.goto("/crew");
    await page.getByLabel("Current password").fill(PASSWORD);
    await page.getByLabel("New password").fill("a brand new password");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Password changed." })).toBeVisible();
    const laptop = await (await browser.newContext({ ...info.project.use })).newPage();
    await laptop.goto("/login");
    await laptop.getByLabel("Username").fill(name);
    await laptop.getByLabel("Password").fill("a brand new password");
    await laptop.getByRole("button", { name: "Log in" }).click();
    await expect(laptop).toHaveURL(/\/$/);
    await expect(laptop.getByRole("navigation", { name: "Main" })).toBeVisible();
  });

  test("sign out this phone", async ({ page }) => {
    await joinAs(page);
    await page.goto("/crew");
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.getByRole("button", { name: "Sign out here" }).click();
    await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  });

  test("rename yourself", async ({ page }) => {
    await joinAs(page);
    const name = uniqueName("Dana K");
    await page.goto("/crew");
    await page.getByLabel("Username", { exact: true }).fill(name);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Username updated" })).toBeVisible();
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
    await page.goto("/stations/368-9th-ave");
    await page.getByRole("link", { name: "Rate it" }).click();
    await score(page, "Coffee", 4).click();
    await score(page, "Overall vibe", 5).click();
    await page.getByRole("button", { name: "Post review" }).click();
    await expect(page).toHaveURL(/\/stations\/368-9th-ave/);
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
    await expect(page).toHaveURL(/\/stations\/154-w-14th-st/);

    await page.goto("/rate/154-w-14th-st");
    await expect(page.getByRole("heading", { name: "Edit your rating" })).toBeVisible();
    await expect(score(page, "Wi-Fi", 2)).toHaveAttribute("aria-checked", "true");
    await score(page, "Wi-Fi", 4).click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(/\/stations\/154-w-14th-st/);
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

    let posted = 0;
    page.on("response", (r) => {
      if (r.request().method() === "PUT" && r.url().includes("/api/reviews/") && r.ok()) posted++;
    });
    await context.setOffline(false);
    // Once it's out, you land on the station like a normal post. (Its "Posted." toast can
    // replace "Back online" within milliseconds, so the toast isn't what we wait for; and the
    // page tidies `?posted=review` out of the URL, so don't insist on catching that either.)
    await expect(page).toHaveURL(/\/stations\/199-water-st(\?posted=review)?$/, {
      timeout: 15_000,
    });
    expect(posted).toBe(1);
    // Exactly one review, with the text typed offline. (Not the station's hot-take card: other
    // runs post to this building too, and the card shows just one take.)
    await expect(myReviews(page, "")).toHaveCount(1);
    await expect(myReviews(page, "")).toContainText(take);
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

    await page.goto("/stations/115-broadway");
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
    await expect(page).toHaveURL(/\/stations\/408-broadway/);
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
    await page.goto("/stations/575-lexington-ave");
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
  test("axe (WCAG 2.1 A/AA): signup, login, pair, rate, crew", async ({ page }) => {
    const check = async (label: string) => {
      // Next streams the <title>; mid-refresh it can be briefly missing. And a toast fading in
      // has partial contrast. Scan a settled page.
      await page.waitForLoadState("networkidle"); // e.g. the refresh after checking in
      await expect(page).toHaveTitle(/\S/);
      await page.evaluate(() =>
        Promise.all(
          document
            .getAnimations()
            .filter((a) => a.effect?.getTiming().iterations !== Infinity)
            .map((a) => a.finished.catch(() => {})),
        ),
      );
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(
        violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
        label,
      ).toEqual([]);
    };
    await page.goto("/signup");
    await check("signup");
    await page.goto("/login");
    await check("login");
    await page.goto("/pair/some-token-that-does-not-matter-here");
    await check("pair");
    await joinAs(page);
    await review(page.request, "33-irving-pl", { scores: { coffee: 4 } });
    await page.goto("/rate/33-irving-pl");
    await page.getByRole("button", { name: /Add more/ }).click();
    await check("rate (edit, expanded)");
    await page.goto("/crew");
    await check("crew");
  });
});
