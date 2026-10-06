import { send, waiting } from "./outbox";

/*
 * Checking in, shared by the station page and "Join" on Explore. A check-in is an idempotent PUT
 * keyed by a client-made id; adding a note later re-PUTs the same id.
 */

export function sendCheckin(
  id: string,
  body: { stationSlug: string; visitedOn: string; note: string },
  label: string,
) {
  return send({ key: `checkin:${id}`, method: "PUT", url: `/api/checkins/${id}`, body, label });
}

/** A check-in at this station on this day still waiting in the outbox (so it counts as done). */
export function queuedCheckin(stationSlug: string, visitedOn: string) {
  for (const job of waiting()) {
    if (!job.key.startsWith("checkin:")) continue;
    // Jobs queued before the rename name the station `stationId`.
    const body = job.body as {
      stationSlug?: string;
      stationId?: string;
      visitedOn?: string;
      note?: string;
    };
    if ((body.stationSlug ?? body.stationId) === stationSlug && body.visitedOn === visitedOn) {
      return { id: job.key.slice("checkin:".length), visitedOn, note: body.note ?? "" };
    }
  }
  return null;
}
