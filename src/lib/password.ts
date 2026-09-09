/*
 * Fara "server-only": modulul e folosit si de `scripts/adopt-owner.ts`, care
 * ruleaza in afara Next.js. Nu citeste mediu, nu atinge baza de date si nu
 * tine niciun secret — e doar scrypt peste un sir primit ca argument.
 */
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

/**
 * Parolele se păstrează hashuite, nu în clar.
 *
 * Până acum exista o singură parolă, ținută într-o variabilă de mediu și
 * comparată cu `!==`. Cu conturi, parola ajunge în baza de date — iar o bază
 * de date scursă cu parole în clar înseamnă și conturile oamenilor de pe alte
 * site-uri, pentru că lumea refolosește parole.
 *
 * scrypt vine din Node, deci nu adaugă nicio dependență, și e o funcție
 * concepută pentru parole: costul de memorie face ca încercările în masă să
 * fie scumpe, spre deosebire de un SHA oricât de lung.
 */
const KEYLEN = 64;
const PREFIX = "scrypt";

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEYLEN);
  return `${PREFIX}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== PREFIX) return false;
  const salt = Buffer.from(parts[1], "base64");
  const expected = Buffer.from(parts[2], "base64");
  if (expected.length !== KEYLEN) return false;
  const actual = await scrypt(password, salt, KEYLEN);
  // Comparație în timp constant: altfel durata răspunsului spune cât ai nimerit.
  return timingSafeEqual(actual, expected);
}
