export const NAME_MAX_LENGTH = 30;

/** Trims, collapses inner whitespace and normalizes Unicode so "Dana " and "Dana" are one name. */
export function normalizeDisplayName(raw: string): string {
  return raw.normalize("NFC").trim().replace(/\s+/g, " ");
}

/** The uniqueness key for a display name: case-insensitive. */
export function nameKey(name: string): string {
  return normalizeDisplayName(name).toLocaleLowerCase("en-US");
}

/** Returns an error message for an invalid (already normalized) name, or null if it's fine. */
export function displayNameProblem(name: string): string | null {
  if (name.length === 0) return "Pick a name so the crew knows who's talking.";
  if ([...name].length > NAME_MAX_LENGTH) return `Keep it to ${NAME_MAX_LENGTH} characters.`;
  if (/[\u0000-\u001f\u007f]/.test(name)) return "That name has characters we can't show.";
  return null;
}
