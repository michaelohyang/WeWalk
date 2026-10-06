import type { CheckinRecord, ReviewRecord } from "./records";

let n = 0;
const nextId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

export function review(
  overrides: Partial<ReviewRecord> & Pick<ReviewRecord, "stationSlug">,
): ReviewRecord {
  return {
    id: nextId(),
    memberId: "m1",
    visitedOn: "2026-10-01",
    scores: { vibe: 4 },
    hotTake: "",
    body: "",
    tags: [],
    photoUrl: null,
    updatedAt: "2026-10-01T12:00:00.000Z",
    ...overrides,
  };
}

export function checkin(
  overrides: Partial<CheckinRecord> & Pick<CheckinRecord, "stationSlug">,
): CheckinRecord {
  const visitedOn = overrides.visitedOn ?? "2026-10-01";
  return {
    id: nextId(),
    memberId: "m1",
    visitedOn,
    note: "",
    checkedInAt: `${visitedOn}T13:00:00.000Z`,
    ...overrides,
  };
}
