import "server-only";
import { slugFromName, type StationInput } from "@/domain/schemas";
import type { Db } from "../db/client";
import { AppError, isUniqueViolation } from "../errors";
import * as repo from "../repos/stations";
import { isAdmin, type Session } from "./auth";

/*
 * The owner's building admin (/admin/stations). The database is the source of truth for
 * stations; the seed only adds new slugs. Stations are never deleted, only hidden, so their
 * reviews and check-ins are kept.
 */

export type AdminStation = Omit<repo.StationRow, "createdAt">;

function assertAdmin(session: Session) {
  if (!isAdmin(session)) throw new AppError("forbidden", "Only the crew owner can do that.");
}

const withoutCreatedAt = ({ createdAt, ...s }: repo.StationRow): AdminStation => (
  void createdAt,
  s
);

/** Every station, hidden ones included, A–Z. */
export async function listStationsForAdmin(db: Db, session: Session): Promise<AdminStation[]> {
  assertAdmin(session);
  return (await repo.listAllStations(db)).map(withoutCreatedAt);
}

/** Adds a building. Its slug (and so its URL) comes from the name and never changes after. */
export async function createStation(
  db: Db,
  session: Session,
  input: StationInput,
): Promise<AdminStation> {
  assertAdmin(session);
  const slug = slugFromName(input.name);
  if (!slug) {
    const message = "Use some letters or numbers in the name.";
    throw new AppError("invalid", message, { fields: { name: [message] } });
  }
  try {
    return withoutCreatedAt(await repo.insertStation(db, slug, input));
  } catch (e) {
    if (isUniqueViolation(e, "stations_slug_unique")) {
      const message = `There's already a building at /stations/${slug} (maybe hidden). Change the name a little.`;
      throw new AppError("conflict", message, { fields: { name: [message] } });
    }
    throw e;
  }
}

/** Edits or hides a building. The slug stays, since URLs and reviews point to it. */
export async function updateStation(
  db: Db,
  session: Session,
  slug: string,
  input: StationInput,
): Promise<AdminStation> {
  assertAdmin(session);
  const row = await repo.updateStation(db, slug, input);
  if (!row) throw new AppError("not_found", "That building isn't on the list.");
  return withoutCreatedAt(row);
}
