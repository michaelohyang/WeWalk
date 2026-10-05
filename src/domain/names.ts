export const NAME_MAX_LENGTH = 30;

/** Trims, collapses inner whitespace and normalizes Unicode so "Dana " and "Dana" are one name. */
export function normalizeDisplayName(raw: string): string {
  return raw.normalize("NFC").trim().replace(/\s+/g, " ");
}

/**
 * The uniqueness key for a display name. Two names that look the same share a key: case,
 * compatibility forms (full-width "Ｄａｎａ") and invisible format characters (zero-width
 * spaces, soft hyphens) are folded away.
 */
export function nameKey(name: string): string {
  const folded = name.normalize("NFKC").replace(/\p{Cf}/gu, "");
  return normalizeDisplayName(folded).toLocaleLowerCase("en-US");
}

// Control characters, and bidi overrides that could make a name display backwards.
const UNSHOWABLE = /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u;

/** Returns an error message for an invalid (already normalized) name, or null if it's fine. */
export function displayNameProblem(name: string): string | null {
  if (name.length === 0) return "Pick a name so the crew knows who's talking.";
  if ([...name].length > NAME_MAX_LENGTH) return `Keep it to ${NAME_MAX_LENGTH} characters.`;
  if (UNSHOWABLE.test(name)) return "That name has characters we can't show.";
  if (nameKey(name) === "") return "Pick a name with some letters in it.";
  return null;
}
