import "server-only";
import { anafEnv, type AnafEnv } from "./index";
import { AnafAuthError, getAccessToken } from "./oauth";

/*
 * Cele sase apeluri e-Factura, exact cum le descrie MF in "Prezentare servicii
 * web pentru Sistemul national privind factura electronica RO e-Factura":
 *
 *   POST {base}/upload?standard=UBL&cif=51711091[&extern=DA]
 *   GET  {base}/stareMesaj?id_incarcare=<index_incarcare>
 *   GET  {base}/descarcare?id=<id_descarcare>
 *   GET  {base}/listaMesajeFactura?zile=N&cif=51711091[&filtru=T|E|P|R]
 *   POST https://webservicesp.anaf.ro/prod/FCTEL/rest/validare/FACT1   (fara auth)
 *   POST https://webservicesp.anaf.ro/prod/FCTEL/rest/transformare/FACT1 (fara auth)
 *
 * unde {base} e https://api.anaf.ro/{test|prod}/FCTEL/rest — acelasi host,
 * acelasi token, difera doar segmentul de cale. TEST nu ajunge la nicio
 * contrapartida.
 *
 * Raspunsurile sunt un singur element <header .../> cu atribute; codul HTTP
 * e 200 si cand e eroare, deci se citeste ExecutionStatus / Errors, nu
 * statusul. Textele de eroare ANAF se potrivesc verbatim (inclusiv greselile
 * lor de tipar, ex. "inteorgare").
 */

const API = "https://api.anaf.ro";
export const PUBLIC_BASE = "https://webservicesp.anaf.ro/prod/FCTEL/rest";
const MSG_MAX = 600;

/**
 * Baza pentru mediul cerut. Implicit mediul procesului (ANAF_ENV), dar
 * urmarirea si arhivarea unui rand deja trimis merg pe mediul RANDULUI — un
 * rand de prod nu se intreaba pe test doar pentru ca ANAF_ENV s-a schimbat.
 */
export function apiBase(env: AnafEnv = anafEnv()): string {
  return `${API}/${env}/FCTEL/rest`;
}

export type AnafErrorKind =
  | "auth" // 401/403 — token mort sau fara drept; sau tokenul nu s-a putut obtine
  | "rights" // certificatul nu are drept in SPV pe CIF
  | "xml" // fisier invalid la parsare (SAX) sau la validare
  | "request" // parametri gresiti, id inexistent
  | "ratelimit" // 429 sau plafon zilnic
  | "server" // 5xx / "eroare tehnica" / raspuns neinteligibil
  | "network";

export class AnafApiError extends Error {
  kind: AnafErrorKind;
  status: number | undefined;
  messages: string[];
  /** Tokenul cere iar certificatul (refresh mort, cheie schimbata). */
  needsReauth: boolean;
  constructor(kind: AnafErrorKind, messages: string[], status?: number, needsReauth = false) {
    const msgs = messages.map((m) => m.slice(0, MSG_MAX));
    super(msgs[0] ?? kind);
    this.name = "AnafApiError";
    this.kind = kind;
    this.status = status;
    this.messages = msgs;
    this.needsReauth = needsReauth;
  }
  /**
   * ANAF a dat un verdict clar despre cerere. Fals pentru retea / 5xx /
   * raspuns neinteligibil, cand fisierul POATE fi ajuns totusi la ANAF.
   */
  get definitive(): boolean {
    return this.kind === "xml" || this.kind === "request" || this.kind === "rights" || this.kind === "auth" || this.kind === "ratelimit";
  }
}

function classify(msg: string): AnafErrorKind {
  const m = msg.toLowerCase();
  if (/nu aveti drept in spv|nu exista niciun cif pentru care sa aveti drept/.test(m)) return "rights";
  if (/saxparseexception|nu este valid|fisierul transmis/.test(m)) return "xml";
  if (/s-au facut deja|prea multe|limita/.test(m)) return "ratelimit";
  if (/eroare tehnica/.test(m)) return "server";
  return "request";
}

const unescapeXml = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

/** Atributele primului <header> si toate mesajele de eroare din document. */
export function parseHeader(xml: string): { attrs: Record<string, string>; errors: string[] } {
  const attrs: Record<string, string> = {};
  const head = xml.match(/<(?:\w+:)?header\b([^>]*)>/i);
  if (head) {
    for (const m of head[1].matchAll(/([\w:.-]+)\s*=\s*"([^"]*)"/g)) {
      attrs[m[1]] = unescapeXml(m[2]);
    }
  }
  const errors = [...xml.matchAll(/errorMessage\s*=\s*"([^"]*)"/gi)].map((m) =>
    unescapeXml(m[1]),
  );
  return { attrs, errors };
}

/*
 * Tokenul, tradus in aceeasi taxonomie de erori ca restul apelurilor: un
 * refresh mort trebuie sa apara ca "auth" + needsReauth in panou, nu ca un
 * 502 generic, si nu trebuie sa consume contoarele zilnice (nu a plecat nimic
 * spre ANAF).
 */
