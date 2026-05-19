/**
 * WebAuthn / Passkey helpers. Single-user model: every passkey on file
 * belongs to "the owner". We use a stable userID derived from the env so
 * passkeys remain valid across SESSION_SECRET rotations.
 */
import "server-only";

const USER_HANDLE = "expense-tracker-owner";

export function getUserHandle(): Uint8Array<ArrayBuffer> {
  const bytes = new TextEncoder().encode(USER_HANDLE);
  // Force an ArrayBuffer-backed Uint8Array so the type matches the WebAuthn
  // libs' stricter `Uint8Array<ArrayBuffer>` signature on TS 5.7+.
  const out = new Uint8Array(bytes.byteLength);
  out.set(bytes);
  return out;
}

/**
 * Derive the RP ID (effective domain) and origin from the request. WebAuthn
 * requires the RP ID to be a registrable suffix of the page's effective
 * domain — for us that's literally the host minus port.
 */
export function rpFromRequest(req: Request): { rpID: string; origin: string } {
  const url = new URL(req.url);
  // host already includes port; rpID must not include port.
  const rpID = url.hostname;
  const origin = `${url.protocol}//${url.host}`;
  return { rpID, origin };
}

export const RP_NAME = "Expense Tracker — Project CIP SRL";
