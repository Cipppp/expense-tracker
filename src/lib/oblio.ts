import "server-only";
import { EU_MEMBER_STATES } from "@/lib/vat";

/*
 * Oblio — emiterea facturii si in contul de facturare, nu doar in aplicatie.
 *
 * De ce prin Oblio si nu direct la ANAF: Oblio e deja conectat la SPV cu
 * certificatul firmei. Aplicatia asta stie sa construiasca XML-ul CIUS_RO
 * (vezi lib/efactura.ts) dar nu are certificat si nu poate semna, deci ar
 * trebui oricum incarcat manual. Cand factura ajunge in Oblio, Oblio o duce
 * mai departe la SPV — automat, daca e bifat "Trimite automat e-Factura la
 * SPV" in Setari > Preferinte al contului, altfel din butonul lor.
 *
 * Nu exista un endpoint public documentat pentru "trimite ACUM la SPV", asa
 * ca aplicatia se opreste la a crea documentul si a intoarce linkul lui.
 *
 * Credentialele stau in env: OBLIO_EMAIL (adresa de login) si OBLIO_SECRET
 * (Setari > Date firma > token). Fara ele, integrarea e pur si simplu oprita
 * si restul aplicatiei merge la fel.
 */

const BASE = "https://www.oblio.eu/api";

export type OblioResult = {
  seriesName: string;
  number: string;
  link: string | null;
};

export function oblioConfigured() {
  return Boolean(process.env.OBLIO_EMAIL && process.env.OBLIO_SECRET);
}

/*
 * Tokenul tine o ora. Il pastram in memoria procesului cu un minut de marja,
 * ca sa nu cerem unul nou la fiecare factura, dar sa nu folosim nici unul
 * expirat pe muchie.
 */
let cached: { token: string; expiresAt: number } | null = null;

