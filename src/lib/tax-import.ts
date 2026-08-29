import "server-only";

/**
 * Extrage platile de taxe dintr-un extras ING in format CAMT.053 (XML).
 *
 * Toate obligatiile fiscale pleaca la aceleasi cateva contrapartide (Bugetul
 * de stat, Ministerul de finante, TVA), iar ce anume s-a platit sta in textul
 * liber al platii: "BS + BASS iunie", "Impozit dividende mai". De acolo ies si
 * felul taxei, si luna acoperita.
 */

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
