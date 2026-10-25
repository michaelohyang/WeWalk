import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { AREA_KEYS, CITIES } from "@/domain/areas";
import { CATEGORY_KEYS } from "@/domain/categories";
import { REACTION_KEYS } from "@/domain/reactions";

/*
 * Data rules live here as constraints, not in app code (docs/PLAN.md §7).
 * Every table has row-level security enabled with no policies: only our server, connecting as
 * the database owner, can read or write. Supabase's auto-generated API sees nothing.
 */

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const inList = (column: string, values: readonly string[]) =>
  sql.raw(`${column} in (${values.map((v) => `'${v}'`).join(", ")})`);

export const stations = pgTable(
  "stations",
  {
    /** The key reviews and check-ins point to. */
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    /** Readable and stable, for links (/stations/dock-72) and the seed file. */
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    /** How locals say it ("450 Lex"), for the map and stamps. Null means use the name. */
    short: text("short"),
    address: text("address").notNull(),
    neighborhood: text("neighborhood").notNull(),
    area: text("area").notNull(),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    hidden: boolean("hidden").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    check("stations_area_known", inList("area", AREA_KEYS)),
    check("stations_slug_format", sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
  ],
).enableRLS();

export const members = pgTable(
  "members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    nameKey: text("name_key").notNull(),
    /** Legacy: the first crew's owner. Crew roles live in crew_members; kept for rollbacks. */
    isOwner: boolean("is_owner").notNull().default(false),
    /** App-wide admin: station management and recovery links. Not a crew role. */
    isAdmin: boolean("is_admin").notNull().default(false),
    /**
     * A salted scrypt hash (see server/auth/passwords.ts), never the password itself: it can't be
     * turned back into the password, by anyone. Null for people who joined before passwords.
     */
    passwordHash: text("password_hash"),
    /** Wrong passwords in a row, and the lockout they trigger (slows down guessing). */
    failedLogins: smallint("failed_logins").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    /**
     * When they finished the welcome steps (city, crew, first rating). Null until then, and pages
     * send them to /welcome. The default marks everyone from before onboarding as done; sign-up
     * writes null.
     */
    onboardedAt: timestamp("onboarded_at", { withTimezone: true }).defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("members_name_key_unique").on(t.nameKey),
    // At most one owner.
    uniqueIndex("members_one_owner")
      .on(t.isOwner)
      .where(sql`${t.isOwner}`),
  ],
).enableRLS();

/**
 * The crew that existed before crews: everyone and everything from then belongs to it. Fixed so
 * the migration can backfill it, and so posts that old code writes with no crew land here.
 */
export const FIRST_CREW_ID = "00000000-0000-4000-8000-00000000c4e1";

/** A group of friends: its own feed, rankings, invite link and owner. */
export const crews = pgTable(
  "crews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    /** In the crew's invite link (/join/<code>). Rotating it retires old links. */
    inviteCode: text("invite_code").notNull().unique(),
    /** The city new members start in. */
    homeCity: text("home_city").notNull().default("nyc"),
    createdAt: createdAt(),
  },
  (t) => [
    check(
      "crews_home_city_known",
      inList(
        "home_city",
        CITIES.map((c) => c.key),
      ),
    ),
    check("crews_name_length", sql`char_length(${t.name}) between 1 and 40`),
  ],
).enableRLS();

export const crewMembers = pgTable(
  "crew_members",
  {
    crewId: uuid("crew_id")
      .notNull()
      .references(() => crews.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.crewId, t.memberId] }),
    index("crew_members_member_idx").on(t.memberId),
    // One owner per crew (two people signing up first at once: the loser joins as a member).
    uniqueIndex("crew_members_one_owner")
      .on(t.crewId)
      .where(sql`${t.role} = 'owner'`),
    check("crew_members_role_known", inList("role", ["owner", "member"])),
  ],
).enableRLS();

export const devices = pgTable(
  "devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    label: text("label").notNull().default(""),
    createdAt: createdAt(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("devices_member_idx").on(t.memberId)],
).enableRLS();

/** One-time links: owner-issued recovery for a forgotten password (24 h). "pair" links are no longer made. */
export const links = pgTable(
  "links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    purpose: text("purpose").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  () => [check("links_purpose_known", inList("purpose", ["pair", "recover"]))],
).enableRLS();

const scoreColumns = Object.fromEntries(CATEGORY_KEYS.map((k) => [k, smallint(k)])) as {
  [K in (typeof CATEGORY_KEYS)[number]]: ReturnType<typeof smallint<K>>;
};

