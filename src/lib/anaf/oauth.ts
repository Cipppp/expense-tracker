import { requireUserId } from "@/lib/queries";
import "server-only";
import { db } from "@/lib/db";
import { decrypt, encrypt } from "./crypto";

/*
 * OAuth2 la ANAF pentru e-Factura.
 *
 * Endpointurile sunt cele din procedura oficiala ANAF ("Oauth_procedura_
 * inregistrare_aplicatii_portal_ANAF.pdf"):
 *   authorize  https://logincert.anaf.ro/anaf-oauth2/v1/authorize
 *   token      https://logincert.anaf.ro/anaf-oauth2/v1/token
 *
 * Certificatul calificat e prezentat de BROWSER, o singura data, la
 * `authorize` (TLS reciproc pe logincert). Codul primit in callback trebuie
 * schimbat in maximum 60 de secunde. Tokenul de acces tine 90 de zile,
 * refresh tokenul 365; refresh-ul intoarce o pereche NOUA care se salveaza.
 * Tokenul poarta drepturile din SPV ale certificatului pentru CIF-ul firmei —
 * nu e "al aplicatiei", e al persoanei care s-a autentificat.
 *
 * `scope` si `state` raman goale, asa cum cere procedura. In lipsa lui
 * `state`, legatura callback-ului cu cine a pornit fluxul se face printr-un
 * cookie scurt, separat (vezi rutele /api/anaf/oauth/*).
 */

export const ANAF_AUTHORIZE = "https://logincert.anaf.ro/anaf-oauth2/v1/authorize";
export const ANAF_TOKEN = "https://logincert.anaf.ro/anaf-oauth2/v1/token";
const HELLO = "https://api.anaf.ro/TestOauth/jaxrs/hello";

const DAY = 86_400_000;
const REFRESH_LIFETIME_MS = 365 * DAY;
const ACCESS_FALLBACK_MS = 90 * DAY;
/** Reimprospatam cu doua saptamani inainte sa expire accesul. */
export const REFRESH_AHEAD_MS = 14 * DAY;
/** Sub o luna pe refresh token, avertizam: dupa aia e nevoie iar de certificat. */
export const REAUTH_WARN_MS = 30 * DAY;
/** Un refresh pornit si neincheiat in atat e considerat mort. */
const REFRESH_INFLIGHT_MS = 60_000;

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

export class AnafAuthError extends Error {
  status: number;
  body: string;
  /** true = refresh tokenul nu mai e bun; trebuie iar autorizare cu certificat. */
  needsReauth: boolean;
  constructor(status: number, body: string, needsReauth = false) {
    super(`ANAF OAuth ${status}: ${body.slice(0, 300)}`);
    this.name = "AnafAuthError";
    this.status = status;
    this.body = body;
    this.needsReauth = needsReauth;
  }
}

export function authorizeUrl(): string {
  const u = new URL(ANAF_AUTHORIZE);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", env("ANAF_CLIENT_ID"));
  u.searchParams.set("redirect_uri", env("ANAF_REDIRECT_URI"));
  // Parametru de query pe authorize, conform procedurii: tokenul vine ca JWT.
  u.searchParams.set("token_content_type", "jwt");
  return u.toString();
}

function basicAuth(): string {
  return (
    "Basic " +
    Buffer.from(`${env("ANAF_CLIENT_ID")}:${env("ANAF_CLIENT_SECRET")}`).toString("base64")
  );
}

export type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
};

