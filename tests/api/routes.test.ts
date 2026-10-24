import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { FIRST_CREW_ID } from "@/server/db/schema";
import { PUT as handOver } from "@/app/api/admin/owner/route";
import { POST as adminRecovery } from "@/app/api/admin/recovery-links/route";
import { PUT as editStation } from "@/app/api/admin/stations/[slug]/route";
import { POST as addStation } from "@/app/api/admin/stations/route";
import { PUT as putCheckin } from "@/app/api/checkins/[id]/route";
import { POST as joinCrewRoute } from "@/app/api/crews/join/route";
import { POST as createCrewRoute } from "@/app/api/crews/route";
import { POST as login } from "@/app/api/login/route";
import { DELETE as signOutDevice } from "@/app/api/me/devices/[id]/route";
import { PUT as setPassword } from "@/app/api/me/password/route";
import { GET as exportMe } from "@/app/api/me/export/route";
import { DELETE as deleteMe, GET as me, PATCH as renameMe } from "@/app/api/me/route";
import { GET as getPhoto } from "@/app/api/photos/[id]/route";
import { POST as uploadPhoto } from "@/app/api/photos/route";
import { POST as recover } from "@/app/api/recover/route";
import { DELETE as unreact, PUT as react } from "@/app/api/reviews/[id]/reactions/[kind]/route";
import { DELETE as deleteReview, PUT as putReview } from "@/app/api/reviews/[id]/route";
import { POST as signup } from "@/app/api/signup/route";
import { setDb, type Db } from "@/server/db/client";
import { createTestDb, resetTestDb } from "@/server/db/testing";
import { cityDate } from "@/domain/dates";
import type { Session } from "@/server/services/auth";
import { loadCrew, loadMyVisits } from "@/server/services/crew";
import {
  exploreView,
  mapView,
  passportView,
  ranksView,
  stationView,
} from "@/server/services/views";
import { inCity } from "@/server/services/views/city";
import { STATIONS } from "@/domain/stations";
import { insertReview } from "@/server/repos/reviews";
import { insertCrew, listMemberCrews } from "@/server/repos/crews";
import { crews as crewsTable } from "@/server/db/schema";
import { reviewInputSchema } from "@/domain/schemas";
import { signUp } from "@/server/services/auth";
import { Phone } from "./client";

const PASSWORD = "correct horse battery";
let db: Db;
let n = 0;
const newId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const today = () => new Date().toISOString().slice(0, 10);
const review = (over: Record<string, unknown> = {}) => ({
  stationSlug: "18-w-18th-st",
  visitedOn: today(),
  scores: { coffee: 4, wifi: 5 },
  ...over,
});

const building = (over: Record<string, unknown> = {}) => ({
  name: "1 Seaport Sq",
  short: "1 Seaport",
  address: "1 Seaport Sq, Boston, MA 02210",
  neighborhood: "Seaport",
  area: "seaport",
  lat: 42.3505,
  lng: -71.0445,
  hidden: false,
  ...over,
});

beforeAll(async () => {
  db = await createTestDb();
  setDb(db);
});
afterAll(() => setDb(undefined));
beforeEach(() => resetTestDb(db));

async function joined(name: string): Promise<Phone> {
  const phone = new Phone();
  const res = await phone.call(signup, "POST", "/api/signup", {
    body: { name, password: PASSWORD },
  });
  expect(res.status).toBe(201);
  return phone;
}

describe("signing up and logging in", () => {
  it("sets an httpOnly, SameSite=Lax session cookie and returns the member", async () => {
    const phone = new Phone();
    const res = await phone.call(signup, "POST", "/api/signup", {
      body: { name: " Dana ", password: PASSWORD },
    });
    expect(res.status).toBe(201);
    expect(res.body.member).toEqual({
      id: expect.any(String),
      name: "Dana",
      isAdmin: true,
      hasPassword: true,
    });
    expect(res.setCookie).toMatch(/^ww_session=[\w-]{43};/);
    expect(res.setCookie).toMatch(/HttpOnly/i);
    expect(res.setCookie).toMatch(/SameSite=lax/i);
    expect((await phone.call(me, "GET", "/api/me")).body.member.name).toBe("Dana");
    // Plus a readable member-id cookie for the client's per-member drafts and outbox.
    expect(phone.cookie).toContain(`ww_member=${res.body.member.id}`);
    const member = res.setCookie!.split(/, (?=ww_)/).find((c) => c.startsWith("ww_member="));
    expect(member).not.toMatch(/HttpOnly/i);
  });

  it("refuses a taken name (409) and a short password (400)", async () => {
    await joined("Dana");
    const phone = new Phone();
    const taken = await phone.call(signup, "POST", "/api/signup", {
      body: { name: "dana", password: PASSWORD },
    });
    expect(taken.status).toBe(409);
    expect(taken.body.error.message).toMatch(/already goes by/);
    const short = await phone.call(signup, "POST", "/api/signup", {
      body: { name: "Sal", password: "short" },
    });
    expect(short.status).toBe(400);
    expect(short.body.error.details.fields.password).toBeDefined();
    expect(phone.cookie).toBe("");
  });

  it("logs in on another device; a wrong password is 401 and sets nothing", async () => {
    await joined("Dana");
    const laptop = new Phone();
    const wrong = await laptop.call(login, "POST", "/api/login", {
      body: { name: "Dana", password: "nope" },
    });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.message).toBe("Wrong username or password.");
    expect(laptop.cookie).toBe("");
    const ok = await laptop.call(login, "POST", "/api/login", {
      body: { name: "dana", password: PASSWORD },
    });
    expect(ok.status).toBe(200);
    expect((await laptop.call(me, "GET", "/api/me")).body.devices).toHaveLength(2);
  });

  it("changes the password with the current one", async () => {
    const phone = await joined("Dana");
    const put = (body: unknown) => phone.call(setPassword, "PUT", "/api/me/password", { body });
    expect((await put({ current: "nope", password: "new password" })).status).toBe(400);
    expect((await put({ current: PASSWORD, password: "new password" })).status).toBe(204);
    const res = await new Phone().call(login, "POST", "/api/login", {
      body: { name: "Dana", password: "new password" },
    });
    expect(res.status).toBe(200);
  });
});

