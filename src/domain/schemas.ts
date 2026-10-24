import { z } from "zod";
import { AREA_KEYS } from "./areas";
import { CATEGORY_KEYS, type CategoryKey } from "./categories";
import { isIsoDate } from "./dates";
import { displayNameProblem, normalizeDisplayName } from "./names";
import { REACTION_KEYS } from "./reactions";
import { TAGS } from "./tags";

/**
 * Request shapes shared by the API (validation) and, later, the client (forms).
 * Server-only rules that need the clock or the database (e.g. visit date not in the future,
 * name already taken) live in the services.
 */

export const stationSlugSchema = z
  .string("Pick a building.")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "That building isn't on the map.");
export const idSchema = z.uuid("That id isn't valid.");
export const reactionKindSchema = z.enum(REACTION_KEYS, "That reaction isn't one of ours.");
const isoDateSchema = z.string("Pick a date.").refine(isIsoDate, "That date isn't valid.");

const score = z
  .int("Scores go from 1 to 5.")
  .min(1, "Scores go from 1 to 5.")
  .max(5, "Scores go from 1 to 5.");
const scoresSchema = z
  .object(
    Object.fromEntries(CATEGORY_KEYS.map((k) => [k, score.optional()])) as Record<
      CategoryKey,
      z.ZodOptional<typeof score>
    >,
  )
  .strict()
  .refine((s) => Object.values(s).some((v) => v !== undefined), "Rate at least one thing.");

const displayNameSchema = z
  .string()
  .transform(normalizeDisplayName)
  .superRefine((name, ctx) => {
    const problem = displayNameProblem(name);
    if (problem) ctx.addIssue({ code: "custom", message: problem });
  });

/**
 * Free text: control characters and bidi overrides are removed (Postgres rejects NUL, and the rest only cause
 * trouble). `multiline` keeps line breaks and tabs; single-line text turns them into spaces.
 */
const text = (max: number, { multiline = false } = {}) =>
  z
    .string("That should be text.")
    .transform((s) =>
      (multiline ? s.replace(/\r\n?/g, "\n") : s.replace(/[\t\r\n]+/g, " "))
        .replace(multiline ? /[\u0000-\u0008\u000b-\u001f\u007f]/g : /[\u0000-\u001f\u007f]/g, "")
        // Bidi overrides can make text display backwards or hide what it says.
        .replace(/[\u202a-\u202e\u2066-\u2069]/g, "")
        .trim(),
    )
    .pipe(z.string().max(max, `Keep it under ${max} characters.`))
    .default("");

/**
 * Writes queued offline before the rename to `stationSlug` still carry `stationId`; accept it,
 * so a phone that was offline over a deploy doesn't lose them.
 */
const legacyStationField = (v: unknown) => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return v;
  const { stationId, ...rest } = v as Record<string, unknown>;
  return stationId === undefined || "stationSlug" in rest ? v : { ...rest, stationSlug: stationId };
};

export const reviewInputSchema = z.preprocess(
  legacyStationField,
  z
    .object({
      stationSlug: stationSlugSchema,
      visitedOn: isoDateSchema,
      scores: scoresSchema,
      hotTake: text(120),
      body: text(1200, { multiline: true }),
      tags: z
        .array(z.enum(TAGS, "That tag isn't on the list."))
        .max(TAGS.length)
        .default([])
        .transform((ts) => [...new Set(ts)]),
      /** From POST /api/photos; the server checks it's one of ours. Leaving it out removes it. */
      photoUrl: z.string().max(500).nullable().default(null),
    })
    .strict(),
);
export type ReviewInput = z.infer<typeof reviewInputSchema>;

export const checkinInputSchema = z.preprocess(
  legacyStationField,
  z
    .object({
      stationSlug: stationSlugSchema,
      visitedOn: isoDateSchema,
      note: text(400, { multiline: true }),
    })
    .strict(),
);
export type CheckinInput = z.infer<typeof checkinInputSchema>;

/** A new password: long enough to be worth hashing, short enough not to be a DoS vector. */
const newPasswordSchema = z
  .string("Pick a password.")
  .min(8, "At least 8 characters. A short phrase works.")
  .max(200, "That's a bit much. Keep it under 200 characters.");

export const signupInputSchema = z
  .object({
    name: displayNameSchema,
    password: newPasswordSchema,
    /** From the invite link; required once the crew sets SIGNUP_CODE. */
    code: z.string().max(200).optional(),
  })
  .strict();
export type SignupInput = z.infer<typeof signupInputSchema>;

export const loginInputSchema = z
  .object({
    name: z.string("Enter your username.").trim().min(1, "Enter your username.").max(200),
    password: z.string("Enter your password.").min(1, "Enter your password.").max(200),
  })
  .strict();
export type LoginInput = z.infer<typeof loginInputSchema>;

/** `current` is required once you have a password; first-time setup has none. */
export const setPasswordInputSchema = z
  .object({ current: z.string().max(200).optional(), password: newPasswordSchema })
  .strict();

export const renameInputSchema = z.object({ name: displayNameSchema }).strict();

export const recoveryInputSchema = z.object({ memberId: idSchema }).strict();

export const handOverInputSchema = z.object({ memberId: idSchema }).strict();

/** Deleting your account asks for your password again. */
export const deleteAccountInputSchema = z
  .object({
    password: z.string("Enter your password.").min(1, "Enter your password.").max(200),
  })
  .strict();

export const redeemLinkSchema = z.object({ token: z.string().min(20).max(100) }).strict();

/**
 * A new station's slug, from its name: "1 Seaport Sq." → "1-seaport-sq". Accents are dropped and
 * anything that isn't a letter or digit becomes a hyphen, matching the slug check constraint.
 * Empty when the name has no letters or digits.
 */
export const slugFromName = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const requiredText = (max: number, message: string) =>
  text(max).refine((s) => s.length > 0, message);

const coordinate = (label: "Latitude" | "Longitude", limit: number) => {
  const range = `${label} goes from -${limit} to ${limit}.`;
  return z
    .number(`Enter the ${label.toLowerCase()} as a number.`)
    .min(-limit, range)
    .max(limit, range);
};

/**
 * A building, as the owner adds or edits it at /admin/stations. No slug: a new station's comes
 * from its name, and an existing one's never changes (URLs and reviews point to it).
 */
export const stationInputSchema = z
  .object({
    name: requiredText(80, "Give the building a name."),
    /** "450 Lex". Empty means the map and stamps use the name. */
    short: text(30).transform((s) => s || null),
    address: requiredText(200, "Add the street address."),
    neighborhood: requiredText(60, "Add the neighborhood."),
    area: z.enum(AREA_KEYS, "Pick an area."),
    lat: coordinate("Latitude", 90),
    lng: coordinate("Longitude", 180),
    /** Required, so an edit that leaves it out can't un-hide a station by accident. */
    hidden: z.boolean("Say whether the building is hidden."),
  })
  .strict();
export type StationInput = z.infer<typeof stationInputSchema>;