async function token(): Promise<string> {
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  const email = process.env.OBLIO_EMAIL;
  const secret = process.env.OBLIO_SECRET;
  if (!email || !secret) throw new Error("Oblio is not configured");

  const res = await fetch(`${BASE}/authorize/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: email, client_secret: secret }),
    cache: "no-store",
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.access_token) {
    throw new Error(
      `Oblio auth failed (${res.status})${body?.error ? `: ${body.error}` : ""}`,
    );
  }
  const ttl = Number(body.expires_in) || 3600;
  cached = {
    token: body.access_token as string,
    expiresAt: Date.now() + (ttl - 60) * 1000,
  };
  return cached.token;
}

/*
 * Numele cotei, exact cum e scris in nomenclatorul contului Oblio.
 *
 * Nu sunt inventate: contul are "Normala" (21%), "Redusa", "Scutita",
 * "SFDD", "SDD", "TVA Inclus", "Taxare inversa", "Veche". Procentul merge
 * separat, in `vatPercentage` — de aceea numele e "Normala", nu "Normala 21%".
 * Un nume care nu exista in cont face factura sa fie respinsa la emitere.
 * `oblioPreflight` verifica potrivirea fara sa emita nimic.
 *
 * SFDD = scutit fara drept de deducere, adica exact regimul art. 310 sub care
 * e firma. Se foloseste si pentru serviciile catre clienti din afara UE:
 * acelea sunt neimpozabile in Romania (art. 278), iar Oblio n-are un nume
 * pentru "neimpozabil". Nu are consecinta — suma e 0 in ambele cazuri, iar
 * facturile externe nu intra in RO e-Factura.
 */
const VAT_NAME = {
  standard: "Normala",
  reverseCharge: "Taxare inversa",
  exempt: "SFDD",
} as const;

function vatName(vatRate: number, country: string | null | undefined) {
  const c = (country ?? "").trim().toUpperCase();
  if (vatRate > 0) return VAT_NAME.standard;
  if (c && c !== "RO" && EU_MEMBER_STATES.has(c)) return VAT_NAME.reverseCharge;
  return VAT_NAME.exempt;
}

export async function createOblioInvoice(input: {
  issuerCif: string;
  seriesName: string;
  issuedAt: Date;
  dueAt: Date | null;
  currency: string;
  exchangeRate: number | null;
  vatRate: number;
  mentions: string | null;
  client: {
    name: string;
    cif: string | null;
    rc: string | null;
    address: string | null;
    country: string | null;
    email: string | null;
  };
  lines: Array<{
    description: string;
    unit: string;
    quantity: number;
    unitPrice: number;
  }>;
}): Promise<OblioResult> {
  const t = await token();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const foreign = input.currency !== "RON";

  const payload: Record<string, unknown> = {
    cif: input.issuerCif,
    client: {
      name: input.client.name,
      cif: input.client.cif ?? "",
      rc: input.client.rc ?? "",
      address: input.client.address ?? "",
      country: input.client.country ?? "Romania",
      email: input.client.email ?? "",
      // Clientul strain nu e platitor de TVA in Romania; contorul de TVA al
      // facturii vine oricum din `vatName` de pe fiecare linie.
      vatPayer: input.vatRate > 0 ? 1 : 0,
      save: 1,
    },
    issueDate: iso(input.issuedAt),
    dueDate: input.dueAt ? iso(input.dueAt) : "",
    seriesName: input.seriesName,
    language: "RO",
    precision: 2,
    currency: input.currency,
    // Oblio cere cursul doar cand moneda facturii nu e RON.
    ...(foreign && input.exchangeRate ? { exchangeRate: input.exchangeRate } : {}),
    products: input.lines.map((l) => ({
      name: l.description,
      description: "",
      price: l.unitPrice,
      measuringUnit: l.unit || "buc",
      currency: input.currency,
      vatName: vatName(input.vatRate, input.client.country),
      vatPercentage: Math.round(input.vatRate * 100),
      vatIncluded: 0,
      quantity: l.quantity,
      productType: "Serviciu",
    })),
    mentions: input.mentions ?? "",
    workStation: "Sediu",
    useStock: 0,
    // Trimiterea catre client o face aplicatia asta, cu raportul de activitate
    // atasat; Oblio nu are raportul, deci nu are ce sa trimita in locul ei.
    sendEmail: 0,
  };

  const res = await fetch(`${BASE}/docs/invoice`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${t}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || (body?.status && body.status !== 200)) {
    throw new Error(
      `Oblio rejected the invoice (${res.status}): ${
        body?.statusMessage ?? JSON.stringify(body ?? {}).slice(0, 300)
      }`,
    );
  }
  return {
    seriesName: body?.data?.seriesName ?? input.seriesName,
    number: String(body?.data?.number ?? ""),
    link: body?.data?.link ?? null,
  };
}

/* ------------------------------------------------------------------ preflight */

type Nomen = { path: string; status: number; count: number | null; sample: unknown };

async function readNomenclature(t: string, path: string): Promise<Nomen> {
  const res = await fetch(`${BASE}/nomenclature/${path}`, {
    headers: { Authorization: `Bearer ${t}` },
    cache: "no-store",
  });
  const body = await res.json().catch(() => null);
  const data = body?.data;
  return {
    path,
    status: res.status,
    count: Array.isArray(data) ? data.length : data ? 1 : 0,
    sample: data ?? body?.statusMessage ?? null,
  };
}

/**
 * Citeste contul si compara ce are cu ce trimite `createOblioInvoice`.
 * Strict GET — nu emite si nu modifica nimic.
 */
export async function oblioPreflight(want: {
  series: string;
  issuerCif: string;
  issuerVatIntra: string;
}) {
  const t = await token();

  const companies = await readNomenclature(t, "companies");
  const list = Array.isArray(companies.sample) ? (companies.sample as Array<Record<string, unknown>>) : [];
  const cifs = list.map((c) => String(c.cif ?? "").replace(/^RO/i, ""));
  const bare = want.issuerCif.replace(/^RO/i, "");
  const cifMatches = cifs.includes(bare);
  // Oblio filtreaza seriile si cotele pe firma, deci are nevoie de CIF.
  const cifParam = encodeURIComponent(list[0]?.cif ? String(list[0].cif) : want.issuerCif);

  const [series, vat] = await Promise.all([
    readNomenclature(t, `series?cif=${cifParam}`),
    readNomenclature(t, `vat_rates?cif=${cifParam}`),
  ]);

  const seriesNames = (Array.isArray(series.sample) ? series.sample : [])
    .map((s: Record<string, unknown>) => String(s.name ?? ""));
  const vatNames = (Array.isArray(vat.sample) ? vat.sample : [])
    .map((v: Record<string, unknown>) => String(v.name ?? ""));

  /*
   * Numele cotelor pe care le poate produce `vatName()`. Daca vreunul nu
   * exista in cont, factura care are nevoie de el va fi respinsa — si nu vrei
   * sa afli asta la prima factura reala catre NETOP.
   */
  const needVat = Object.values(VAT_NAME);
  const missingVat = needVat.filter((n) => !vatNames.includes(n));

  const problems: string[] = [];
  if (!cifMatches) {
    problems.push(
      `Settings.issuerCif is ${want.issuerCif} but the Oblio account holds ${cifs.join(", ") || "no company"}.`,
    );
  }
  if (seriesNames.length && !seriesNames.includes(want.series)) {
    problems.push(
      `Invoice series "${want.series}" does not exist in Oblio (found: ${seriesNames.join(", ") || "none"}).`,
    );
  }
  if (missingVat.length) {
    problems.push(`VAT names missing from the account: ${missingVat.join(", ")}.`);
  }

  return {
    configured: true,
    authenticated: true,
    // Inregistrarile brute: numele singur nu spune ce cota si ce tratament e
    // in spate, iar alegerea gresita se vede abia pe factura la ANAF.
    rawCompany: list[0] ?? null,
    rawVatRates: vat.sample ?? null,
    rawSeries: series.sample ?? null,
    account: { companies: cifs, cifMatches },
    series: { available: seriesNames, using: want.series },
    vatRates: { available: vatNames, needed: needVat, missing: missingVat },
    issuerVatIntra: want.issuerVatIntra || null,
    raw: { companies: companies.status, series: series.status, vat: vat.status },
    problems,
  };
}