describe("every member route needs a session", () => {
  it.each([
    ["GET /api/me", () => new Phone().call(me, "GET", "/api/me")],
    [
      "PUT review",
      () =>
        new Phone().call(putReview, "PUT", "/api/reviews/x", {
          params: { id: newId() },
          body: review(),
        }),
    ],
    [
      "DELETE review",
      () => new Phone().call(deleteReview, "DELETE", "/api/reviews/x", { params: { id: newId() } }),
    ],
    [
      "PUT checkin",
      () =>
        new Phone().call(putCheckin, "PUT", "/api/checkins/x", {
          params: { id: newId() },
          body: { stationSlug: "dock-72", visitedOn: today() },
        }),
    ],
    [
      "PUT password",
      () =>
        new Phone().call(setPassword, "PUT", "/api/me/password", {
          body: { password: "new password" },
        }),
    ],
    [
      "POST station",
      () => new Phone().call(addStation, "POST", "/api/admin/stations", { body: building() }),
    ],
    [
      "PUT station",
      () =>
        new Phone().call(editStation, "PUT", "/api/admin/stations/x", {
          params: { slug: "250-broadway" },
          body: building(),
        }),
    ],
    [
      "POST recovery",
      () =>
        new Phone().call(adminRecovery, "POST", "/api/admin/recovery-links", {
          body: { memberId: newId() },
        }),
    ],
    ["GET export", () => new Phone().call(exportMe, "GET", "/api/me/export")],
    [
      "DELETE /api/me",
      () => new Phone().call(deleteMe, "DELETE", "/api/me", { body: { password: PASSWORD } }),
    ],
    [
      "PUT owner",
      () => new Phone().call(handOver, "PUT", "/api/admin/owner", { body: { memberId: newId() } }),
    ],
  ])("%s → 401", async (_, call) => expect((await call()).status).toBe(401));

  it("treats a forged cookie as signed out", async () => {
    const phone = new Phone();
    phone.cookie = "ww_session=forged-token-value-forged-token-value-forged";
    expect((await phone.call(me, "GET", "/api/me")).status).toBe(401);
  });
});

describe("request hygiene", () => {
  it("rejects cross-site writes", async () => {
    const phone = await joined("Dana");
    const res = await phone.call(putReview, "PUT", "/api/reviews/x", {
      params: { id: newId() },
      body: review(),
      headers: { origin: "https://evil.example" },
    });
    expect(res.status).toBe(403);
  });

  it("accepts the public host a proxy forwards (Vercel), and nothing else", async () => {
    const phone = await joined("Dana");
    const write = (headers: Record<string, string>) =>
      phone.call(putReview, "PUT", "/api/reviews/x", {
        params: { id: newId() },
        body: review(),
        headers,
      });
    const proxied = { "x-forwarded-host": "wewalk.example", "x-forwarded-proto": "https" };
    expect((await write({ ...proxied, origin: "https://wewalk.example" })).status).toBe(201);
    expect((await write({ ...proxied, origin: "https://evil.example" })).status).toBe(403);
  });

  it("requires JSON and valid JSON", async () => {
    const phone = await joined("Dana");
    const params = { id: newId() };
    const form = await phone.call(putReview, "PUT", "/api/reviews/x", {
      params,
      raw: "stationSlug=x",
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });
    expect(form.status).toBe(400);
    const broken = await phone.call(putReview, "PUT", "/api/reviews/x", {
      params,
      raw: "{not json",
      headers: { "content-type": "application/json" },
    });
    expect(broken.status).toBe(400);
  });

  it("rejects a malformed id", async () => {
    const phone = await joined("Dana");
    const res = await phone.call(putReview, "PUT", "/api/reviews/x", {
      params: { id: "1; drop table" },
      body: review(),
    });
    expect(res.status).toBe(400);
  });
});

describe("request limits and odd input", () => {
  it("rejects a write with no Origin header", async () => {
    const phone = await joined("Dana");
    const res = await phone.call(putReview, "PUT", "/api/reviews/x", {
      params: { id: newId() },
      body: review(),
      headers: { origin: "" },
    });
    expect(res.status).toBe(403);
  });

  it("rejects bodies over 64 KB with 413", async () => {
    const phone = await joined("Dana");
    const res = await phone.call(putReview, "PUT", "/api/reviews/x", {
      params: { id: newId() },
      body: review({ body: "x".repeat(70_000) }),
    });
    expect(res.status).toBe(413);
  });

  it("saves text containing a NUL byte with the control character removed", async () => {
    const phone = await joined("Dana");
    const res = await phone.call(putReview, "PUT", "/api/reviews/x", {
      params: { id: newId() },
      body: review({ hotTake: "a\u0000b" }),
    });
    expect(res.status).toBe(201);
    expect(res.body.review.hotTake).toBe("ab");
  });
});

describe("reviews", () => {
  it("holds a queued write made by someone else on this phone (401), never posts it as you", async () => {
    const phone = await joined("Dana");
    const res = await phone.call(putReview, "PUT", "/api/reviews/x", {
      params: { id: newId() },
      body: review(),
      headers: { "x-wewalk-member": "00000000-0000-4000-8000-000000000000" },
    });
    expect(res.status).toBe(401);
  });

  it("creates (201), edits (200), conflicts on a second review (409 + existingId), deletes (204)", async () => {
    const phone = await joined("Dana");
    const id = newId();
    const created = await phone.call(putReview, "PUT", "/api/reviews/x", {
      params: { id },
      body: review(),
    });
    expect(created.status).toBe(201);
    expect(created.body.review).toMatchObject({ id, scores: { coffee: 4, wifi: 5 } });

    const edited = await phone.call(putReview, "PUT", "/api/reviews/x", {
      params: { id },
      body: review({ hotTake: "solid" }),
    });
    expect(edited.status).toBe(200);
    expect(edited.body.review.hotTake).toBe("solid");

    const dupe = await phone.call(putReview, "PUT", "/api/reviews/x", {
      params: { id: newId() },
      body: review(),
    });
    expect(dupe.status).toBe(409);
    expect(dupe.body.error.details.existingId).toBe(id);

    expect(
      (await phone.call(deleteReview, "DELETE", "/api/reviews/x", { params: { id } })).status,
    ).toBe(204);
    expect(
      (await phone.call(deleteReview, "DELETE", "/api/reviews/x", { params: { id } })).status,
    ).toBe(204);
  });

  it("forbids editing or deleting someone else's review (403)", async () => {
    const dana = await joined("Dana");
    const sal = await joined("Sal");
    const id = newId();
    await dana.call(putReview, "PUT", "/api/reviews/x", { params: { id }, body: review() });
    expect(
      (await sal.call(putReview, "PUT", "/api/reviews/x", { params: { id }, body: review() }))
        .status,
    ).toBe(403);
    expect(
      (await sal.call(deleteReview, "DELETE", "/api/reviews/x", { params: { id } })).status,
    ).toBe(403);
  });

  it("rejects bad scores and unknown stations", async () => {
    const phone = await joined("Dana");
    const bad = await phone.call(putReview, "PUT", "/api/reviews/x", {
      params: { id: newId() },
      body: review({ scores: {} }),
    });
    expect(bad.status).toBe(400);
    const nowhere = await phone.call(putReview, "PUT", "/api/reviews/x", {
      params: { id: newId() },
      body: review({ stationSlug: "nowhere" }),
    });
    expect(nowhere.status).toBe(404);
  });
});

