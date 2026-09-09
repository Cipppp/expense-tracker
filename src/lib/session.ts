import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export type SessionData = {
  /*
   * Cine e logat. Inainte exista doar `isAuthed`, pentru ca exista un singur
   * om posibil. Sesiunile vechi nu au `userId`, deci nu mai sunt valide — la
   * o schimbare de model de autentificare, asta e comportamentul bun, nu un
   * efect secundar.
   */
  userId?: string;
  isAuthed?: boolean;
  loginAt?: number;
  // Used briefly during WebAuthn ceremonies to bind the challenge to the
  // user agent that requested it.
  currentChallenge?: string;
};

const NINETY_DAYS = 60 * 60 * 24 * 90;

/*
 * Secretul nu are valoare de rezerva.
 *
 * Un fallback scris in cod si publicat in repo inseamna ca oricine poate
 * semna singur un cookie de sesiune valid si intra fara parola. Mai bine
 * pica o cerere cu o eroare limpede decat sa mearga cu usa deschisa.
 *
 * Se citeste lazy, la prima cerere, nu la incarcarea modulului: `next build`
 * importa modulul asta, iar o aruncare la import ar strica build-ul pe orice
 * masina care n-are variabila setata.
 */
function sessionPassword(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET lipsește sau are sub 32 de caractere. Generează unul cu `openssl rand -hex 32`.",
    );
  }
  return secret;
}

const cookieDefaults = {
  secure: process.env.NODE_ENV === "production",
  httpOnly: true,
  sameSite: "lax",
  path: "/",
} as const;

export function getSessionOptions(): SessionOptions {
  return {
    password: sessionPassword(),
    cookieName: "et_session",
    cookieOptions: { ...cookieDefaults },
  };
}

/** @deprecated foloseste getSessionOptions() — ramane pentru middleware. */
export const sessionOptions: SessionOptions = {
  get password() {
    return sessionPassword();
  },
  cookieName: "et_session",
  cookieOptions: { ...cookieDefaults },
};

/*
 * Marcajul fluxului OAuth cu ANAF sta intr-un cookie SEPARAT, de 10 minute.
 *
 * ANAF cere `state` gol, deci legatura callback-ului cu cine l-a pornit se
 * face prin cookie. Nu-l punem in sesiunea de login: un `save()` pe sesiunea
 * de autentificare cu optiunile scurte ar rescrie un cookie "remember me" de
 * 90 de zile intr-unul de 14 — si te-ar deloga peste doua saptamani fara sa
 * stii de ce.
 */
export type AnafOauthMarker = { startedAt?: number };

export const anafOauthSessionOptions: SessionOptions = {
  get password() {
    return sessionPassword();
  },
  cookieName: "et_anaf_oauth",
  cookieOptions: { ...cookieDefaults, maxAge: 600 },
  ttl: 600,
};

export async function getAnafOauthSession() {
  return getIronSession<AnafOauthMarker>(await cookies(), anafOauthSessionOptions);
}

/** Options for a long-lived "remember me" session (90 days). */
export const rememberSessionOptions: SessionOptions = {
  ...sessionOptions,
  cookieOptions: {
    ...sessionOptions.cookieOptions,
    maxAge: NINETY_DAYS,
  },
  ttl: NINETY_DAYS,
};

/** Utilizatorul din sesiune, sau null. Folosit si de filtrarea din stratul de date. */
export async function currentUserId(): Promise<string | null> {
  const session = await getSession();
  return session.userId ?? null;
}

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

export async function getSessionRemember() {
  return getIronSession<SessionData>(await cookies(), rememberSessionOptions);
}
