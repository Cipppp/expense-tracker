import "server-only";

/**
 * Extrage platile de taxe dintr-un extras ING in format CAMT.053 (XML).
 *
 * Toate obligatiile fiscale pleaca la aceleasi cateva contrapartide (Bugetul
 * de stat, Ministerul de finante, TVA), iar ce anume s-a platit sta in textul
 * liber al platii: "BS + BASS iunie", "Impozit dividende mai". De acolo ies si
 * felul taxei, si luna acoperita.
 */

import type { IngRow } from "@/lib/ing-csv";

export type TaxKind =
  | "bs_bas"
  | "dividende"
  | "venit"
  | "micro"
  | "cam"
  | "tva"
  | "alte";

export type ParsedTaxPayment = {
  paidAt: Date;
  forPeriod: string | null;
  kind: TaxKind;
  amountRon: number; // bani
  description: string;
  dedupKey: string;
};

const TAX_PARTY =
  /buget|ministerul de finante|ministry of finance|trezorer|^tva\/|anaf/i;

const MONTHS: Record<string, number> = {
  ianuarie: 1, februarie: 2, martie: 3, aprilie: 4, mai: 5, iunie: 6,
  iulie: 7, august: 8, septembrie: 9, octombrie: 10, noiembrie: 11, decembrie: 12,
};

function classify(text: string): TaxKind {
  const t = text.toLowerCase();
  if (/impozit\s+dividende/.test(t)) return "dividende";
  if (/impozit\s+venit/.test(t)) return "venit";
  if (/impozit\s+micro/.test(t)) return "micro";
  if (/\bcam\b/.test(t)) return "cam";
  if (/\btva\b/.test(t)) return "tva";
  if (/bs\s*\+?\s*bass?|bugetul de stat/.test(t)) return "bs_bas";
  return "alte";
}

/**
 * Luna acoperita, din eticheta. O luna care apare DUPA luna platii apartine
 * anului trecut — "decembrie" platit in ianuarie.
 */