describe("check-ins", () => {
  it("201 first, 200 on retry with the same id, 409 on a second id the same day", async () => {
    const phone = await joined("Dana");
    const body = { stationSlug: "dock-72", visitedOn: today() };
    const id = newId();
    expect(
      (await phone.call(putCheckin, "PUT", "/api/checkins/x", { params: { id }, body })).status,
    ).toBe(201);
    expect(
      (await phone.call(putCheckin, "PUT", "/api/checkins/x", { params: { id }, body })).status,
    ).toBe(200);
    expect(
      (await phone.call(putCheckin, "PUT", "/api/checkins/x", { params: { id: newId() }, body }))
        .status,
    ).toBe(409);
  });
});

describe("abuse limits", () => {
  it("allows 5 sign-ups an hour from one IP address, then 429 with Retry-After", async () => {
    const ip = "203.0.113.7";
    const signUpAs = (name: string, phone = new Phone(ip)) =>
      phone.call(signup, "POST", "/api/signup", { body: { name, password: PASSWORD } });
    for (const name of ["Ann", "Ben", "Cat", "Dan", "Eve"]) {
      expect((await signUpAs(name)).status).toBe(201);
    }
    const res = await signUpAs("Fay");
    expect(res.status).toBe(429);
    expect(res.body.error).toEqual({
      code: "rate_limited",
      message: "Too many tries. Wait a few minutes and try again.",
      details: { retryAfter: expect.any(Number) },
    });
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    // Someone else, behind another address, isn't affected.
    expect((await signUpAs("Fay", new Phone())).status).toBe(201);
  });

  it("takes the address from x-forwarded-for when x-real-ip is missing", async () => {
    const proxied = (name: string) =>
      new Phone("").call(signup, "POST", "/api/signup", {
        body: { name, password: PASSWORD },
        headers: { "x-forwarded-for": "198.51.100.2, 10.0.0.1" },
      });
    for (const name of ["Ann", "Ben", "Cat", "Dan", "Eve"]) {
      expect((await proxied(name)).status).toBe(201);
    }
    expect((await proxied("Fay")).status).toBe(429);
  });

  it("allows 30 reviews and check-ins (new or edited) per member an hour", async () => {
    const dana = await joined("Dana");
    const body = { stationSlug: "dock-72", visitedOn: today() };
    const id = newId();
    for (let i = 0; i < 30; i++) {
      const res = await dana.call(putCheckin, "PUT", "/api/checkins/x", { params: { id }, body });
      expect(res.status).toBeLessThan(300);
    }
    const checkin = await dana.call(putCheckin, "PUT", "/api/checkins/x", { params: { id }, body });
    expect(checkin.status).toBe(429);
    expect(checkin.body.error.message).toMatch(/posting a lot/);
    const posted = await dana.call(putReview, "PUT", "/api/reviews/x", {
      params: { id: newId() },
      body: review(),
    });
    expect(posted.status).toBe(429);
    // Limits are per member: Sam can still post.
    const sam = await joined("Sam");
    expect(
      (
        await sam.call(putReview, "PUT", "/api/reviews/x", {
          params: { id: newId() },
          body: review(),
        })
      ).status,
    ).toBe(201);
  });
});

describe("devices and accounts", () => {
  it("lists the devices you're logged in on, and signs one out", async () => {
    const first = await joined("Dana");
    const second = new Phone();
    await second.call(login, "POST", "/api/login", { body: { name: "Dana", password: PASSWORD } });

    const { devices } = (await first.call(me, "GET", "/api/me")).body;
    expect(devices).toHaveLength(2);
    const other = devices.find((d: { current: boolean }) => !d.current);
    expect(
      (await first.call(signOutDevice, "DELETE", "/api/me/devices/x", { params: { id: other.id } }))
        .status,
    ).toBe(204);
    expect((await second.call(me, "GET", "/api/me")).status).toBe(401);
  });

  it("signing out this phone clears its cookie", async () => {
    const phone = await joined("Dana");
    const { devices } = (await phone.call(me, "GET", "/api/me")).body;
    const res = await phone.call(signOutDevice, "DELETE", "/api/me/devices/x", {
      params: { id: devices[0].id },
    });
    expect(res.status).toBe(204);
    expect(res.setCookie).toMatch(/ww_session=;/);
  });

  it("renames, refusing a taken name", async () => {
    const dana = await joined("Dana");
    await joined("Sal");
    expect(
      (await dana.call(renameMe, "PATCH", "/api/me", { body: { name: "Dana K" } })).body.member
        .name,
    ).toBe("Dana K");
    expect((await dana.call(renameMe, "PATCH", "/api/me", { body: { name: "SAL" } })).status).toBe(
      409,
    );
  });

  it("recovery links are owner-only (403) and work once", async () => {
    const owner = await joined("Owner");
    const dana = await joined("Dana");
    const danaId = (await dana.call(me, "GET", "/api/me")).body.member.id;
    expect(
      (
        await dana.call(adminRecovery, "POST", "/api/admin/recovery-links", {
          body: { memberId: danaId },
        })
      ).status,
    ).toBe(403);

    const link = await owner.call(adminRecovery, "POST", "/api/admin/recovery-links", {
      body: { memberId: danaId },
    });
    expect(link.status).toBe(201);
    expect(link.body.url).toMatch(/^http:\/\/wewalk\.test\/recover\/[\w-]{43}$/);
    const token = link.body.url.split("/").pop();
    const fresh = new Phone();
    const res = await fresh.call(recover, "POST", "/api/recover", { body: { token } });
    expect(res.body.member).toMatchObject({ name: "Dana", hasPassword: false });
    expect(
      (await new Phone().call(recover, "POST", "/api/recover", { body: { token } })).status,
    ).toBe(410);
  });
});

