import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { photosConfigured } from "@/lib/s3";
import { anafConfigured, anafEnv, type AnafEnv } from "./index";
import { buildForInvoice } from "./build";
import { tokenStatus } from "./oauth";
import {
  AnafApiError,
  descarcare,
  listaMesaje,
  stareMesaj,
  upload,
  validare,
  type AnafMessage,
} from "./client";
import {
  archiveZip,
  parseAnafZip,
  parseErrorReport,
  promoteInlineZip,
  sha256,
  type AnafZip,
} from "./archive";
import {
  bucharestDate,
  DELETE_BLOCKING_STATES,
  efacturaScope,
  LOCKED_STATES,
  policyAllows,
} from "./scope";

/*
 * Orchestrarea unei transmiteri, cu tot ce fac Oblio si SmartBill in spate:
 *
 *   1. politica: e in scop legal? a cerut utilizatorul explicit?
 *   2. blocaje locale (judet lipsa, EIN sub schema VAT) — inainte de orice apel
 *   3. idempotenta: randul de trimitere se creeaza si devine "curent" INTR-O
 *      tranzactie, inainte de upload. Un timeout Vercel, un dublu click sau
 *      un cron dublu nu pot produce a doua factura la ANAF. Un rand blocat
 *      din ISTORIC (nu doar pointerul curent) conteaza la fel — altfel un
 *      dus-intors test→prod ar retrimite.
 *   4. validare pe hostul public (fara efecte) — mesajele Schematron sunt
 *      instructiunile de reparat
 *   5. upload → index_incarcare. Cand raspunsul NU vine (retea, 5xx) fisierul
 *      POATE fi ajuns la ANAF: randul ramane "uploading" si se impaca cu lista
 *      de mesaje ANAF pe continut (sha256), nu se elibereaza pentru retrimitere.
 *   6. cateva sondaje stareMesaj inline (3s, 7s, 12s); pe ok/nok descarcare
 *      si arhivare imediata (ANAF tine ZIP-ul doar 60 de zile)
 *
 * Mediul (test/prod) e al RANDULUI, nu al procesului: un rand de prod se
 * urmareste si se arhiveaza pe prod si cand ANAF_ENV e pe test.
 *
 * Contoarele zilnice sunt sub plafoanele oficiale (100 stareMesaj si 10
 * descarcari pe mesaj pe zi): 20 si 5.
 */

const MAX_STATE_CHECKS_PER_DAY = 20;
const MAX_DOWNLOADS_PER_DAY = 5;
const INLINE_POLL_MS = [3_000, 7_000, 12_000];
/** Un rand "uploading" fara index mai vechi de atat e candidat la impacare. */
export const STUCK_AFTER_MS = 5 * 60_000;
/** Fara nicio urma la ANAF dupa atat, upload-ul e considerat neajuns. */
const RELEASE_AFTER_MS = 12 * 60 * 60_000;
const DAY_MS = 86_400_000;
const MSG_MAX = 600;

export type SendOutcome =
  | { ok: true; submission: SubmissionView; already?: boolean }
  | { ok: false; status: number; error: string; code: string; details?: string[]; submission?: SubmissionView };

export type SubmissionView = {
  id: string;
  env: string;
  state: string;
  stareRaw: string | null;
  extern: boolean;
  indexIncarcare: string | null;
  idDescarcare: string | null;
  createdAt: string;
  uploadedAt: string | null;
  stateCheckedAt: string | null;
  signedAt: string | null;
  errors: string[];
  archived: boolean;
};

type SubmissionRow = Prisma.EfacturaSubmissionGetPayload<object>;

