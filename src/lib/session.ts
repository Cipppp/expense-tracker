import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export type SessionData = {
  isAuthed?: boolean;
  loginAt?: number;
  // Used briefly during WebAuthn ceremonies to bind the challenge to the
  // user agent that requested it.
  currentChallenge?: string;
};

const NINETY_DAYS = 60 * 60 * 24 * 90;

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET ?? "dev-only-secret-please-rotate-32-chars-long",
  cookieName: "et_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  },
};

/** Options for a long-lived "remember me" session (90 days). */
export const rememberSessionOptions: SessionOptions = {
  ...sessionOptions,
  cookieOptions: {
    ...sessionOptions.cookieOptions,
    maxAge: NINETY_DAYS,
  },
  ttl: NINETY_DAYS,
};

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

export async function getSessionRemember() {
  return getIronSession<SessionData>(await cookies(), rememberSessionOptions);
}