describe("station admin", () => {
  it("is owner-only (403)", async () => {
    await joined("Owner");
    const dana = await joined("Dana");
    const add = await dana.call(addStation, "POST", "/api/admin/stations", { body: building() });
    expect(add.status).toBe(403);
    const edit = await dana.call(editStation, "PUT", "/api/admin/stations/250-broadway", {
      params: { slug: "250-broadway" },
      body: building({ hidden: true }),
    });
    expect(edit.status).toBe(403);
  });

  it("adds a building (201), then refuses the same name again (409)", async () => {
    const owner = await joined("Owner");
    const res = await owner.call(addStation, "POST", "/api/admin/stations", { body: building() });
    expect(res.status).toBe(201);
    expect(res.body.station).toMatchObject({ slug: "1-seaport-sq", short: "1 Seaport" });
    expect((await loadCrew(db, FIRST_CREW_ID)).stations.map((s) => s.slug)).toContain(
      "1-seaport-sq",
    );

    const again = await owner.call(addStation, "POST", "/api/admin/stations", {
      body: building({ name: "1 Seaport Sq." }),
    });
    expect(again.status).toBe(409);
    expect(again.body.error.details.fields.name[0]).toMatch(/\/stations\/1-seaport-sq/);
  });

  it("validates fields (400)", async () => {
    const owner = await joined("Owner");
    const res = await owner.call(addStation, "POST", "/api/admin/stations", {
      body: building({ lat: 120, area: "mars" }),
    });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.details.fields).sort()).toEqual(["area", "lat"]);
  });

  it("edits and hides a building; its slug stays (200, 404 for unknown)", async () => {
    const owner = await joined("Owner");
    const res = await owner.call(editStation, "PUT", "/api/admin/stations/250-broadway", {
      params: { slug: "250-broadway" },
      body: building({ name: "250 Broadway", area: "downtown", hidden: true }),
    });
    expect(res.status).toBe(200);
    expect(res.body.station).toMatchObject({ slug: "250-broadway", hidden: true });
    expect((await loadCrew(db, FIRST_CREW_ID)).stations.map((s) => s.slug)).not.toContain(
      "250-broadway",
    );

    const slugChange = await owner.call(editStation, "PUT", "/api/admin/stations/250-broadway", {
      params: { slug: "250-broadway" },
      body: building({ slug: "elsewhere" }),
    });
    expect(slugChange.status).toBe(400);

    const missing = await owner.call(editStation, "PUT", "/api/admin/stations/nowhere", {
      params: { slug: "nowhere" },
      body: building(),
    });
    expect(missing.status).toBe(404);
  });
});

describe("your data: export and deletion", () => {
  const idOf = async (phone: Phone) => (await phone.call(me, "GET", "/api/me")).body.member.id;
  const deleteAs = (phone: Phone, password: string) =>
    phone.call(deleteMe, "DELETE", "/api/me", { body: { password } });

  it("downloads your data as a dated JSON file", async () => {
    const dana = await joined("Dana K.");
    await dana.call(putReview, "PUT", "/api/reviews/x", {
      params: { id: newId() },
      body: review(),
    });
    const res = await dana.call(exportMe, "GET", "/api/me/export");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toMatch(
      /^attachment; filename="wewalk-dana-k-\d{4}-\d{2}-\d{2}\.json"$/,
    );
    expect(res.headers.get("cache-control")).toMatch(/no-store/);
    const { body } = res;
    expect(body.profile).toMatchObject({ name: "Dana K.", isAdmin: true });
    expect(body.reviews).toHaveLength(1);
    expect(body.reviews[0]).not.toHaveProperty("memberId");
    expect(JSON.stringify(body)).not.toMatch(/hash/i);
  });

  it("deletes your account with your password, signs you out everywhere, and keeps others' data", async () => {
    await joined("Owner");
    const dana = await joined("Dana");
    const sam = await joined("Sam");
    const laptop = new Phone();
    await laptop.call(login, "POST", "/api/login", { body: { name: "Dana", password: PASSWORD } });
    const mine = newId();
    const theirs = newId();
    await dana.call(putReview, "PUT", "/api/reviews/x", { params: { id: mine }, body: review() });
    await sam.call(putReview, "PUT", "/api/reviews/x", { params: { id: theirs }, body: review() });

    const wrong = await deleteAs(dana, "not my password");
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.details.fields.password).toBeDefined();

    const res = await deleteAs(dana, PASSWORD);
    expect(res.status).toBe(204);
    expect(res.setCookie).toMatch(/ww_session=;/);
    expect(dana.cookie).toBe("");
    expect((await dana.call(me, "GET", "/api/me")).status).toBe(401);
    expect((await laptop.call(me, "GET", "/api/me")).status).toBe(401);
    const login401 = await new Phone().call(login, "POST", "/api/login", {
      body: { name: "Dana", password: PASSWORD },
    });
    expect(login401.status).toBe(401);

    const crew = await loadCrew(db, FIRST_CREW_ID);
    expect(crew.members.map((m) => m.name)).toEqual(["Owner", "Sam"]);
    expect(crew.reviews.map((r) => r.id)).toEqual([theirs]);
  });

  it("holds a write queued by the deleted member: it's refused as signed out (401), never posted", async () => {
    const owner = await joined("Owner");
    const sam = await joined("Sam");
    const samId = await idOf(sam);
    expect((await deleteAs(sam, PASSWORD)).status).toBe(204);
    // The same phone, now signed in as someone else, retries Sam's queued review.
    sam.cookie = owner.cookie;
    const retry = await sam.call(putReview, "PUT", "/api/reviews/x", {
      params: { id: newId() },
      body: review(),
      headers: { "x-wewalk-member": samId },
    });
    expect(retry.status).toBe(401);
    expect((await loadCrew(db, FIRST_CREW_ID)).reviews).toEqual([]);
  });

  it("keeps the owner until they hand the crew over (409), then lets them go", async () => {
    const owner = await joined("Owner");
    const dana = await joined("Dana");
    const refused = await deleteAs(owner, PASSWORD);
    expect(refused.status).toBe(409);
    expect(refused.body.error.message).toMatch(/Hand it over/);

    const danaId = await idOf(dana);
    const put = (phone: Phone, memberId: string) =>
      phone.call(handOver, "PUT", "/api/admin/owner", { body: { memberId } });
    expect((await put(dana, danaId)).status).toBe(403);
    expect((await put(owner, danaId)).status).toBe(204);
    expect((await dana.call(me, "GET", "/api/me")).body.crew.role).toBe("owner");
    expect((await owner.call(me, "GET", "/api/me")).body.crew.role).toBe("member");

    expect((await deleteAs(owner, PASSWORD)).status).toBe(204);
    // The last one here, now the owner, may leave too.
    expect((await deleteAs(dana, PASSWORD)).status).toBe(204);
  });
});