export function viewOf(s: SubmissionRow): SubmissionView {
  return {
    id: s.id,
    env: s.env,
    state: s.state,
    stareRaw: s.stareRaw,
    extern: s.extern,
    indexIncarcare: s.indexIncarcare,
    idDescarcare: s.idDescarcare,
    createdAt: s.createdAt.toISOString(),
    uploadedAt: s.uploadedAt?.toISOString() ?? null,
    stateCheckedAt: s.stateCheckedAt?.toISOString() ?? null,
    signedAt: s.signedAt?.toISOString() ?? null,
    errors: Array.isArray(s.errors) ? (s.errors as string[]) : [],
    archived: Boolean(s.zipS3Key || s.zipInline),
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const today = () => bucharestDate(new Date()).key;
const clip = (xs: string[]) => xs.map((m) => m.slice(0, MSG_MAX));
const errMsg = (err: unknown, fallback: string) =>
  err instanceof AnafApiError ? err.messages : [err instanceof Error ? err.message : fallback];
const envOf = (s: { env: string }): AnafEnv => (s.env === "prod" ? "prod" : "test");

/** Factura era draft si a ajuns la ANAF: transmiterea E emiterea. Idempotent. */
async function promoteDraft(invoiceId: string) {
  await db.invoice.updateMany({ where: { id: invoiceId, status: "draft" }, data: { status: "issued" } });
}

/** Exista o depunere pe prod sub numarul asta: factura nu se sterge, se anuleaza. */
export async function deletionBlocked(invoiceId: string): Promise<boolean> {
  const n = await db.efacturaSubmission.count({
    where: { invoiceId, env: "prod", state: { in: [...DELETE_BLOCKING_STATES] } },
  });
  return n > 0;
}

export async function sendInvoice(
  invoiceId: string,
  opts: { force?: boolean } = {},
): Promise<SendOutcome> {
  if (!anafConfigured()) {
    return { ok: false, status: 422, code: "not_configured", error: "ANAF e-Factura is not configured (ANAF_CLIENT_ID / SECRET / REDIRECT_URI / TOKEN_ENC_KEY)." };
  }
  const tok = await tokenStatus(true);
  if (!tok.connected) {
    return { ok: false, status: 401, code: "not_connected", error: "Not connected to ANAF. Connect with the certificate in Settings → ANAF e-Factura." };
  }
  if (tok.needsReauth) {
    return { ok: false, status: 401, code: "reauth", error: tok.lastError ?? "ANAF token needs re-authorization with the certificate (Settings → ANAF e-Factura)." };
  }

  const built = await buildForInvoice(invoiceId);
  if (!built) return { ok: false, status: 404, code: "not_found", error: "Invoice not found" };
  const { invoice, settings, doc } = built;

  // Un draft se poate trimite: transmiterea la ANAF ESTE emiterea, asa ca la
  // upload reusit statusul trece singur pe "issued". Void nu se trimite.
  if (invoice.status === "void") {
    return { ok: false, status: 409, code: "status", error: "Invoice is void; it cannot be sent." };
  }

  // 1. politica
  const { scope, reason } = efacturaScope(invoice);
  const policy = opts.force ? "send" : invoice.efacturaPolicy;
  if (!policyAllows(policy, scope)) {
    return {
      ok: false,
      status: 409,
      code: scope === "optional" ? "out_of_scope" : "policy_skip",
      error:
        scope === "optional"
          ? `${reason}. Use "Send anyway" to file it with extern=DA.`
          : "This invoice is set to never be sent to e-Factura.",
    };
  }
  if (opts.force && invoice.efacturaPolicy !== "send") {
    await db.invoice.update({ where: { id: invoice.id }, data: { efacturaPolicy: "send" } });
  }

  // 2. blocaje locale
  if (doc.blockers.length) {
    return { ok: false, status: 422, code: "blockers", error: "The invoice cannot pass ANAF validation as it is.", details: doc.blockers };
  }

  // 3. idempotenta — pe istoric, nu doar pe pointerul curent.
  const env = anafEnv();
  const lockedRow = await db.efacturaSubmission.findFirst({
    where: { invoiceId: invoice.id, env, state: { in: [...LOCKED_STATES] } },
    orderBy: { createdAt: "desc" },
  });
  if (lockedRow) {
    if (invoice.efacturaCurrentId !== lockedRow.id) {
      await db.invoice.update({ where: { id: invoice.id }, data: { efacturaCurrentId: lockedRow.id } });
    }
    return { ok: true, already: true, submission: viewOf(lockedRow) };
  }
  if (env !== "prod") {
    // O depunere reala nu se ascunde in spatele unei probe pe test.
    const prodLock = await db.efacturaSubmission.findFirst({
      where: { invoiceId: invoice.id, env: "prod", state: { in: [...LOCKED_STATES] } },
    });
    if (prodLock) {
      return { ok: false, status: 409, code: "prod_filed", error: "Already filed with ANAF in PROD; a TEST send would hide the legal filing.", submission: viewOf(prodLock) };
    }
  }

  const created = await db.$transaction(async (tx) => {
    const sub = await tx.efacturaSubmission.create({
      data: {
        invoiceId: invoice.id,
        env,
        standard: "UBL",
        extern: doc.extern,
        xmlSent: doc.xml,
        xmlSha256: sha256(doc.xml),
        state: "uploading",
      },
    });
    // Devine "curent" doar daca nimeni n-a schimbat pointerul intre timp.
    const r = await tx.invoice.updateMany({
      where: { id: invoice.id, efacturaCurrentId: invoice.efacturaCurrentId },
      data: { efacturaCurrentId: sub.id },
    });
    if (r.count !== 1) {
      await tx.efacturaSubmission.delete({ where: { id: sub.id } });
      return null;
    }
    return sub;
  });
  if (!created) {
    const fresh = await db.invoice.findUnique({ where: { id: invoice.id }, include: { efacturaCurrent: true } });
    return fresh?.efacturaCurrent
      ? { ok: true, already: true, submission: viewOf(fresh.efacturaCurrent) }
      : { ok: false, status: 409, code: "race", error: "Another send is in progress. Refresh." };
  }

  const fail = async (state: string, errors: string[], status: number, code: string) => {
    const s = await db.efacturaSubmission.update({
      where: { id: created.id },
      data: { state, errors: clip(errors), stateCheckedAt: new Date() },
    });
    return { ok: false as const, status, code, error: errors[0] ?? state, details: errors, submission: viewOf(s) };
  };

  /*
   * 4. validare fara efecte, pe hostul public (PROD, indiferent de env).
   *
   * Validatorul public ruleaza si pasul de identificare a cumparatorului dupa
   * CUI romanesc. Pentru un client strain intoarce mereu
   * "codEroare=ERRIdentif; textEroare=nu a fost identificat cui cumparator"
   * (verificat cu BLNG/US si AETHRA/PT) — exact situatia pe care o rezolva
   * extern=DA la upload. Pe documentele externe ignoram deci ERRIdentif si
   * blocam doar pe restul (Schematron). Pentru clientii RO, un CUI
   * neidentificat E un blocaj real.
   *
   * Singurul verdict care blocheaza e stare=nok. Orice indisponibilitate
   * (retea, 5xx, 429 pe IP-ul Vercel, 403 de la WAF, HTML in loc de JSON)
   * lasa factura sa plece: ANAF o valideaza oricum la upload.
   */
  try {
    const v = await validare(doc.xml, "FACT1");
    const relevant = doc.extern ? v.messages.filter((m) => !/codEroare=ERRIdentif/i.test(m)) : v.messages;
    if (!v.ok && (relevant.length > 0 || !doc.extern)) {
      return fail("upload_rejected", relevant.length ? relevant : ["ANAF validator returned nok"], 422, "validation");
    }
  } catch (err) {
    if (!(err instanceof AnafApiError)) {
      return fail("upload_rejected", [err instanceof Error ? err.message : "validation failed"], 502, "validation_error");
    }
    console.warn("[efactura] public validator unavailable, skipping pre-validation:", err.kind, err.message);
  }

  // 5. upload
  let indexIncarcare: string;
  try {
    const cif = settings.issuerCif.replace(/^RO/i, "");
    const up = await upload(doc.xml, { cif, standard: "UBL", extern: doc.extern, env });
    indexIncarcare = up.indexIncarcare;
  } catch (err) {
    if (err instanceof AnafApiError && err.definitive) {
      const status = err.kind === "auth" ? 401 : err.kind === "ratelimit" ? 429 : err.kind === "xml" ? 422 : 502;
      return fail("upload_rejected", err.messages, status, err.kind);
    }
    // Retea / 5xx / raspuns neinteligibil: ANAF POATE fi primit fisierul.
    // Randul ramane blocat in "uploading"; `reconcileStuck` il impaca pe
    // continut cu lista ANAF (din ruta de status sau din cron).
    const msgs = errMsg(err, "upload failed");
    const note = "Outcome unknown — will be reconciled with ANAF automatically. Do not re-send.";
    const s = await db.efacturaSubmission.update({
      where: { id: created.id },
      data: { errors: clip([...msgs, note]), stateCheckedAt: new Date() },
    });
    return { ok: false, status: 502, code: "upload_unknown", error: msgs[0], details: [...msgs, note], submission: viewOf(s) };
  }

  // Indexul si emiterea, impreuna: o factura ajunsa la ANAF nu ramane draft.
  const [sub0] = await db.$transaction([
    db.efacturaSubmission.update({
      where: { id: created.id },
      data: { indexIncarcare, uploadedAt: new Date(), state: "in_prelucrare", errors: [] },
    }),
    db.invoice.updateMany({ where: { id: invoice.id, status: "draft" }, data: { status: "issued" } }),
  ]);
  let sub = sub0;

  // 6. sondaje inline
  for (const ms of INLINE_POLL_MS) {
    await sleep(ms);
    sub = await checkSubmission(sub);
    if (sub.state !== "in_prelucrare") break;
  }
  return { ok: true, submission: viewOf(sub) };
}

const mapStare = (stare: string) =>
  stare === "ok" ? "ok" : stare === "nok" ? "nok" : /nepreluat/i.test(stare) ? "xml_nepreluat" : "in_prelucrare";

const needsArchive = (s: SubmissionRow) =>
  (s.state === "ok" || s.state === "nok" || s.state === "xml_nepreluat" || s.state === "download_failed") &&
  !s.zipS3Key &&
  !s.zipInline &&
  Boolean(s.idDescarcare);

/**
 * Un pas de urmarire: stareMesaj (in limita zilnica) si, pe stare finala,
 * descarcare + arhivare. Idempotent; il apeleaza si ruta de status, si cronul.
 * Un rand "uploading" fara index nu se atinge aici — vezi `reconcileStuck`.
 */
export async function checkSubmission(sub: SubmissionRow): Promise<SubmissionRow> {
  if (!sub.indexIncarcare) return sub;
  const env = envOf(sub);
  if (sub.state === "in_prelucrare" || sub.state === "uploading") {
    const day = today();
    const n = sub.stateChecksDay === day ? sub.stateChecksN : 0;
    if (n >= MAX_STATE_CHECKS_PER_DAY) return sub;
    let stare: string;
    let idDescarcare: string | null;
    try {
      const r = await stareMesaj(sub.indexIncarcare, env);
      stare = r.stare;
      idDescarcare = r.idDescarcare;
    } catch (err) {
      // Un token mort nu a trimis nimic la ANAF: nu consuma contorul zilnic.
      const counted = !(err instanceof AnafApiError && err.kind === "auth");
      return db.efacturaSubmission.update({
        where: { id: sub.id },
        data: {
          ...(counted ? { stateChecksDay: day, stateChecksN: n + 1 } : {}),
          stateCheckedAt: new Date(),
          errors: clip(errMsg(err, "stareMesaj failed")),
        },
      });
    }
    const state = mapStare(stare);
    sub = await db.efacturaSubmission.update({
      where: { id: sub.id },
      data: {
        stareRaw: stare,
        state,
        idDescarcare: idDescarcare ?? sub.idDescarcare,
        stateChecksDay: day,
        stateChecksN: n + 1,
        stateCheckedAt: new Date(),
        ...(state === "in_prelucrare" ? {} : { errors: [] }),
      },
    });
    if (state === "in_prelucrare" || state === "ok") await promoteDraft(sub.invoiceId);
  }
  if (needsArchive(sub)) sub = await downloadAndArchive(sub);
  return sub;
}

/**
 * Descarca ZIP-ul (sau il primeste gata descarcat, la impacare) si il arhiveaza.
 *
 * Contorul de descarcari se scrie INAINTE de apel: o functie omorata la
 * mijloc tot a consumat una din cele 10 pe zi ale ANAF.
 *
 * Pe `ok`, XML-ul din arhiva trebuie sa fie chiar factura asta: acelasi
 * continut (sha256) sau acelasi cbc:ID. Altfel — un id_descarcare gresit — nu
 * se arhiveaza nimic sub numele ei.
 */
async function downloadAndArchive(
  sub: SubmissionRow,
  prefetched?: { zip: Uint8Array; parsed: AnafZip },
): Promise<SubmissionRow> {
  const idDescarcare = sub.idDescarcare;
  if (!idDescarcare) return sub;
  const env = envOf(sub);
  const day = today();
  const n = sub.downloadsDay === day ? sub.downloadsN : 0;
  if (!prefetched) {
    if (n >= MAX_DOWNLOADS_PER_DAY) return sub;
    sub = await db.efacturaSubmission.update({
      where: { id: sub.id },
      data: { downloadsDay: day, downloadsN: n + 1 },
    });
  }
  const inv = await db.invoice.findUnique({ where: { id: sub.invoiceId }, select: { series: true, number: true } });
  const wasNok = sub.state === "nok" || sub.state === "xml_nepreluat" || sub.stareRaw === "nok" || /nepreluat/i.test(sub.stareRaw ?? "");
  const finalState = sub.state === "xml_nepreluat" ? "xml_nepreluat" : wasNok ? "nok" : "ok";
  try {
    const zip = prefetched?.zip ?? (await descarcare(idDescarcare, env));
    const parsed = prefetched?.parsed ?? parseAnafZip(zip);
    if (!wasNok) {
      const expectedId = `${inv?.series ?? ""}${inv?.number ?? ""}`;
      const gotId = parsed.docXml?.match(/<cbc:ID>([^<]*)<\/cbc:ID>/)?.[1]?.trim();
      const sameBytes = parsed.docXml != null && sha256(parsed.docXml) === sub.xmlSha256;
      if (!sameBytes && gotId !== expectedId) {
        return db.efacturaSubmission.update({
          where: { id: sub.id },
          data: {
            state: "download_failed",
            errors: [`Archive mismatch: ANAF returned an XML with ID "${gotId ?? "?"}", expected "${expectedId}". Not archived.`],
          },
        });
      }
    }
    const keys = await archiveZip({
      env: sub.env,
      series: inv?.series ?? "X",
      number: inv?.number ?? sub.id,
      indexIncarcare: sub.indexIncarcare ?? sub.id,
      zip,
      parsed,
    });
    const errors = wasNok ? parseErrorReport(parsed.docXml) : [];
    return db.efacturaSubmission.update({
      where: { id: sub.id },
      data: { ...keys, signedAt: new Date(), state: finalState, errors: clip(errors) },
    });
  } catch (err) {
    return db.efacturaSubmission.update({
      where: { id: sub.id },
      data: {
        state: wasNok ? finalState : "download_failed",
        errors: clip(errMsg(err, "download failed")),
      },
    });
  }
}

/* ---------------------------------------------------------------- impacare */

/**
 * "202609021415" (ora Bucuresti, cum o scrie ANAF) → instantul UTC, cu
 * decalajul real al zonei la acel moment (UTC+2 iarna, UTC+3 vara). Un
 * decalaj fix ar fi scos mesajul din fereastra jumatate de an.
 */
function parseDataCreare(s: string): Date | null {
  const m = s?.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Bucharest",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(guess));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const wall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"));
  const offset = wall - guess; // cat e zona inaintea UTC la acel moment
  return new Date(guess - offset);
}