export const reviews = pgTable(
  "reviews",
  {
    /** Generated by the client so retries are idempotent. */
    id: uuid("id").primaryKey(),
    stationId: integer("station_id")
      .notNull()
      .references(() => stations.id),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    visitedOn: date("visited_on", { mode: "string" }).notNull(),
    ...scoreColumns,
    hotTake: text("hot_take").notNull().default(""),
    body: text("body").notNull().default(""),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    /** One photo, stored in Vercel Blob (see server/photos.ts). */
    photoUrl: text("photo_url"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // One review per person per station; posting again edits it.
    uniqueIndex("reviews_one_per_member_station").on(t.stationId, t.memberId),
    index("reviews_member_idx").on(t.memberId),
    check("reviews_has_a_score", sql.raw(`num_nonnulls(${CATEGORY_KEYS.join(", ")}) > 0`)),
    ...CATEGORY_KEYS.map((k) => check(`reviews_${k}_range`, sql.raw(`${k} between 1 and 5`))),
    check("reviews_hot_take_length", sql`char_length(${t.hotTake}) <= 120`),
    check("reviews_body_length", sql`char_length(${t.body}) <= 1200`),
    check("reviews_photo_url_length", sql`char_length(${t.photoUrl}) <= 500`),
  ],
).enableRLS();

export const checkins = pgTable(
  "checkins",
  {
    /** Generated by the client so retries are idempotent. */
    id: uuid("id").primaryKey(),
    stationId: integer("station_id")
      .notNull()
      .references(() => stations.id),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    visitedOn: date("visited_on", { mode: "string" }).notNull(),
    note: text("note").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [
    // One check-in per person per station per day.
    uniqueIndex("checkins_one_per_member_station_day").on(t.stationId, t.memberId, t.visitedOn),
    index("checkins_member_idx").on(t.memberId),
    check("checkins_note_length", sql`char_length(${t.note}) <= 400`),
  ],
).enableRLS();

/** One-tap reactions to a review (🔥 💯 😂 🙅). Each person can add each kind once. */
export const reactions = pgTable(
  "reactions",
  {
    reviewId: uuid("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    /** The crew it was made in (reactions are per crew; a shared review can get them in each). */
    crewId: uuid("crew_id")
      .notNull()
      .default(FIRST_CREW_ID)
      .references(() => crews.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    // Per crew: the same reaction can be made on a shared review in each crew that sees it.
    primaryKey({ columns: [t.reviewId, t.memberId, t.kind, t.crewId] }),
    index("reactions_crew_idx").on(t.crewId),
    check("reactions_kind_known", inList("kind", REACTION_KEYS)),
  ],
).enableRLS();

/** Which crews see a review (one review can be shared to several of its author's crews). */
export const reviewCrews = pgTable(
  "review_crews",
  {
    reviewId: uuid("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    crewId: uuid("crew_id")
      .notNull()
      .references(() => crews.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.reviewId, t.crewId] }),
    index("review_crews_crew_idx").on(t.crewId),
  ],
).enableRLS();

/** Which crews see a check-in. */
export const checkinCrews = pgTable(
  "checkin_crews",
  {
    checkinId: uuid("checkin_id")
      .notNull()
      .references(() => checkins.id, { onDelete: "cascade" }),
    crewId: uuid("crew_id")
      .notNull()
      .references(() => crews.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.checkinId, t.crewId] }),
    index("checkin_crews_crew_idx").on(t.crewId),
  ],
).enableRLS();

/**
 * A member flagging a review or check-in in one crew. The crew's owner handles it and sees who
 * reported it; a report about the owner's own post goes to the app admin instead.
 */
export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    crewId: uuid("crew_id")
      .notNull()
      .references(() => crews.id, { onDelete: "cascade" }),
    /** Null once the reporter deletes their account (the report stays for the owner). */
    reporterId: uuid("reporter_id").references(() => members.id, { onDelete: "set null" }),
    /** Who wrote the post. */
    authorId: uuid("author_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    reviewId: uuid("review_id").references(() => reviews.id, { onDelete: "cascade" }),
    checkinId: uuid("checkin_id").references(() => checkins.id, { onDelete: "cascade" }),
    reason: text("reason").notNull().default(""),
    status: text("status").notNull().default("open"),
    createdAt: createdAt(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [
    index("reports_open_crew_idx")
      .on(t.crewId)
      .where(sql`${t.status} = 'open'`),
    // Reporting the same post twice while it's open is one report.
    uniqueIndex("reports_one_open_per_reporter")
      .on(t.crewId, t.reporterId, sql`coalesce(${t.reviewId}, ${t.checkinId})`)
      .where(sql`${t.status} = 'open'`),
    check("reports_one_target", sql`num_nonnulls(${t.reviewId}, ${t.checkinId}) = 1`),
    check("reports_status_known", inList("status", ["open", "hidden", "removed", "dismissed"])),
    check("reports_reason_length", sql`char_length(${t.reason}) <= 300`),
  ],
).enableRLS();

/** Reviews an owner took out of their crew. Sharing them to that crew again is refused. */
export const reviewHides = pgTable(
  "review_hides",
  {
    reviewId: uuid("review_id")
      .notNull()
      .references(() => reviews.id, { onDelete: "cascade" }),
    crewId: uuid("crew_id")
      .notNull()
      .references(() => crews.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.reviewId, t.crewId] })],
).enableRLS();

/** Check-ins an owner took out of their crew. */
export const checkinHides = pgTable(
  "checkin_hides",
  {
    checkinId: uuid("checkin_id")
      .notNull()
      .references(() => checkins.id, { onDelete: "cascade" }),
    crewId: uuid("crew_id")
      .notNull()
      .references(() => crews.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.checkinId, t.crewId] })],
).enableRLS();

/** People an owner removed from their crew: they can't rejoin it (or see it in the list). */
export const crewBans = pgTable(
  "crew_bans",
  {
    crewId: uuid("crew_id")
      .notNull()
      .references(() => crews.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.crewId, t.memberId] })],
).enableRLS();

/**
 * Every uploaded photo and who uploaded it. A review may only use its author's own uploads, so
 * nobody can point a review at someone else's photo and then get it deleted by replacing it.
 */
export const photos = pgTable(
  "photos",
  {
    url: text("url").primaryKey(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [index("photos_member").on(t.memberId)],
).enableRLS();

/**
 * Request counters for abuse limits (server/services/rate-limits.ts), one row per key and fixed
 * window. Kept in Postgres because serverless functions share no memory. Old windows are deleted
 * as the app runs, so the table stays small.
 */
export const rateLimits = pgTable(
  "rate_limits",
  {
    /** What is counted and for whom, e.g. "signup:<hashed IP>" or "posts:<hashed member id>". */
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
).enableRLS();
