import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/*
 * Criptarea tokenurilor OAuth inainte sa ajunga in Postgres.
 *
 * AES-256-GCM cu o cheie de 32 de octeti din ANAF_TOKEN_ENC_KEY (base64).
 * Formatul stocat e base64(iv | tag | ciphertext), cu IV de 12 octeti si tag
 * de 16. Un JWT de la ANAF are peste 1 KB, deci coloanele sunt TEXT.
 *
 * Fara cheie nu se salveaza nimic: un refresh token in clar in baza ar fi
 * echivalent cu certificatul firmei pentru 365 de zile.
 */

function key(): Buffer {
  const raw = process.env.ANAF_TOKEN_ENC_KEY ?? "";
  const k = Buffer.from(raw, "base64");
  if (k.length !== 32) {
    throw new Error(
      "ANAF_TOKEN_ENC_KEY must be 32 random bytes, base64-encoded (openssl rand -base64 32).",
    );
  }
  return k;
}

export function encKeyConfigured(): boolean {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  const tag = c.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decrypt(stored: string): string {
  const buf = Buffer.from(stored, "base64");
  if (buf.length < 12 + 16 + 1) throw new Error("Encrypted token is malformed");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}
