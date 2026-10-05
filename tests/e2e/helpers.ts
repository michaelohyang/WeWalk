import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { BASE_URL } from "../../playwright.config";

// Writes must carry our Origin (the API rejects anything else).
const headers = { origin: BASE_URL };

/*
 * Every test shares one server and one in-memory database, so tests create their own people
 * with unique names and never assume the database is empty.
 */

export const PASSWORD = "correct horse battery";

export const uniqueName = (base: string) => `${base} ${Math.random().toString(36).slice(2, 7)}`;

const today = () => new Date().toISOString().slice(0, 10);

/** Signs up via the API; the page's browser context gets the session cookie. */
export async function joinAs(page: Page, name = uniqueName("Tester")) {
  const res = await page.request.post("/api/signup", {
    data: { name, password: PASSWORD },
    headers,
  });
  expect(res.status(), await res.text()).toBe(201);
  return name;
}

export async function review(
  request: APIRequestContext,
  stationId: string,
  body: {
    scores: Record<string, number>;
    hotTake?: string;
    body?: string;
    tags?: string[];
    visitedOn?: string;
  },
) {
  const res = await request.put(`/api/reviews/${crypto.randomUUID()}`, {
    data: { stationId, visitedOn: today(), ...body },
    headers,
  });
  expect(res.status(), await res.text()).toBe(201);
}

export async function checkIn(request: APIRequestContext, stationId: string, note = "") {
  const res = await request.put(`/api/checkins/${crypto.randomUUID()}`, {
    data: { stationId, visitedOn: today(), note },
    headers,
  });
  expect(res.status(), await res.text()).toBe(201);
}