describe("failures inside the server", () => {
  it("returns a generic 500 without leaking details", async () => {
    const phone = await joined("Dana");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    setDb(undefined);
    vi.stubEnv("DATABASE_URL", "");
    const res = await phone.call(me, "GET", "/api/me");
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/DATABASE_URL/);
    setDb(db);
    spy.mockRestore();
  });
});

describe("reactions", () => {
  /** Dana posts a review; returns it and both phones. */
  async function posted() {
    const dana = await joined("Dana");
    const sam = await joined("Sam");
    const id = newId();
    const res = await dana.call(putReview, "PUT", "/api/reviews/x", {
      params: { id },
      body: review(),
    });
    expect(res.status).toBe(201);
    return { dana, sam, id };
  }
  const reactAs = (phone: Phone, id: string, kind: string, method: "PUT" | "DELETE" = "PUT") =>
    phone.call(method === "PUT" ? react : unreact, method, "/api/reviews/x/reactions/y", {
      params: { id, kind },
    });
  const viewAs = async (name: string) => {
    const crew = await loadCrew(db, FIRST_CREW_ID);
    const member = crew.members.find((m) => m.name === name)!;
    const session = { member, deviceId: "d" } as unknown as Session;
    const station = await stationView(crew, session, "18-w-18th-st");
    return station!.reviews[0]!.reactions.find((r) => r.key === "fire")!;
  };

  it("adds once however many times it's sent, shows who, and comes off again", async () => {
    const { sam, id } = await posted();
    expect((await reactAs(sam, id, "fire")).status).toBe(204);
    expect((await reactAs(sam, id, "fire")).status).toBe(204);
    expect(await viewAs("Dana")).toMatchObject({ count: 1, mine: false, by: ["Sam"] });
    expect(await viewAs("Sam")).toMatchObject({ count: 1, mine: true });

    expect((await reactAs(sam, id, "fire", "DELETE")).status).toBe(204);
    expect((await reactAs(sam, id, "fire", "DELETE")).status).toBe(204);
    expect(await viewAs("Dana")).toMatchObject({ count: 0, by: [] });
  });

  it("refuses your own review, unknown kinds and missing reviews", async () => {
    const { dana, sam, id } = await posted();
    expect((await reactAs(dana, id, "fire")).status).toBe(400);
    expect((await reactAs(sam, id, "thumbsdown")).status).toBe(400);
    expect((await reactAs(sam, newId(), "fire")).status).toBe(404);
    expect((await reactAs(new Phone(), id, "fire")).status).toBe(401);
  });

  it("go away with the review", async () => {
    const { dana, sam, id } = await posted();
    await reactAs(sam, id, "hundred");
    await dana.call(deleteReview, "DELETE", "/api/reviews/x", { params: { id } });
    expect((await loadCrew(db, FIRST_CREW_ID)).reactions).toEqual([]);
  });
});

describe("here today", () => {
  // Order (latest first) is covered by domain/today.test.ts; here two check-ins can share a ms.
  it("shows today's check-ins (New York's date) on Explore", async () => {
    const now = new Date();
    const dana = await joined("Dana");
    const sam = await joined("Sam");
    const visitedOn = cityDate(now);
    for (const [phone, stationSlug] of [
      [dana, "dock-72"],
      [sam, "18-w-18th-st"],
    ] as const) {
      const res = await phone.call(putCheckin, "PUT", "/api/checkins/x", {
        params: { id: newId() },
        body: { stationSlug, visitedOn },
      });
      expect(res.status).toBe(201);
    }
    const crew = await loadCrew(db, FIRST_CREW_ID);
    const me = crew.members.find((m) => m.name === "Dana")!;
    const view = await exploreView(crew, { member: me, deviceId: "d" } as unknown as Session, now);
    const here = view.hereToday.map((h) => [h.name, h.stationSlug, h.mine]);
    expect(here).toHaveLength(2);
    expect(here).toEqual(
      expect.arrayContaining([
        ["Sam", "18-w-18th-st", false],
        ["Dana", "dock-72", true],
      ]),
    );
  });
});

describe("photos", () => {
  /** A tiny but real-looking JPEG: the FF D8 FF signature, then filler. */
  const jpeg = (size = 2048) => {
    const b = new Uint8Array(size);
    b.set([0xff, 0xd8, 0xff, 0xe0]);
    return b;
  };
  const upload = (phone: Phone, bytes: Uint8Array<ArrayBuffer>, type = "image/jpeg") =>
    phone.call(uploadPhoto, "POST", "/api/photos", {
      raw: bytes,
      headers: { "content-type": type },
    });
  const photoId = (url: string) => url.split("/").pop()!;
  const fetchPhoto = (phone: Phone, url: string) =>
    phone.call(getPhoto, "GET", url, { params: { id: photoId(url) } });

  it("uploads a JPEG and serves it back", async () => {
    const dana = await joined("Dana");
    const res = await upload(dana, jpeg());
    expect(res.status).toBe(201);
    expect(res.body.url).toMatch(/^\/api\/photos\/[0-9a-f-]{36}$/);
    const got = await fetchPhoto(dana, res.body.url);
    expect(got.status).toBe(200);
    expect(got.body).toEqual(jpeg());
  });

  it("puts the photo's size in its address, so pages can reserve its space", async () => {
    const dana = await joined("Dana");
    const sized = new Uint8Array(2048);
    // SOI, then a baseline frame header: 1600 tall, 736 wide.
    sized.set([
      0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x06, 0x40, 0x02, 0xe0, 0x01, 0x01, 0x11, 0x00,
    ]);
    const res = await upload(dana, sized);
    expect(res.status).toBe(201);
    expect(res.body.url).toMatch(/^\/api\/photos\/[0-9a-f-]{36}-736x1600$/);
    expect((await fetchPhoto(dana, res.body.url)).status).toBe(200);
  });

  it("refuses what isn't a JPEG, what's too big, and strangers", async () => {
    const dana = await joined("Dana");
    expect((await upload(dana, jpeg(), "image/png")).status).toBe(400);
    expect((await upload(dana, new TextEncoder().encode("not an image"))).status).toBe(400);
    expect((await upload(dana, jpeg(2 * 1024 * 1024 + 1))).status).toBe(413);
    expect((await upload(new Phone(), jpeg())).status).toBe(401);
  });

  it("allows 10 uploads per member in 10 minutes and 30 a day", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-05T12:00:00Z") });
    try {
      const dana = await joined("Dana");
      const uploadMany = async (count: number) => {
        for (let i = 0; i < count; i++) expect((await upload(dana, jpeg())).status).toBe(201);
      };
      await uploadMany(10);
      const burst = await upload(dana, jpeg());
      expect(burst.status).toBe(429);
      expect(burst.body.error.message).toMatch(/a lot of photos at once/);
      expect(burst.headers.get("retry-after")).toBe(String(10 * 60));
      expect((await upload(await joined("Sam"), jpeg())).status).toBe(201);

      vi.setSystemTime(new Date("2026-10-05T12:10:00Z"));
      await uploadMany(10);
      vi.setSystemTime(new Date("2026-10-05T12:20:00Z"));
      await uploadMany(10); // 30 today; the refused one above doesn't count
      vi.setSystemTime(new Date("2026-10-05T12:30:00Z"));
      const quota = await upload(dana, jpeg());
      expect(quota.status).toBe(429);
      expect(quota.body.error.message).toMatch(/all the photos for today/);
    } finally {
      vi.useRealTimers();
    }
  });

  it("goes on a review, and only if it was uploaded here", async () => {
    const dana = await joined("Dana");
    const { url } = (await upload(dana, jpeg())).body;
    const id = newId();
    const put = (photoUrl: string | null) =>
      dana.call(putReview, "PUT", "/api/reviews/x", {
        params: { id },
        body: review({ photoUrl }),
      });
    expect((await put("https://example.com/cat.jpg")).status).toBe(400);
    const res = await put(url);
    expect(res.status).toBe(201);
    expect(res.body.review.photoUrl).toBe(url);
  });

  it("is deleted when it's replaced, and when its review is", async () => {
    const dana = await joined("Dana");
    const first = (await upload(dana, jpeg())).body.url;
    const second = (await upload(dana, jpeg())).body.url;
    const id = newId();
    const put = (photoUrl: string | null) =>
      dana.call(putReview, "PUT", "/api/reviews/x", { params: { id }, body: review({ photoUrl }) });
    await put(first);
    await put(second);
    expect((await fetchPhoto(dana, first)).status).toBe(404);
    expect((await fetchPhoto(dana, second)).status).toBe(200);
    await dana.call(deleteReview, "DELETE", "/api/reviews/x", { params: { id } });
    expect((await fetchPhoto(dana, second)).status).toBe(404);
  });
});

