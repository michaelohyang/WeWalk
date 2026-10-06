import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import { getDb } from "./db/client";
import { loadCrew } from "./services/crew";

/*
 * The crew's shared data (stations, members, reviews, check-ins) is the same for everyone and
 * only changes on a write, so pages read it from Next's data cache instead of querying the
 * database on every navigation. Every write calls crewChanged(), which drops the cached copy so
 * the very next page load (the writer's own included) sees the change.
 */

const CREW_TAG = "crew";

/*
 * Vercel keeps the data cache across deploys, so a deploy that changes CrewData's shape would
 * read the previous deploy's copy (a renamed field comes back undefined). Keying the cache by
 * deployment gives each deploy its own copy: one fresh load after a deploy, then cached again.
 * Bump SHAPE too when changing CrewData, for anywhere VERCEL_DEPLOYMENT_ID isn't set.
 */
const SHAPE = "v3";
const DEPLOYMENT = process.env.VERCEL_DEPLOYMENT_ID ?? "local";

export const crewData = unstable_cache(
  async () => loadCrew(await getDb()),
  ["crew-data", SHAPE, DEPLOYMENT],
  { tags: [CREW_TAG] },
);

/** Call after any write that changes what pages show. */
export function crewChanged(): void {
  revalidateTag(CREW_TAG, { expire: 0 });
}