async function authed(): Promise<Record<string, string>> {
  try {
    return { Authorization: `Bearer ${await getAccessToken()}` };
  } catch (err) {
    if (err instanceof AnafAuthError) {
      throw new AnafApiError("auth", [err.message], err.status || undefined, err.needsReauth);
    }
    throw new AnafApiError("auth", [err instanceof Error ? err.message : "token unavailable"]);
  }
}

async function call(url: string, init: RequestInit = {}, attempt = 0): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
  } catch (err) {
    throw new AnafApiError("network", [err instanceof Error ? err.message : "fetch failed"]);
  }
  if (res.status === 401 || res.status === 403) {
    const t = (await res.text().catch(() => "")).slice(0, 300);
    throw new AnafApiError(
      "auth",
      [
        res.status === 401
          ? `ANAF: Unauthorized (token invalid or expired). ${t}`.trim()
          : `ANAF: request neautorizat. ${t}`.trim(),
      ],
      res.status,
    );
  }
  if (res.status === 429) {
    // Doua reincercari scurte; peste asta e treaba operatorului.
    if (attempt < 2) {
      const retryAfter = Number(res.headers.get("retry-after")) || 0;
      const wait = Math.min((retryAfter || 2 * (attempt + 1)) * 1000, 8_000);
      await new Promise((r) => setTimeout(r, wait));
      return call(url, init, attempt + 1);
    }
    throw new AnafApiError("ratelimit", ["ANAF: prea multe cereri (429). Reincearca mai tarziu."], 429);
  }
  if (res.status >= 500) {
    const t = await res.text().catch(() => "");
    throw new AnafApiError("server", [`ANAF ${res.status}: ${t.slice(0, 300)}`], res.status);
  }
  return res;
}

async function requestError(res: Response): Promise<never> {
  const t = await res.text().catch(() => "");
  let msg = t;
  try {
    const j = JSON.parse(t);
    msg = j.message ?? j.eroare ?? j.error ?? t;
  } catch {
    /* text */
  }
  throw new AnafApiError("request", [`ANAF ${res.status}: ${String(msg).slice(0, 500)}`], res.status);
}

async function jsonOrThrow<T>(res: Response, what: string): Promise<T> {
  const text = await res.text().catch(() => "");
  try {
    return JSON.parse(text) as T;
  } catch {
    // 200 cu HTML de mentenanta / WAF: nu e un verdict, e o indisponibilitate.
    throw new AnafApiError("server", [`ANAF ${what}: raspuns neasteptat (nu e JSON): ${text.slice(0, 200)}`], res.status);
  }
}

/* ------------------------------------------------------------------ upload */

export async function upload(
  xml: string,
  o: { cif: string; standard?: "UBL" | "CN"; extern?: boolean; env?: AnafEnv },
): Promise<{ indexIncarcare: string; dateResponse: string | null; raw: string }> {
  // ANAF vrea CIF-ul numeric, fara "RO": altfel "CIF introdus= RO... nu este un numar".
  if (!/^\d+$/.test(o.cif)) {
    throw new AnafApiError("request", [`cif must be digits only, got "${o.cif}"`]);
  }
  const u = new URL(`${apiBase(o.env)}/upload`);
  u.searchParams.set("standard", o.standard ?? "UBL");
  u.searchParams.set("cif", o.cif);
  if (o.extern) u.searchParams.set("extern", "DA"); // singura valoare acceptata

  const res = await call(u.toString(), {
    method: "POST",
    headers: { ...(await authed()), "Content-Type": "application/xml" },
    body: xml,
  });
  if (!res.ok) return requestError(res);

  const raw = await res.text();
  const { attrs, errors } = parseHeader(raw);
  if (attrs.ExecutionStatus === "0" && attrs.index_incarcare) {
    return { indexIncarcare: attrs.index_incarcare, dateResponse: attrs.dateResponse ?? null, raw };
  }
  if (!errors.length) {
    // Nici succes, nici eroare lizibila: nu stim ce a facut ANAF cu fisierul.
    throw new AnafApiError("server", [`Unexpected upload response: ${raw.slice(0, 300)}`], 200);
  }
  throw new AnafApiError(classify(errors[0]), errors, 200);
}

/* -------------------------------------------------------------- stareMesaj */

export type Stare = "ok" | "nok" | "in prelucrare" | "XML cu erori nepreluat de sistem";

export async function stareMesaj(
  indexIncarcare: string,
  env?: AnafEnv,
): Promise<{ stare: Stare | string; idDescarcare: string | null; raw: string }> {
  const u = new URL(`${apiBase(env)}/stareMesaj`);
  u.searchParams.set("id_incarcare", indexIncarcare);
  const res = await call(u.toString(), { headers: await authed() });
  if (!res.ok) return requestError(res);
  const raw = await res.text();
  const { attrs, errors } = parseHeader(raw);
  if (errors.length) throw new AnafApiError(classify(errors[0]), errors, 200);
  if (!attrs.stare) throw new AnafApiError("server", [`No stare in response: ${raw.slice(0, 300)}`], 200);
  return { stare: attrs.stare, idDescarcare: attrs.id_descarcare ?? null, raw };
}

