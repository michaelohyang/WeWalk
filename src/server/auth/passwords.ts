import "server-only";
import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

/*
 * Passwords are stored as salted scrypt hashes: `scrypt$<log2 N>$<r>$<p>$<salt>$<hash>`.
 * A hash can't be turned back into the password, so nobody reading the database (us included)
 * can see it. scrypt is deliberately slow and memory-hungry, which makes guessing expensive, and
 * the random salt means two people with the same password get different hashes.
 */

const LOG_N = 15; // N = 32768: ~50–100 ms per check on a server
const R = 8;
const P = 1;
const KEY_LENGTH = 32;

function scrypt(password: string, salt: Buffer, logN: number, r: number, p: number) {
  const options: ScryptOptions = { N: 2 ** logN, r, p, maxmem: 256 * 2 ** logN * r };
  return new Promise<Buffer>((resolve, reject) =>
    scryptCb(password.normalize("NFKC"), salt, KEY_LENGTH, options, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, LOG_N, R, P);
  return ["scrypt", LOG_N, R, P, salt.toString("base64url"), key.toString("base64url")].join("$");
}

/** Whether `password` matches `stored`. Constant-time; a malformed hash never matches. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, logN, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const key = await scrypt(password, Buffer.from(salt, "base64url"), +logN!, +r!, +p!);
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** A real hash of nothing in particular: checked against when a name doesn't exist, so a wrong
 * name takes as long as a wrong password and response times don't reveal who has an account. */
let decoy: Promise<string> | undefined;
export const decoyHash = () => (decoy ??= hashPassword(randomBytes(16).toString("hex")));