describe("home: areas and the crew feed", () => {
  it("summarizes each area and lists the latest reviews and check-ins", async () => {
    const dana = await joined("Dana");
    const sam = await joined("Sam");
    const visitedOn = cityDate(new Date());
    const reviewId = newId();
    await dana.call(putReview, "PUT", "/api/reviews/x", {
      params: { id: reviewId },
      body: review({ stationSlug: "dock-72", scores: { coffee: 5, wifi: 4 }, hotTake: "Great" }),
    });
    await sam.call(putCheckin, "PUT", "/api/checkins/x", {
      params: { id: newId() },
      body: { stationSlug: "195-montague-st", visitedOn },
    });
    await sam.call(react, "PUT", "/api/reviews/x/reactions/y", {
      params: { id: reviewId, kind: "fire" },
    });

    const crew = await loadCrew(db, FIRST_CREW_ID);
    const me = crew.members.find((m) => m.name === "Dana")!;
    const view = await exploreView(
      crew,
      { member: me, deviceId: "d" } as unknown as Session,
      new Date(),
    );

    const brooklyn = view.areas.find((a) => a.key === "brooklyn")!;
    expect(brooklyn).toMatchObject({
      label: "Brooklyn",
      mine: 1,
      best: { slug: "dock-72", overall: 4.5 },
    });
    expect(view.areas.map((a) => a.key)).toEqual([
      "uptown",
      "midtown",
      "flatiron",
      "downtown",
      "brooklyn",
    ]);
    expect(view.areas.reduce((n, a) => n + a.total, 0)).toBe(view.stations.length);

    expect(view.feed).toHaveLength(2);
    const r = view.feed.find((f) => f.kind === "review")!;
    expect(r).toMatchObject({ by: "Dana", mine: true, overall: 4.5, hotTake: "Great" });
    expect(r.kind === "review" && r.reactions.find((x) => x.key === "fire")).toMatchObject({
      count: 1,
      by: ["Sam"],
    });
    expect(view.feed.find((f) => f.kind === "checkin")).toMatchObject({ by: "Sam", mine: false });
  });
});

describe("map: every station at its position", () => {
  it("places each visible station at its seeded coordinates, with the crew's score", async () => {
    const dana = await joined("Dana");
    await dana.call(putReview, "PUT", "/api/reviews/x", {
      params: { id: newId() },
      body: review({ stationSlug: "dock-72", scores: { coffee: 5, wifi: 4 } }),
    });

    const crew = await loadCrew(db, FIRST_CREW_ID);
    const me = crew.members.find((m) => m.name === "Dana")!;
    const view = mapView(crew, { member: me, deviceId: "d" } as unknown as Session);

    const visible = STATIONS.filter((s) => !s.hidden);
    expect(view.stations.map((s) => s.slug).sort()).toEqual(visible.map((s) => s.slug).sort());
    for (const s of view.stations) {
      const seed = visible.find((v) => v.slug === s.slug)!;
      expect([s.lat, s.lng], s.slug).toEqual([seed.lat, seed.lng]);
    }
    expect(view.stations.find((s) => s.slug === "dock-72")).toMatchObject({
      overall: 4.5,
      reviewCount: 1,
      visited: true,
      mine: true,
    });
    expect(view.stations.find((s) => s.slug === "33-irving-pl")).toMatchObject({
      overall: null,
      reviewCount: 0,
      mine: false,
    });
  });
});

describe("ranks: Station of the Month", () => {
  it("follows New York's calendar, not UTC's", async () => {
    await joined("Dana");
    const crew = await loadCrew(db, FIRST_CREW_ID);
    const me = crew.members.find((m) => m.name === "Dana")!;
    // 11:30pm on Oct 31 in New York is already Nov 1 in UTC.
    const halloweenNight = new Date("2026-11-01T03:30:00Z");
    const view = await ranksView(
      crew,
      { member: me, deviceId: "d" } as unknown as Session,
      "overall",
      null,
      halloweenNight,
    );
    expect(view.month).toBe("2026-10");
  });
});