function periodFrom(text: string, paidAt: Date): string | null {
  const m = text.toLowerCase().match(
    /\b(ianuarie|februarie|martie|aprilie|mai|iunie|iulie|august|septembrie|octombrie|noiembrie|decembrie)\b/,
  );
  if (!m) return null;
  const month = MONTHS[m[1]];
  const year =
    month > paidAt.getUTCMonth() + 1
      ? paidAt.getUTCFullYear() - 1
      : paidAt.getUTCFullYear();
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Curata textul ING: "Transfer ING BusinessBS + BASS iunieReferinta interna: 956…" */
function cleanLabel(raw: string): string {
  return raw
    .replace(/Transfer ING Business/gi, " ")
    .replace(/Referinta interna:.*$/i, " ")
    .replace(/Referin[tț]a?.*$/i, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/*
 * Banii care ies catre asociat. Nu sunt taxe, dar sunt baza pe care se
 * calculeaza impozitul pe dividende, si fara ei luna curenta n-are cum sa
 * fie estimata: dividendele din august se impoziteaza abia pe 25 septembrie,
 * deci in aplicatie nu exista nicio plata din care sa deducem cat se
 * datoreaza.
 */
export type PayoutKind = "dividende" | "salariu" | "alte";

export type ParsedPayout = {
  paidAt: Date;
  /** Luna in care a iesit banul — "2026-08". */
  forPeriod: string;
  kind: PayoutKind;
  amountRon: number; // bani
  description: string;
  /** Adevarat cand eticheta din banca lipsea si am dedus noi ca e dividend. */
  presumed: boolean;
  dedupKey: string;
};

/**
 * Cine e asociatul, din Settings.ownerNames.
 *
 * Era o expresie scrisa in cod cu numele proprietarului. Pentru altcineva,
 * dividendele lui treceau drept cheltuieli de firma si impozitul pe dividende
 * disparea din estimare — o cifra gresita, fara niciun semn ca e gresita.
 *
 * Diacriticele se normalizeaza, ca "Pârvu" din extras sa se potriveasca cu
 * "Parvu" scris in setari. Lista goala inseamna ca nu se deduce nimic: mai
 * bine niciun dividend detectat decat unul inventat.
 */
function foldDiacritics(v: string): string {
  return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function ownerMatcher(ownerNames: string): (counterparty: string) => boolean {
  const names = ownerNames
    .split(",")
    .map((n) => foldDiacritics(n.trim()))
    .filter((n) => n.length >= 3);
  if (names.length === 0) return () => false;
  return (counterparty: string) => {
    const who = foldDiacritics(counterparty);
    return names.some((n) => who.includes(n));
  };
}
/** Transferurile intre conturile proprii ale firmei nu sunt plati. */
const SELF = /project\s*cip/i;
/** Etichete care spun explicit ca banii nu sunt dividend. */
const NOT_DIVIDEND = /salariu|salary|[iî]mprumut|creditare|restituire|avans|dec[oó]nt/i;

function monthKeyOf(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Platile de taxe dintr-un extras ING in format CSV.
 *
 * `dedupKey` are exact aceeasi forma ca la CAMT (`data|bani|eticheta`), ca
 * acelasi virament importat pe ambele cai sa nu intre de doua ori.
 */
/**
 * Doua viramente identice in aceeasi zi sunt doua plati, nu un duplicat: al
 * doilea primeste "#2". Randurile se parcurg in ordinea din fisier, deci
 * reimportul aceluiasi extras produce aceleasi chei si nu dubleaza nimic.
 */
function nthKey(seen: Map<string, number>, base: string): string {
  const n = (seen.get(base) ?? 0) + 1;
  seen.set(base, n);
  return n === 1 ? base : `${base}#${n}`;
}

export function parseIngTaxPayments(rows: IngRow[]): ParsedTaxPayment[] {
  const isTaxParty = (r: IngRow) =>
    TAX_PARTY.test(
      `${r.counterparty} ${r.counterpartyIban} ${r.counterpartyBank} ${r.details}`,
    );

  /*
   * Restituirile. Taxa de timbru de 200 RON platita pe 6 august s-a intors pe
   * 10 august — daca o numaram, luna arata cu 200 de lei mai multe taxe decat
   * a costat de fapt. Un debit se anuleaza cu primul credit de aceeasi suma,
   * de la aceeasi contrapartida, in 45 de zile.
   */
  const who = (r: IngRow) => r.counterparty.toLowerCase().replace(/\W+/g, " ").trim();
  const credits = rows
    .filter((r) => r.amount > 0 && r.currency === "RON" && isTaxParty(r))
    .map((r) => ({
      amount: Math.round(r.amount * 100),
      at: r.date,
      who: who(r),
      used: false,
    }));
  const DAY = 24 * 3600 * 1000;

  const out: ParsedTaxPayment[] = [];
  const seen = new Map<string, number>();
  for (const r of rows) {
    if (r.amount >= 0) continue;          // doar iesiri
    if (r.currency !== "RON") continue;   // taxele se platesc doar in lei
    if (!isTaxParty(r)) continue;

    const label = cleanLabel(r.details) || r.counterparty;
    const amountRon = Math.round(Math.abs(r.amount) * 100);
    const day = r.date.toISOString().slice(0, 10);

    const refund = credits.find(
      (c) =>
        !c.used &&
        c.amount === amountRon &&
        // Restituirea vine de la aceeasi institutie, dar nu neaparat scrisa la
        // fel: plata pleaca spre "MINISTRY OF FINANCE/51711091", iar banii se
        // intorc de la "MINISTRY OF FINANCE". E de ajuns ca unul sa-l contina
        // pe celalalt.
        (c.who.startsWith(who(r)) || who(r).startsWith(c.who)) &&
        c.at.getTime() >= r.date.getTime() &&
        c.at.getTime() - r.date.getTime() <= 45 * DAY,
    );
    if (refund) {
      refund.used = true;
      continue;
    }

    /*
     * Felul taxei se citeste din ETICHETA, nu din contrapartida. Contrapartida
     * e mereu "Bugetul de stat/51711091", care se potriveste cu regula pentru
     * BS+BAS — asa o penalitate de intarziere ar ajunge sa treaca drept
     * contributii salariale platite. Contrapartida ramane doar plasa de
     * siguranta pentru randurile fara descriere.
     */
    const kind = classify(label || r.counterparty);
    out.push({
      paidAt: r.date,
      forPeriod: resolvePeriod(label, r.date, kind),
      kind,
      amountRon,
      description: label,
      dedupKey: nthKey(seen, `${day}|${amountRon}|${label.toLowerCase()}`),
    });
  }
  return out;
}

/**
 * Luna acoperita, cand eticheta n-o spune.
 *
 * Regula e cea confirmata la reconcilierea cu contabila: o plata fara luna in
 * descriere apartine lunii DINAINTE (se plateste pana pe 25 pentru luna
 * trecuta). Exceptie fac taxele unice — taxa de timbru, amenzile — care raman
 * in luna in care au fost platite, pentru ca nu acopera nicio perioada.
 */
const ONE_OFF = /timbru|amend[aă]|penalit|comision/i;

function resolvePeriod(label: string, paidAt: Date, kind: TaxKind): string | null {
  const fromLabel = periodFrom(label, paidAt);
  if (fromLabel) return fromLabel;

  // Aritmetica pe an/luna, nu `setUTCMonth(-1)`: pe 31 martie aia ar da
  // "31 februarie", pe care JS il muta in martie, si luna acoperita ar iesi
  // exact cea din care voiam sa plecam.
  let year = paidAt.getUTCFullYear();
  let month = paidAt.getUTCMonth() + 1;
  if (!ONE_OFF.test(label) && kind !== "alte") {
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * Dividendele si salariul platite asociatului, dintr-un extras ING CSV.
 *
 * Regula de clasificare, in ordine:
 *   1. eticheta contine "dividend"           → dividend, sigur
 *   2. eticheta spune altceva (salariu, imprumut, restituire) → nu e dividend
 *   3. transfer catre asociat FARA eticheta  → dividend presupus
 *
 * Punctul 3 exista pentru ca ING scrie "No details" cand nu completezi
 * descrierea, iar in practica acele viramente au fost dividende. Sunt marcate
 * `presumed`, ca sa se vada in interfata ce s-a dedus si ce s-a citit.
 */
/*
 * Cheltuielile firmei din extras: tot ce iese si nu e nici taxa, nici bani
 * catre asociat, nici mutare intre conturile proprii. Astea sunt Anthropic,
 * AWS, avocatul, comisioanele bancare — cheltuieli reale, doar ca platite de
 * pe firma, nu de pe cardul personal.
 */
export type ParsedIngExpense = {
  date: Date;
  description: string;
  /** Suma in unitati majore, pozitiva, in moneda contului. */
  amount: number;
  currency: string;
  dedupKey: string;
};

/** Mutari intre conturile proprii — nu sunt cheltuieli, sunt acelasi ban. */
const INTERNAL =
  /schimb valutar|acoperire sold negativ|transfer intre conturi proprii/i;

export function parseIngExpenses(
  rows: IngRow[],
  isOwner: (counterparty: string) => boolean,
): ParsedIngExpense[] {
  const out: ParsedIngExpense[] = [];
  const seen = new Map<string, number>();
  for (const r of rows) {
    if (r.amount >= 0) continue;
    const blob = `${r.counterparty} ${r.counterpartyIban} ${r.counterpartyBank} ${r.details}`;
    if (TAX_PARTY.test(blob)) continue;              // taxe, deja importate
    if (isOwner(r.counterparty)) continue;           // dividende si salariu
    if (SELF.test(r.counterparty)) continue;         // contul propriu
    if (INTERNAL.test(`${r.type} ${r.details}`)) continue;

    const label =
      cleanLabel(r.details) || r.counterparty || r.type || "Plată firmă";
    const amount = Math.abs(r.amount);
    const day = r.date.toISOString().slice(0, 10);
    out.push({
      date: r.date,
      description: label,
      amount,
      currency: r.currency,
      dedupKey: nthKey(
        seen,
        `ing|${day}|${r.currency}|${amount.toFixed(2)}|${label.toLowerCase()}`,
      ),
    });
  }
  return out;
}

export function parseIngPayouts(
  rows: IngRow[],
  isOwner: (counterparty: string) => boolean,
): ParsedPayout[] {
  const out: ParsedPayout[] = [];
  const seen = new Map<string, number>();
  for (const r of rows) {
    if (r.amount >= 0) continue;
    if (r.currency !== "RON") continue;
    const blob = `${r.counterparty} ${r.counterpartyIban} ${r.counterpartyBank} ${r.details}`;
    if (TAX_PARTY.test(blob)) continue;               // aia sunt taxe
    if (SELF.test(r.counterparty)) continue;          // schimb valutar intern
    if (/schimb valutar/i.test(r.type)) continue;
    if (!isOwner(r.counterparty)) continue;           // doar catre asociat

    const label = cleanLabel(r.details);
    const amountRon = Math.round(Math.abs(r.amount) * 100);
    const day = r.date.toISOString().slice(0, 10);

    let kind: PayoutKind;
    let presumed = false;
    if (/dividend/i.test(label)) {
      kind = "dividende";
    } else if (/salariu|salary/i.test(label)) {
      kind = "salariu";
    } else if (label && NOT_DIVIDEND.test(label)) {
      kind = "alte";
    } else if (!label) {
      kind = "dividende";
      presumed = true;
    } else {
      kind = "alte";
    }

    out.push({
      paidAt: r.date,
      forPeriod: monthKeyOf(r.date),
      kind,
      amountRon,
      description: label || `Transfer către ${r.counterparty}`,
      presumed,
      dedupKey: nthKey(
        seen,
        `${day}|${amountRon}|${(label || r.counterparty).toLowerCase()}`,
      ),
    });
  }
  return out;
}

export function parseCamtTaxPayments(xml: string): ParsedTaxPayment[] {
  const out: ParsedTaxPayment[] = [];
  for (const m of xml.matchAll(/<Ntry>([\s\S]*?)<\/Ntry>/g)) {
    const b = m[1];
    if (!/<CdtDbtInd>DBIT<\/CdtDbtInd>/.test(b)) continue; // doar iesiri

    const amt = b.match(/<Amt Ccy="RON">([\d.]+)<\/Amt>/);
    const dt = b.match(/<BookgDt>\s*<DtTm>(\d{4}-\d{2}-\d{2})/);
    if (!amt || !dt) continue;

    const names = [...b.matchAll(/<Nm>([^<]*)<\/Nm>/g)].map((x) => x[1].trim());
    const who = names.join(" / ");
    const ustrd = (b.match(/<Ustrd>([^<]*)<\/Ustrd>/) ?? ["", ""])[1];
    const info = (b.match(/<AddtlNtryInf>([^<]*)<\/AddtlNtryInf>/) ?? ["", ""])[1];
    const blob = `${who} ${ustrd} ${info}`;
    if (!TAX_PARTY.test(blob)) continue;

    const [y, mo, d] = dt[1].split("-").map(Number);
    const paidAt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0, 0));
    const label = cleanLabel(ustrd || info) || who;
    const amountRon = Math.round(parseFloat(amt[1]) * 100);

    out.push({
      paidAt,
      forPeriod: periodFrom(label, paidAt),
      kind: classify(`${label} ${who}`),
      amountRon,
      description: label,
      dedupKey: `${dt[1]}|${amountRon}|${label.toLowerCase()}`,
    });
  }
  return out;
}