async function tokenCall(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(ANAF_TOKEN, {
    method: "POST",
    headers: {
      Authorization: basicAuth(),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams(body),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  if (!res.ok) {
    // Textul vazut in practica cand refresh tokenul a expirat, plus forma
    // standard OAuth pentru un refresh token consumat/revocat.
    const dead = /refresh token status is expired|invalid_grant/i.test(text);
    throw new AnafAuthError(res.status, text, dead);
  }
  let json: TokenResponse;
  try {
    json = JSON.parse(text);
  } catch {
    throw new AnafAuthError(res.status, `Non-JSON token response: ${text}`);
  }
  if (!json.access_token) throw new AnafAuthError(res.status, `No access_token: ${text}`);
  return json;
}

export function exchangeCode(code: string): Promise<TokenResponse> {
  return tokenCall({
    grant_type: "authorization_code",
    code,
    redirect_uri: env("ANAF_REDIRECT_URI"),
    token_content_type: "jwt",
  });
}

export function refreshTokens(refreshToken: string): Promise<TokenResponse> {
  // Procedura: Basic auth + grant_type + refresh_token. `token_content_type`
  // e ce trimit si SDK-urile existente; ANAF il ignora daca nu-i trebuie.
  return tokenCall({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    token_content_type: "jwt",
  });
}

/** `exp` din JWT (segmentul din mijloc, base64url), sau null daca nu e JWT. */
export function jwtExp(jwt: string): Date | null {
  const parts = jwt.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return typeof payload.exp === "number" ? new Date(payload.exp * 1000) : null;
  } catch {
    return null;
  }
}

function accessExpiry(tr: TokenResponse, now: Date): Date {
  return (
    jwtExp(tr.access_token) ??
    new Date(now.getTime() + (tr.expires_in ? tr.expires_in * 1000 : ACCESS_FALLBACK_MS))
  );
}

const REAUTH_MSG =
  "Stored ANAF tokens cannot be decrypted (ANAF_TOKEN_ENC_KEY changed?) — reauthorize with the certificate.";

/*
 * Decriptare care stie ce inseamna esecul: o cheie schimbata pe Vercel nu e o
 * eroare de retea, e "conecteaza-te iar cu certificatul". Se scrie cu clientul
 * radacina, nu prin tranzactia care urmeaza sa fie anulata.
 */
async function decryptOrReauth(enc: string): Promise<string> {
  try {
    return decrypt(enc);
  } catch {
    await db.anafToken
      .update({ where: { userId: await requireUserId() }, data: { lastError: REAUTH_MSG, needsReauth: true, refreshingAt: null } })
      .catch(() => {});
    throw new AnafAuthError(0, REAUTH_MSG, true);
  }
}

/**
 * Salveaza perechea primita. La refresh, daca ANAF nu a intors un refresh
 * token nou, il pastram pe cel vechi — nu-l stergem niciodata pe baza unei
 * absente.
 */
export async function storeTokens(
  tr: TokenResponse,
  mode: { kind: "authorize" } | { kind: "refresh"; keepRefreshEnc: string },
) {
  const now = new Date();
  const refreshEnc = tr.refresh_token
    ? encrypt(tr.refresh_token)
    : mode.kind === "refresh"
      ? mode.keepRefreshEnc
      : null;
  if (!refreshEnc) throw new AnafAuthError(200, "Authorize response had no refresh_token");

  const data = {
    accessTokenEnc: encrypt(tr.access_token),
    refreshTokenEnc: refreshEnc,
    accessExpiresAt: accessExpiry(tr, now),
    // Durata oficiala e 365 de zile de la emiterea refresh tokenului curent.
    refreshExpiresAt: tr.refresh_token
      ? new Date(now.getTime() + REFRESH_LIFETIME_MS)
      : undefined,
    lastError: null as string | null,
    needsReauth: false,
    refreshingAt: null as Date | null,
  };

  const userId = await requireUserId();
  return db.anafToken.upsert({
    where: { userId },
    create: {
      userId,
      ...data,
      refreshExpiresAt: data.refreshExpiresAt ?? new Date(now.getTime() + REFRESH_LIFETIME_MS),
      obtainedAt: now,
    },
    // La o autorizare noua seria certificatului si ultima proba se golesc:
    // altfel, dupa o reinnoire de certificat, cardul ar arata seria veche
    // langa data noua. Le repopuleaza proba din callback.
    update:
      mode.kind === "authorize"
        ? { ...data, obtainedAt: now, refreshedAt: null, certSerial: null, lastHealthOk: null }
        : { ...data, refreshedAt: now },
  });
}

export type TokenStatus = {
  configured: boolean;
  connected: boolean;
  accessExpiresAt: Date | null;
  refreshExpiresAt: Date | null;
  accessDaysLeft: number | null;
  refreshDaysLeft: number | null;
  certSerial: string | null;
  obtainedAt: Date | null;
  refreshedAt: Date | null;
  lastHealthOk: Date | null;
  lastError: string | null;
  /** Refresh tokenul e expirat/respins sau tokenurile nu se mai pot decripta. */
  needsReauth: boolean;
  /** "warn" = sub 30 zile pe refresh sau sub 14 pe access sau ultima eroare; "error" = mort. */
  level: "ok" | "warn" | "error" | "none";
};

export async function tokenStatus(configured: boolean): Promise<TokenStatus> {
  const row = await db.anafToken.findFirst();
  const now = Date.now();
  if (!row) {
    return {
      configured,
      connected: false,
      accessExpiresAt: null,
      refreshExpiresAt: null,
      accessDaysLeft: null,
      refreshDaysLeft: null,
      certSerial: null,
      obtainedAt: null,
      refreshedAt: null,
      lastHealthOk: null,
      lastError: null,
      needsReauth: false,
      level: "none",
    };
  }
  const accessDaysLeft = Math.floor((row.accessExpiresAt.getTime() - now) / DAY);
  const refreshDaysLeft = Math.floor((row.refreshExpiresAt.getTime() - now) / DAY);
  const needsReauth = row.needsReauth || refreshDaysLeft < 0;
  const level: TokenStatus["level"] = needsReauth
    ? "error"
    : row.refreshExpiresAt.getTime() - now < REAUTH_WARN_MS ||
        row.accessExpiresAt.getTime() - now < REFRESH_AHEAD_MS ||
        row.lastError
      ? "warn"
      : "ok";
  return {
    configured,
    connected: true,
    accessExpiresAt: row.accessExpiresAt,
    refreshExpiresAt: row.refreshExpiresAt,
    accessDaysLeft,
    refreshDaysLeft,
    certSerial: row.certSerial,
    obtainedAt: row.obtainedAt,
    refreshedAt: row.refreshedAt,
    lastHealthOk: row.lastHealthOk,
    lastError: row.lastError,
    needsReauth,
    level,
  };
}

type Decision =
  | { kind: "token"; token: string }
  | { kind: "expired" }
  | { kind: "refresh"; refreshEnc: string; accessEnc: string; accessExpiresAt: Date };

/**
 * Tokenul de acces curent, reimprospatat daca mai are sub 14 zile.
 *
 * In doua faze, ca apelul de retea sa NU stea intr-o tranzactie: un refresh
 * reusit la ANAF invalideaza tokenul vechi, iar daca tranzactia ar fi anulata
 * dupa (timeout, conexiune pierduta) am ramane cu perechea noua doar in
 * memorie si cu cea moarta in baza.
 *
 *   1. tranzactie scurta cu lock consultativ: citim, decidem, marcam
 *      `refreshingAt` — al doilea proces care vine in acelasi minut primeste
 *      accesul vechi (inca valid, refresham cu 14 zile inainte) si nu porneste
 *      un al doilea refresh;
 *   2. apelul la ANAF, fara tranzactie;
 *   3. salvarea perechii noi cu clientul radacina; la esec, `refreshingAt` se
 *      curata si eroarea ramane vizibila, iar accesul vechi merge mai departe
 *      daca mai e valid.
 */
export async function getAccessToken(
  opts: { forceRefresh?: boolean; allowRefresh?: boolean } = {},
): Promise<string> {
  const decision: Decision = await db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(735560801)`;
      const row = await tx.anafToken.findUnique({ where: { userId: await requireUserId() } });
      if (!row) throw new AnafAuthError(0, "Not connected to ANAF. Authorize with the certificate first.", true);
      if (row.needsReauth) throw new AnafAuthError(0, row.lastError ?? "Reauthorization required", true);

      const now = Date.now();
      const fresh = row.accessExpiresAt.getTime() - now > REFRESH_AHEAD_MS;
      const inflight = row.refreshingAt && now - row.refreshingAt.getTime() < REFRESH_INFLIGHT_MS;
      // Apelurile de proba (health) nu au voie sa porneasca un refresh: un
      // monitor extern omorat la mijloc nu trebuie sa poata consuma tokenul.
      const readOnly = opts.allowRefresh === false;
      if ((fresh && !opts.forceRefresh) || inflight || readOnly) {
        if (row.accessExpiresAt.getTime() <= now) {
          throw new AnafAuthError(
            0,
            readOnly
              ? "Access token expired; the next send or the daily cron will refresh it."
              : "Access token expired and a refresh is already in progress; retry shortly.",
          );
        }
        return { kind: "token", token: row.accessTokenEnc };
      }
      // Scrierea starii "expirat" se face DUPA tranzactie: o exceptie aruncata
      // aici ar anula si update-ul.
      if (row.refreshExpiresAt.getTime() <= now) return { kind: "expired" };
      await tx.anafToken.update({ where: { userId: await requireUserId() }, data: { refreshingAt: new Date(now) } });
      return {
        kind: "refresh",
        refreshEnc: row.refreshTokenEnc,
        accessEnc: row.accessTokenEnc,
        accessExpiresAt: row.accessExpiresAt,
      };
    },
    { timeout: 15_000 },
  );

  if (decision.kind === "token") return decryptOrReauth(decision.token);
  if (decision.kind === "expired") {
    await db.anafToken
      .update({
        where: { userId: await requireUserId() },
        data: { lastError: "Refresh token expired — reauthorize with the certificate.", needsReauth: true, refreshingAt: null },
      })
      .catch(() => {});
    throw new AnafAuthError(0, "Refresh token expired", true);
  }

  try {
    const tr = await refreshTokens(await decryptOrReauth(decision.refreshEnc));
    const now = new Date();
    await db.anafToken.update({
      where: { userId: await requireUserId() },
      data: {
        accessTokenEnc: encrypt(tr.access_token),
        refreshTokenEnc: tr.refresh_token ? encrypt(tr.refresh_token) : decision.refreshEnc,
        accessExpiresAt: accessExpiry(tr, now),
        ...(tr.refresh_token ? { refreshExpiresAt: new Date(now.getTime() + REFRESH_LIFETIME_MS) } : {}),
        refreshedAt: now,
        refreshingAt: null,
        lastError: null,
        needsReauth: false,
      },
    });
    return tr.access_token;
  } catch (err) {
    // Cheia schimbata: decryptOrReauth a scris deja mesajul clar; nu-l suprascriem.
    if (err instanceof AnafAuthError && err.needsReauth && err.body === REAUTH_MSG) throw err;
    const dead = err instanceof AnafAuthError && err.needsReauth;
    const msg = err instanceof Error ? err.message : String(err);
    await db.anafToken
      .update({
        where: { userId: await requireUserId() },
        data: {
          refreshingAt: null,
          lastError: dead ? `Reauthorization required: ${msg}` : msg,
          ...(dead ? { needsReauth: true } : {}),
        },
      })
      .catch(() => {});
    // Accesul vechi mai poate fi valid cateva zile; il dam mai departe ca sa
    // nu blocam o trimitere cu termen, dar eroarea ramane vizibila in Settings.
    if (!dead && decision.accessExpiresAt.getTime() > Date.now()) {
      return decryptOrReauth(decision.accessEnc);
    }
    throw err;
  }
}

/**
 * Apelul de proba din procedura ANAF: intoarce 200 si ecoul headerelor, intre
 * care `serial_certificate` — seria certificatului pe care s-a emis tokenul.
 */
export async function hello(accessToken: string): Promise<{
  ok: boolean;
  status: number;
  serial: string | null;
  body: string;
}> {
  const res = await fetch(`${HELLO}?name=health`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const body = await res.text();
  const fromHeader = res.headers.get("serial_certificate");
  const fromBody = body.match(/serial_certificate["']?\s*[:=]\s*["']?([^"',;\s<]+)/i)?.[1] ?? null;
  return { ok: res.ok, status: res.status, serial: fromHeader ?? fromBody, body: body.slice(0, 2000) };
}

export async function recordHealth(ok: boolean, serial: string | null, error?: string) {
  await db.anafToken
    .update({
      where: { userId: await requireUserId() },
      data: ok
        ? { lastHealthOk: new Date(), lastError: null, ...(serial ? { certSerial: serial } : {}) }
        : { lastError: (error ?? "health check failed").slice(0, 600) },
    })
    .catch(() => {});
}

export async function disconnect() {
  await db.anafToken.deleteMany({ where: { userId: await requireUserId() } });
}