async function fetchAnafList(issuerCif: string, zile: number, env: AnafEnv): Promise<AnafMessage[] | null> {
  try {
    return await listaMesaje({ zile, cif: issuerCif.replace(/^RO/i, ""), filtru: "T", env });
  } catch {
    return null;
  }
}

/** Cate zile inapoi trebuie ceruta lista ca sa acopere un rand creat atunci. */
export function lookbackDays(createdAt: Date): number {
  return Math.min(60, Math.ceil((Date.now() - createdAt.getTime()) / DAY_MS) + 1);
}

/**
 * Impaca un rand ramas in "uploading" fara index (functia a murit intre
 * upload si salvarea raspunsului, sau raspunsul n-a venit) cu lista de mesaje
 * ANAF.
 *
 * `detalii` din lista NU contine numarul facturii (doar id_incarcare si cele
 * doua CIF-uri), asa ca potrivirea se face pe CONTINUT: candidatii sunt
 * mesajele FACTURA TRIMISA cu id_solicitare necunoscut in baza si create
 * dupa upload (fara limita superioara — ANAF le genereaza dupa procesare,
 * care in zilele proaste dureaza ore); fiecare se descarca si se compara
 * sha256(XML) cu ce am trimis (sau cbc:ID cu numarul facturii).
 *
 * ERORI FACTURA nu poate fi potrivit pe continut (ZIP-ul are raportul, nu
 * factura): se adopta prin fereastra doar cand e singurul mesaj necunoscut
 * si singurul rand blocat din mediu. Altfel nu blocheaza eliberarea — o
 * factura respinsa se retrimite corectata, cu acelasi numar.
 *
 * Fara lista (ANAF picat) nu se atinge nimic. Fara nicio potrivire, randul se
 * elibereaza doar daca a trecut RELEASE_AFTER_MS, lista acopera momentul
 * upload-ului si nu exista NICIUN mesaj TRIMIS necunoscut de dupa upload —
 * altfel ramane blocat si semnalat.
 */
