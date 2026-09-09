/**
 * Parser pentru extrasul de cont ING Business, exportat ca CSV.
 *
 * Formatul e altul decat cel de la Revolut: separator `;`, data `dd-mm-yy`,
 * si cate un fisier per cont (RON, EUR, USD). Primul si ultimul rand al
 * fiecarui fisier sunt soldurile de deschidere/inchidere — au data si valuta,
 * dar nu au suma, si nu sunt tranzactii.
 *
 * Header-ul, exact cum vine din ING:
 *   Sold initial;Sold final;Numar cont;Data procesarii;Suma;Valuta;
 *   Tip tranzactie;Nume beneficiar/ordonator;Cont beneficiar/ordonator;
 *   Banca beneficiar/ordonator;Detaliile tranzactiei;Sold intermediar
 */

export type IngRow = {
  /** IBAN-ul contului din care vine extrasul. */
  account: string;
  /** Data procesarii, la pranz UTC ca sa nu alunece intre fusuri. */
  date: Date;
  /** Suma in unitati majore, cu semn: negativ = iesire. */
  amount: number;
  currency: string;
  /** "Transfer ING Business", "Incasare", "Schimb valutar ING Business"… */
  type: string;
  counterparty: string;
  counterpartyIban: string;
  counterpartyBank: string;
  details: string;
};

const HEADER_MARKERS = ["sold initial", "numar cont", "data procesarii"];

/** Recunoaste un extras ING dupa header, ca sa nu-l confundam cu Revolut. */
export function isIngCsv(text: string): boolean {
  const first = text.split(/\r?\n/, 1)[0]?.toLowerCase() ?? "";
  return HEADER_MARKERS.every((m) => first.includes(m));
}

/**
 * Split pe `;` cu respectarea ghilimelelor. ING scrie campurile goale ca `""`
 * si nu escapeaza nimic altceva, dar un `;` intr-un camp citat ar strica un
 * split naiv, asa ca mergem caracter cu caracter.
 */
function splitSemicolons(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // `""` inauntrul unui camp citat inseamna un ghilimel literal.
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (ch === ";" && !quoted) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/**
 * `-1.400,00` sau `-1400.00` — ING exporta ambele, in functie de setarile
 * contului. Regula: daca exista si punct si virgula, ultimul separator e cel
 * zecimal; daca exista doar unul si e urmat de fix doua cifre, tot zecimal e.
 */
function parseAmount(raw: string): number | null {
  const s = raw.replace(/\s/g, "");
  if (!s) return null;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  let normalized: string;
  if (lastDot >= 0 && lastComma >= 0) {
    const decimalAt = Math.max(lastDot, lastComma);
    normalized =
      s.slice(0, decimalAt).replace(/[.,]/g, "") + "." + s.slice(decimalAt + 1);
  } else if (lastComma >= 0) {
    normalized =
      s.length - lastComma === 3
        ? s.replace(",", ".")
        : s.replace(/,/g, "");
  } else {
    normalized = s;
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** `06-08-26` → 2026-08-06, la pranz UTC. */
function parseDate(raw: string): Date | null {
  const m = raw.match(/^(\d{2})-(\d{2})-(\d{2,4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const yy = Number(m[3]);
  const year = m[3].length === 4 ? yy : 2000 + yy;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

export function parseIngCsv(text: string): IngRow[] {
  const lines = text.split(/\r?\n/);
  const out: IngRow[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (i === 0 && line.toLowerCase().includes("sold initial")) continue;

    const f = splitSemicolons(line);
    // Un rand valid are toate cele 12 coloane. Exporturile mai prind si
    // fragmente lipite gresit ("28" pe o linie singura) — le sarim tacut.
    if (f.length < 12) continue;

    const [
      ,
      ,
      account,
      dateRaw,
      amountRaw,
      currency,
      type,
      counterparty,
      counterpartyIban,
      counterpartyBank,
      details,
    ] = f;

    // Randurile de sold (deschidere/inchidere) n-au suma.
    const amount = parseAmount(amountRaw);
    if (amount === null || amount === 0) continue;

    const date = parseDate(dateRaw);
    if (!date) continue;

    out.push({
      account: account.trim(),
      date,
      amount,
      currency: (currency || "RON").trim().toUpperCase(),
      type: type.trim(),
      counterparty: counterparty.trim(),
      counterpartyIban: counterpartyIban.trim(),
      counterpartyBank: counterpartyBank.trim(),
      // "No details" e placeholder-ul ING pentru transfer fara descriere.
      details: /^no details$/i.test(details.trim()) ? "" : details.trim(),
    });
  }

  return out;
}
