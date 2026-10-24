import { describe, expect, it } from "vitest";
import {
  checkinInputSchema,
  reviewInputSchema,
  signupInputSchema,
  slugFromName,
  stationInputSchema,
} from "./schemas";

const base = { stationSlug: "18-w-18th-st", visitedOn: "2026-10-01", scores: { coffee: 4 } };

describe("reviewInputSchema", () => {
  it("fills defaults and de-duplicates tags", () => {
    const r = reviewInputSchema.parse({ ...base, tags: ["quiet floor", "quiet floor"] });
    expect(r).toEqual({
      ...base,
      hotTake: "",
      body: "",
      tags: ["quiet floor"],
      photoUrl: null,
      alsoCrews: [],
    });
  });

  it.each([
    ["no scores", { ...base, scores: {} }],
    ["score out of range", { ...base, scores: { coffee: 6 } }],
    ["fractional score", { ...base, scores: { coffee: 3.5 } }],
    ["unknown category", { ...base, scores: { beer: 5 } }],
    ["unknown tag", { ...base, tags: ["free beer"] }],
    ["bad date", { ...base, visitedOn: "2026-02-30" }],
    ["bad station slug", { ...base, stationSlug: "../etc" }],
    ["hot take too long", { ...base, hotTake: "x".repeat(121) }],
    ["unknown field", { ...base, memberId: "someone-else" }],
  ])("rejects %s", (_, input) => expect(reviewInputSchema.safeParse(input).success).toBe(false));

  it("trims text", () => {
    expect(reviewInputSchema.parse({ ...base, hotTake: "  spicy  " }).hotTake).toBe("spicy");
  });
});

describe("checkinInputSchema", () => {
  it("defaults the note", () => {
    expect(checkinInputSchema.parse({ stationSlug: "a", visitedOn: "2026-10-01" }).note).toBe("");
  });
});

// Writes queued offline before `stationId` was renamed must still go through after a deploy.
describe("legacy stationId", () => {
  it("is read as stationSlug", () => {
    const { stationSlug, ...rest } = base;
    expect(reviewInputSchema.parse({ ...rest, stationId: stationSlug }).stationSlug).toBe(
      stationSlug,
    );
    expect(
      checkinInputSchema.parse({ stationId: "dock-72", visitedOn: "2026-10-01" }).stationSlug,
    ).toBe("dock-72");
  });

  it("still rejects unknown fields and a bad slug", () => {
    expect(
      checkinInputSchema.safeParse({ stationId: "Dock 72", visitedOn: "2026-10-01" }).success,
    ).toBe(false);
    expect(
      checkinInputSchema.safeParse({
        stationSlug: "dock-72",
        stationId: "dock-72",
        visitedOn: "2026-10-01",
      }).success,
    ).toBe(false);
  });
});

describe("signupInputSchema", () => {
  it("normalizes the name and requires a real password", () => {
    expect(signupInputSchema.parse({ name: "  Dana  K ", password: "long enough" }).name).toBe(
      "Dana K",
    );
    expect(signupInputSchema.safeParse({ name: "   ", password: "long enough" }).success).toBe(
      false,
    );
    expect(signupInputSchema.safeParse({ name: "Dana", password: "short" }).success).toBe(false);
  });
});

describe("free text", () => {
  it("removes control characters (Postgres rejects NUL)", () => {
    const r = reviewInputSchema.parse({ ...base, hotTake: "a\u0000b\u0007c", body: "x\u0000y" });
    expect(r.hotTake).toBe("abc");
    expect(r.body).toBe("xy");
    expect(
      checkinInputSchema.parse({ stationSlug: "a", visitedOn: "2026-10-01", note: "\u0000ok" })
        .note,
    ).toBe("ok");
  });

  it("keeps line breaks in the review body, flattens them in the hot take", () => {
    const r = reviewInputSchema.parse({ ...base, hotTake: "one\ntwo", body: "one\r\ntwo\tthree" });
    expect(r.hotTake).toBe("one two");
    expect(r.body).toBe("one\ntwo\tthree");
  });

  it("speaks human in error messages", () => {
    const issue = (input: unknown) => reviewInputSchema.safeParse(input).error?.issues[0]?.message;
    expect(issue({ ...base, scores: { coffee: 9 } })).toBe("Scores go from 1 to 5.");
    expect(issue({ ...base, tags: ["free beer"] })).toBe("That tag isn't on the list.");
    expect(issue({ ...base, hotTake: "x".repeat(121) })).toBe("Keep it under 120 characters.");
    expect(issue({ ...base, visitedOn: "nope" })).toBe("That date isn't valid.");
  });
});

describe("slugFromName", () => {
  it.each([
    ["450 Lexington Ave", "450-lexington-ave"],
    ["  1 Seaport Sq.  ", "1-seaport-sq"],
    ["Café Építő — 12th & Main!", "cafe-epito-12th-main"],
    ["!!!", ""],
  ])("%s → %s", (name, slug) => {
    expect(slugFromName(name)).toBe(slug);
    // Whatever it makes passes the database's slug check.
    if (slug) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});

describe("stationInputSchema", () => {
  const station = {
    name: "Dock 72",
    address: "68 Cumberland St, Brooklyn, NY 11205",
    neighborhood: "Navy Yard",
    area: "brooklyn",
    lat: 40.6995,
    lng: -73.9745,
    hidden: false,
  };

  it("trims text and treats a blank short name as none", () => {
    expect(stationInputSchema.parse({ ...station, name: " Dock 72 ", short: " " })).toEqual({
      ...station,
      short: null,
    });
  });

  it.each([
    [{ name: "  " }, "name"],
    [{ address: "" }, "address"],
    [{ area: "queens" }, "area"],
    [{ lat: 91 }, "lat"],
    [{ lat: null }, "lat"],
    [{ lng: -181 }, "lng"],
    [{ lng: "-73.9" }, "lng"],
    [{ hidden: undefined }, "hidden"],
  ])("rejects %o", (over, field) => {
    const result = stationInputSchema.safeParse({ ...station, ...over });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual([field]);
  });

  it("doesn't take a slug: it comes from the name and never changes", () => {
    expect(stationInputSchema.safeParse({ ...station, slug: "elsewhere" }).success).toBe(false);
  });
});