export async function reconcileStuck(
  sub: SubmissionRow,
  issuerCif: string,
  ctx: { list?: AnafMessage[] | null; zile?: number; stuckCount?: number } = {},
): Promise<{ sub: SubmissionRow; note: string | null }> {
  if (sub.state !== "uploading" || sub.indexIncarcare) return { sub, note: null };
  if (Date.now() - sub.createdAt.getTime() < STUCK_AFTER_MS) return { sub, note: null };
  const env = envOf(sub);
  const inv = await db.invoice.findUnique({ where: { id: sub.invoiceId }, select: { series: true, number: true } });
  const num = `${inv?.series ?? ""}${inv?.number ?? ""}`;

  const zile = ctx.zile ?? lookbackDays(sub.createdAt);
  const listSince = Date.now() - zile * DAY_MS;
  const msgs = ctx.list !== undefined ? ctx.list : await fetchAnafList(issuerCif, zile, env);
  if (!msgs) return { sub, note: `${num}: ANAF message list unavailable; left as uploading.` };

  const known = new Set(
    (
      await db.efacturaSubmission.findMany({
        where: { env: sub.env, indexIncarcare: { not: null } },
        select: { indexIncarcare: true },
      })
    ).map((r) => r.indexIncarcare!),
  );
  const from = sub.createdAt.getTime() - 2 * 60_000;
  const unknown = msgs.filter((m) => {
    if (known.has(m.id_solicitare)) return false;
    const t = parseDataCreare(m.data_creare)?.getTime();
    return t == null || t >= from;
  });
  const sent = unknown.filter((m) => /^FACTURA TRIMISA$/i.test(m.tip ?? ""));
  const errs = unknown.filter((m) => /^ERORI FACTURA$/i.test(m.tip ?? ""));

  const adopt = async (m: AnafMessage, isErr: boolean, fetched: { zip: Uint8Array; parsed: AnafZip } | null, how: string) => {
    let adopted: SubmissionRow;
    try {
      adopted = await db.efacturaSubmission.update({
        where: { id: sub.id },
        data: {
          indexIncarcare: m.id_solicitare,
          idDescarcare: m.id,
          state: isErr ? "nok" : "ok",
          stareRaw: isErr ? "nok" : "ok",
          uploadedAt: parseDataCreare(m.data_creare) ?? sub.createdAt,
          errors: [],
        },
      });
    } catch {
      // P2002: indexul a fost adoptat intre timp de alt rand. Nu e al nostru.
      return null;
    }
    await promoteDraft(sub.invoiceId);
    const archived = await downloadAndArchive(adopted, fetched ?? undefined);
    return { sub: archived, note: `${num}: reconciled with ANAF index ${m.id_solicitare} (${m.tip}, ${how}).` };
  };

  for (const m of sent) {
    let fetched: { zip: Uint8Array; parsed: AnafZip };
    try {
      const zip = await descarcare(m.id, env);
      fetched = { zip, parsed: parseAnafZip(zip) };
    } catch {
      continue;
    }
    const gotId = fetched.parsed.docXml?.match(/<cbc:ID>([^<]*)<\/cbc:ID>/)?.[1]?.trim();
    const match =
      (fetched.parsed.docXml != null && sha256(fetched.parsed.docXml) === sub.xmlSha256) || (gotId != null && gotId === num);
    if (!match) continue;
    const r = await adopt(m, false, fetched, "matched by content");
    if (r) return r;
  }

  if (errs.length === 1 && (ctx.stuckCount ?? 1) === 1) {
    let fetched: { zip: Uint8Array; parsed: AnafZip } | null = null;
    try {
      const zip = await descarcare(errs[0].id, env);
      fetched = { zip, parsed: parseAnafZip(zip) };
    } catch {
      /* raportul se descarca mai tarziu, din checkSubmission */
    }
    const r = await adopt(errs[0], true, fetched, "only rejected upload in the window");
    if (r) return r;
  }

  const age = Date.now() - sub.createdAt.getTime();
  if (sub.createdAt.getTime() < listSince) {
    return { sub, note: `${num}: stuck upload is older than the ANAF message window (${zile} days); resolve manually in SPV.` };
  }
  if (sent.length === 0 && age > RELEASE_AFTER_MS) {
    const released = await db.efacturaSubmission.update({
      where: { id: sub.id },
      data: { state: "upload_rejected", errors: ["No trace of this upload at ANAF after 12 hours. Safe to send again."] },
    });
    return { sub: released, note: `${num}: no trace at ANAF; released for re-send.` };
  }
  return {
    sub,
    note:
      sent.length > 0
        ? `${num}: ${sent.length} unmatched upload(s) at ANAF after this one — check SPV before re-sending.`
        : null,
  };
}

