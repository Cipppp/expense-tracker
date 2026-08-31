import "server-only";

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

/** Numele cotei asa cum il asteapta Oblio in `vatName`. */
function vatName(vatRate: number, country: string | null | undefined) {
  const c = (country ?? "").trim().toUpperCase();
  if (vatRate > 0) return `Normala ${Math.round(vatRate * 100)}%`;
  if (c && c !== "RO") return "Taxare inversa";
  return "Scutit fara drept de deducere";
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