/* -------------------------------------------------------------- descarcare */

export async function descarcare(idDescarcare: string, env?: AnafEnv): Promise<Uint8Array> {
  const u = new URL(`${apiBase(env)}/descarcare`);
  u.searchParams.set("id", idDescarcare); // NICIODATA index_incarcare aici
  const res = await call(u.toString(), { headers: await authed() });
  if (!res.ok) return requestError(res);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const ct = res.headers.get("content-type") ?? "";
  const isZip = bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (isZip || /zip|octet-stream/i.test(ct)) {
    if (!isZip) throw new AnafApiError("server", ["Response claimed to be a zip but is not"]);
    return bytes;
  }
  // HTTP 200 cu JSON: {"eroare":"...","titlu":"Descarcare mesaj"}
  const text = new TextDecoder().decode(bytes);
  let msg = text;
  try {
    msg = JSON.parse(text).eroare ?? text;
  } catch {
    /* text */
  }
  throw new AnafApiError(classify(msg), [msg], 200);
}

/* ------------------------------------------------------- listaMesajeFactura */

export type AnafMessage = {
  data_creare: string; // yyyyMMddHHmm
  cif: string;
  id_solicitare: string; // == index_incarcare
  detalii: string;
  tip: string; // FACTURA TRIMISA | ERORI FACTURA | FACTURA PRIMITA | MESAJ CUMPARATOR ...
  id: string; // == id_descarcare
};

export async function listaMesaje(o: {
  zile: number;
  cif: string;
  filtru?: "T" | "E" | "P" | "R";
  env?: AnafEnv;
}): Promise<AnafMessage[]> {
  const u = new URL(`${apiBase(o.env)}/listaMesajeFactura`);
  u.searchParams.set("zile", String(Math.min(60, Math.max(1, Math.floor(o.zile)))));
  u.searchParams.set("cif", o.cif);
  if (o.filtru) u.searchParams.set("filtru", o.filtru);
  const res = await call(u.toString(), { headers: await authed() });
  if (!res.ok) return requestError(res);
  const j = await jsonOrThrow<{ mesaje?: AnafMessage[]; eroare?: string }>(res, "listaMesaje");
  if (j.eroare) {
    if (/nu exista mesaje/i.test(j.eroare)) return [];
    throw new AnafApiError(classify(j.eroare), [j.eroare], 200);
  }
  if (!Array.isArray(j.mesaje)) {
    throw new AnafApiError("server", ["ANAF listaMesaje: raspuns fara `mesaje`"], 200);
  }
  return j.mesaje;
}

/** "202609011415" → Date (ora ANAF e ora Romaniei; toleranta o dau apelantii). */
export function parseAnafStamp(s: string): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(s ?? "");
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
}

/* ------------------------------------------------- validare / transformare */

/**
 * Validare fara transmitere, pe hostul public (fara token). Nu are efecte:
 * nu creeaza nimic la ANAF. Mesajele Schematron ("[BR-RO-110]-...") sunt
 * instructiunile de reparat. Arunca (server/ratelimit) cand validatorul nu a
 * dat un verdict — apelantul decide daca trece mai departe fara el.
 */
export async function validare(
  xml: string,
  kind: "FACT1" | "FCN" = "FACT1",
): Promise<{ ok: boolean; messages: string[]; traceId: string | null }> {
  const res = await call(`${PUBLIC_BASE}/validare/${kind}`, {
    method: "POST",
    headers: { "Content-Type": "text/plain" }, // cerut explicit de documentatia MF
    body: xml,
  });
  if (!res.ok) return requestError(res);
  const j = await jsonOrThrow<{
    stare?: string;
    Messages?: Array<{ message: string }>;
    trace_id?: string;
    eroare?: string;
  }>(res, "validator");
  if (typeof j.stare !== "string") {
    const msg = j.eroare ?? "ANAF validator: raspuns fara verdict";
    throw new AnafApiError(classify(msg) === "ratelimit" ? "ratelimit" : "server", [msg], 200);
  }
  return {
    ok: j.stare === "ok",
    messages: (j.Messages ?? []).map((m) => m.message),
    traceId: j.trace_id ?? null,
  };
}

/** PDF-ul ANAF pentru un XML — util ca sa vezi factura asa cum o vede SPV. */
export async function xmlToPdf(xml: string, kind: "FACT1" | "FCN" = "FACT1"): Promise<Uint8Array> {
  const res = await call(`${PUBLIC_BASE}/transformare/${kind}`, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: xml,
  });
  if (!res.ok) return requestError(res);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (!(bytes[0] === 0x25 && bytes[1] === 0x50)) {
    // nu e %PDF — e JSON cu erori de validare
    const text = new TextDecoder().decode(bytes);
    throw new AnafApiError("xml", [text.slice(0, 1000)], 200);
  }
  return bytes;
}