/** Starea curenta a unei facturi, cu un pas de urmarire daca e pe drum. */
export async function refreshInvoiceSubmission(invoiceId: string, issuerCif: string): Promise<SubmissionView | null> {
  const inv = await db.invoice.findUnique({ where: { id: invoiceId }, include: { efacturaCurrent: true } });
  if (!inv?.efacturaCurrent) return null;
  let sub = inv.efacturaCurrent;
  if (sub.state === "uploading" && !sub.indexIncarcare) sub = (await reconcileStuck(sub, issuerCif)).sub;
  else sub = await checkSubmission(sub);
  return viewOf(sub);
}

/**
 * Maturatorul cronului: urmareste ce e pe drum, arhiveaza ce lipseste, impaca
 * randurile ramase in "uploading" si muta in S3 arhivele ramase inline —
 * pe TOATE mediile (un rand de prod nu asteapta dupa ANAF_ENV). Se opreste
 * la `stopAt`, ca alertele si emailul de dupa el sa apuce sa ruleze.
 */
export async function sweepSubmissions(
  issuerCif: string,
  opts: { stopAt?: number } = {},
): Promise<{
  checked: number;
  archived: number;
  reconciled: number;
  promoted: number;
  truncated: boolean;
  notes: string[];
}> {
  const stopAt = opts.stopAt ?? Date.now() + 150_000;
  const over = () => Date.now() > stopAt;
  const notes: string[] = [];
  let truncated = false;

  const pending = await db.efacturaSubmission.findMany({
    where: {
      OR: [
        { state: { in: ["in_prelucrare", "download_failed"] } },
        { state: { in: ["ok", "nok", "xml_nepreluat"] }, zipS3Key: null, zipInline: null },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  let checked = 0;
  let archived = 0;
  for (const s of pending) {
    if (over()) {
      truncated = true;
      break;
    }
    const before = Boolean(s.zipS3Key || s.zipInline);
    const after = await checkSubmission(s);
    checked++;
    if (!before && (after.zipS3Key || after.zipInline)) archived++;
  }

  let reconciled = 0;
  const stuck = await db.efacturaSubmission.findMany({
    where: { state: "uploading", indexIncarcare: null, createdAt: { lt: new Date(Date.now() - STUCK_AFTER_MS) } },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  const byEnv = new Map<AnafEnv, SubmissionRow[]>();
  for (const s of stuck) byEnv.set(envOf(s), [...(byEnv.get(envOf(s)) ?? []), s]);
  for (const [env, rows] of byEnv) {
    if (over()) {
      truncated = true;
      break;
    }
    const zile = lookbackDays(rows[0].createdAt);
    const list = await fetchAnafList(issuerCif, zile, env);
    for (const s of rows) {
      if (over()) {
        truncated = true;
        break;
      }
      const r = await reconcileStuck(s, issuerCif, { list, zile, stuckCount: rows.length });
      if (r.sub.indexIncarcare) reconciled++;
      if (r.note) notes.push(r.note);
    }
  }

  // Arhive ramase inline desi S3 e configurat (S3 a cazut la prima incercare).
  let promoted = 0;
  if (photosConfigured && !over()) {
    const inlineOnly = await db.efacturaSubmission.findMany({
      where: { zipS3Key: null, zipInline: { not: null } },
      include: { invoice: { select: { series: true, number: true } } },
      take: 50,
    });
    for (const s of inlineOnly) {
      if (over()) {
        truncated = true;
        break;
      }
      const keys = await promoteInlineZip({
        env: s.env,
        series: s.invoice.series,
        number: s.invoice.number,
        indexIncarcare: s.indexIncarcare ?? s.id,
        zipInline: s.zipInline!,
      });
      if (keys) {
        await db.efacturaSubmission.update({ where: { id: s.id }, data: keys });
        promoted++;
      }
    }
  }
  return { checked, archived, reconciled, promoted, truncated, notes };
}
