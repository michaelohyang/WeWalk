import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as adminRecovery } from "@/app/api/admin/recovery-links/route";
import { PUT as putCheckin } from "@/app/api/checkins/[id]/route";
import { POST as login } from "@/app/api/login/route";
import { DELETE as signOutDevice } from "@/app/api/me/devices/[id]/route";
import { PUT as setPassword } from "@/app/api/me/password/route";
import { GET as me, PATCH as renameMe } from "@/app/api/me/route";
import { POST as recover } from "@/app/api/recover/route";
import { DELETE as deleteReview, PUT as putReview } from "@/app/api/reviews/[id]/route";
import { POST as signup } from "@/app/api/signup/route";
import { setDb, type Db } from "@/server/db/client";
import { createTestDb, resetTestDb } from "@/server/db/testing";
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
      isOwner: true,
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
      "POST recovery",
      () =>
        new Phone().call(adminRecovery, "POST", "/api/admin/recovery-links", {
          body: { memberId: newId() },
        }),
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