describe("cities", () => {
  async function crewWithReviews() {
    const dana = await joined("Dana");
    for (const slug of ["dock-72", "501-boylston-st", "coda"]) {
      const res = await dana.call(putReview, "PUT", "/api/reviews/x", {
        params: { id: newId() },
        body: review({ stationSlug: slug, scores: { coffee: 5, wifi: 4 } }),
      });
      expect(res.status, slug).toBe(201);
    }
    const crew = await loadCrew(db, FIRST_CREW_ID);
    const me = crew.members.find((m) => m.name === "Dana")!;
    return { crew, session: { member: me, deviceId: "d" } as unknown as Session };
  }

  it("Home shows the picked city's areas and map, and the whole crew's feed", async () => {
    const { crew, session } = await crewWithReviews();
    const view = await exploreView(crew, session, new Date(), "boston");
    expect(view.city).toBe("boston");
    expect(view.areas.map((a) => a.label)).toEqual([
      "Back Bay",
      "Downtown",
      "Seaport",
      "North Station",
      "Cambridge",
    ]);
    expect(view.pins.map((p) => p.slug)).toContain("501-boylston-st");
    expect(view.pins.map((p) => p.slug)).not.toContain("dock-72");
    expect(view.stations).toHaveLength(7);
    // The feed is crew-wide: reviews from every city.
    const fed = view.feed.map((f) => f.station.slug).sort();
    expect(fed).toEqual(["501-boylston-st", "coda", "dock-72"]);

    const atl = await exploreView(crew, session, new Date(), "atlanta");
    expect(atl.areas.map((a) => a.label)).toEqual(["Midtown", "Buckhead", "Perimeter", "Decatur"]);
    expect(atl.pins).toHaveLength(5);
  });

  it("Ranks and the map only show the picked city", async () => {
    const { crew, session } = await crewWithReviews();
    const ranks = await ranksView(inCity(crew, "boston"), session, "overall", null, new Date());
    expect(ranks.rows.map((r) => r.station.slug)).toEqual(["501-boylston-st"]);
    expect(ranks.stationOfMonth?.station.slug).toBe("501-boylston-st");
    expect(mapView(inCity(crew, "atlanta"), session).stations.map((s) => s.slug)).toContain("coda");
    expect(mapView(inCity(crew, "atlanta"), session).stations).toHaveLength(5);
  });

  it("Passport counts the picked city, with only its area badges", async () => {
    const { crew, session } = await crewWithReviews();
    const mine = await loadMyVisits(db, session.member.id);
    const view = await passportView(crew, session, new Date(), "boston", mine);
    expect(view.total).toBe(7);
    expect(view.stamps.map((s) => s.station.slug)).toEqual(["501-boylston-st"]);
    const areaBadges = view.badges.filter((b) => b.key.startsWith("area-")).map((b) => b.key);
    expect(areaBadges.sort()).toEqual(
      [
        "area-back-bay",
        "area-boston-downtown",
        "area-cambridge",
        "area-north-station",
        "area-seaport",
      ].sort(),
    );
    // Milestones count every city: three buildings so far.
    expect(view.badges.find((b) => b.key === "regular")?.progress.have).toBe(3);
  });
});

describe("crews", () => {
  const CREW = "x-wewalk-crew";
  /** Dana (first crew's owner and app admin) and Sam in the first crew; Ben starts "Brooklyn"
   * and Dana joins it too. */
  async function twoCrews() {
    const dana = await joined("Dana");
    const sam = await joined("Sam");
    const ben = await joined("Ben");
    vi.stubEnv("CREWS_ENABLED", "1");
    const created = await ben.call(createCrewRoute, "POST", "/api/crews", {
      body: { name: "Brooklyn", homeCity: "nyc" },
    });
    vi.unstubAllEnvs();
    expect(created.status).toBe(201);
    const crewB = created.body.crew as { id: string; inviteCode: string };
    const join = await dana.call(joinCrewRoute, "POST", "/api/crews/join", {
      body: { code: crewB.inviteCode },
    });
    expect(join.status).toBe(200);
    return { dana, sam, ben, crewB };
  }
  const reviewIn = (phone: Phone, crewId: string | null, stationSlug: string, id = newId()) =>
    phone.call(putReview, "PUT", "/api/reviews/x", {
      params: { id },
      headers: crewId ? { [CREW]: crewId } : {},
      body: review({ stationSlug }),
    });

  it("each crew sees only its own members and posts", async () => {
    const { sam, ben, crewB } = await twoCrews();
    expect((await reviewIn(sam, null, "dock-72")).status).toBe(201);
    expect((await reviewIn(ben, null, "33-irving-pl")).status).toBe(201);

    const first = await loadCrew(db, FIRST_CREW_ID);
    const brooklyn = await loadCrew(db, crewB.id);
    expect(first.reviews.map((r) => r.stationSlug)).toEqual(["dock-72"]);
    expect(brooklyn.reviews.map((r) => r.stationSlug)).toEqual(["33-irving-pl"]);
    // Ben started Brooklyn and switched to it; he's in it only (as its owner), with Dana.
    expect(brooklyn.members.map((m) => m.name).sort()).toEqual(["Ben", "Dana"]);
    expect(first.members.map((m) => m.name).sort()).toEqual(["Ben", "Dana", "Sam"]);
  });

  it("a post lands in the crew it was made in, even if the phone has switched since", async () => {
    const { dana, crewB } = await twoCrews();
    // Dana's phone is on Brooklyn now (she just joined it), but this write was queued in the
    // first crew: it says so, and lands there.
    expect((await reviewIn(dana, FIRST_CREW_ID, "dock-72")).status).toBe(201);
    expect((await loadCrew(db, FIRST_CREW_ID)).reviews).toHaveLength(1);
    expect((await loadCrew(db, crewB.id)).reviews).toHaveLength(0);
  });

  it("refuses a write for a crew you're not in (403)", async () => {
    const { sam, crewB } = await twoCrews();
    expect((await reviewIn(sam, crewB.id, "dock-72")).status).toBe(403);
    expect((await loadCrew(db, crewB.id)).reviews).toEqual([]);
  });

  it("shares your one review with another crew when you save it there", async () => {
    const { dana, crewB } = await twoCrews();
    const id = newId();
    await reviewIn(dana, FIRST_CREW_ID, "dock-72", id);
    expect((await reviewIn(dana, crewB.id, "dock-72", id)).status).toBe(200);
    expect((await loadCrew(db, crewB.id)).reviews.map((r) => r.id)).toEqual([id]);
    expect((await loadCrew(db, FIRST_CREW_ID)).reviews.map((r) => r.id)).toEqual([id]);
  });

  it("only lets you react to reviews the crew you're in can see", async () => {
    const { sam, ben, crewB } = await twoCrews();
    const id = newId();
    await reviewIn(sam, FIRST_CREW_ID, "dock-72", id);
    const outsider = await ben.call(react, "PUT", "/api/reviews/x/reactions/y", {
      params: { id, kind: "fire" },
      headers: { [CREW]: crewB.id },
    });
    expect(outsider.status).toBe(404);
  });

  it("shares today's check-in when you check in at the same place from another crew", async () => {
    const { dana, crewB } = await twoCrews();
    const visitedOn = cityDate(new Date());
    const at = (crewId: string) =>
      dana.call(putCheckin, "PUT", "/api/checkins/x", {
        params: { id: newId() },
        headers: { [CREW]: crewId },
        body: { stationSlug: "dock-72", visitedOn },
      });
    expect((await at(FIRST_CREW_ID)).status).toBe(201);
    expect((await at(crewB.id)).status).toBe(200);
    expect((await loadCrew(db, crewB.id)).checkins).toHaveLength(1);
    expect((await at(crewB.id)).status).toBe(409); // already shared here
  });

  it("counts posts written with no crew (older code, mid-deploy) as the first crew's", async () => {
    const { sam, crewB } = await twoCrews();
    const samId = (await sam.call(me, "GET", "/api/me")).body.member.id as string;
    await insertReview(
      db,
      newId(),
      samId,
      reviewInputSchema.parse(review({ stationSlug: "dock-72" })),
    );
    expect((await loadCrew(db, FIRST_CREW_ID)).reviews).toHaveLength(1);
    expect((await loadCrew(db, crewB.id)).reviews).toHaveLength(0);
  });

  it("lets only the app admin make recovery links, not crew owners", async () => {
    const { ben, dana } = await twoCrews();
    const danaId = (await dana.call(me, "GET", "/api/me")).body.member.id as string;
    // Ben owns Brooklyn and Dana is in it, but a recovery link would let him sign in as her.
    const res = await ben.call(adminRecovery, "POST", "/api/admin/recovery-links", {
      body: { memberId: danaId },
    });
    expect(res.status).toBe(403);
  });

  it("keeps an owner of a crew with others in it from deleting their account", async () => {
    const { ben } = await twoCrews();
    const res = await ben.call(deleteMe, "DELETE", "/api/me", { body: { password: PASSWORD } });
    expect(res.status).toBe(409);
  });

  it("refuses an invite code that doesn't exist, and new crews until they're switched on", async () => {
    const dana = await joined("Dana");
    const bad = await dana.call(joinCrewRoute, "POST", "/api/crews/join", {
      body: { code: "nope" },
    });
    expect(bad.status).toBe(404);
    const off = await dana.call(createCrewRoute, "POST", "/api/crews", {
      body: { name: "Later", homeCity: "boston" },
    });
    expect(off.status).toBe(503);
  });

  it("lands old SIGNUP_CODE invite links in the first crew, and crew codes in theirs", async () => {
    const { crewB } = await twoCrews();
    const old = await signUp(db, { name: "Old", password: PASSWORD, code: "sesame" }, "sesame");
    expect(old.crewId).toBe(FIRST_CREW_ID);
    const fresh = await signUp(
      db,
      { name: "New", password: PASSWORD, code: crewB.inviteCode },
      "sesame",
    );
    expect(fresh.crewId).toBe(crewB.id);
  });

  it("keeps reactions per crew: the same one in two crews, taken back in one", async () => {
    const { dana, sam, crewB } = await twoCrews();
    await sam.call(joinCrewRoute, "POST", "/api/crews/join", { body: { code: crewB.inviteCode } });
    const id = newId();
    await reviewIn(dana, FIRST_CREW_ID, "dock-72", id);
    await reviewIn(dana, crewB.id, "dock-72", id); // shared with Brooklyn too
    const reactIn = (crewId: string, handler = react, method = "PUT") =>
      sam.call(handler, method, "/api/reviews/x/reactions/y", {
        params: { id, kind: "fire" },
        headers: { [CREW]: crewId },
      });
    await reactIn(FIRST_CREW_ID);
    await reactIn(crewB.id);
    expect((await loadCrew(db, FIRST_CREW_ID)).reactions).toHaveLength(1);
    expect((await loadCrew(db, crewB.id)).reactions).toHaveLength(1);
    await reactIn(crewB.id, unreact, "DELETE");
    expect((await loadCrew(db, crewB.id)).reactions).toHaveLength(0);
    expect((await loadCrew(db, FIRST_CREW_ID)).reactions).toHaveLength(1);
  });

  it("puts everyone who races into an empty crew in it, with exactly one owner", async () => {
    await joined("Dana");
    const empty = await insertCrew(db, {
      name: "Fresh",
      homeCity: "nyc",
      inviteCode: "fresh-code",
    });
    const people = await Promise.all(
      ["A", "B", "C"].map((name) =>
        signUp(db, { name, password: PASSWORD, code: "fresh-code" }, null),
      ),
    );
    const roles = await Promise.all(
      people.map(async (p) => (await listMemberCrews(db, p.member.id)).map((c) => [c.id, c.role])),
    );
    expect(roles.every((r) => r.length === 1 && r[0]![0] === empty.id)).toBe(true);
    expect(roles.filter((r) => r[0]![1] === "owner")).toHaveLength(1);
  });

  it("refuses a sign-up with an invite code that doesn't work", async () => {
    await joined("Dana");
    const res = await new Phone().call(signup, "POST", "/api/signup", {
      body: { name: "Lost", password: PASSWORD, code: "expired-code" },
    });
    expect(res.status).toBe(403);
  });

  it("deletes a crew along with its last member", async () => {
    const { dana, crewB } = await twoCrews();
    expect(
      (await dana.call(deleteMe, "DELETE", "/api/me", { body: { password: PASSWORD } })).status,
    ).toBe(409); // she owns the first crew, which has others
    const alone = await joined("Alone");
    vi.stubEnv("CREWS_ENABLED", "1");
    const solo = (
      await alone.call(createCrewRoute, "POST", "/api/crews", {
        body: { name: "Solo", homeCity: "boston" },
      })
    ).body.crew as { id: string };
    vi.unstubAllEnvs();
    expect(
      (await alone.call(deleteMe, "DELETE", "/api/me", { body: { password: PASSWORD } })).status,
    ).toBe(204);
    const left = await db.select({ id: crewsTable.id }).from(crewsTable);
    expect(left.map((c) => c.id)).not.toContain(solo.id);
    expect(left.map((c) => c.id)).toContain(crewB.id);
  });
});
