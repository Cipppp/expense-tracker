/*
 * Cine trebuie sa ajunga in e-Factura si pana cand.
 *
 * OUG 120/2021 art. 10, in forma din 2026:
 *   - obligatoriu B2B catre persoane impozabile STABILITE in Romania
 *     (art. 266 alin. 2 Cod fiscal), indiferent daca emitentul e sau nu
 *     inregistrat in scopuri de TVA;
 *   - de la 01.01.2026 si catre persoane NEstabilite dar inregistrate in
 *     scopuri de TVA in Romania (cod "RO..."), pentru livrari cu locul in RO;
 *   - clientii straini fara niciun identificator romanesc sunt exceptati
 *     expres. Pot fi trimisi optional, cu extern=DA; XML-ul sigilat nu
 *     ajunge in niciun SPV, clientul primeste in continuare PDF-ul pe mail.
 *
 * Termen: 5 zile LUCRATOARE de la emitere (din 01.01.2026; inainte erau 5
 * calendaristice). Amenda pentru intarziere la "celelalte persoane juridice":
 * 1.000–2.500 lei pe luna calendaristica.
 *
 * Fisierul e fara "server-only" ca sa poata fi folosit si in componentele
 * client pentru etichete.
 */

export type EfacturaScope = "required" | "optional";

export function efacturaScope(inv: {
  clientCountry: string | null | undefined;
  clientCui: string | null | undefined;
}): { scope: EfacturaScope; extern: boolean; reason: string } {
  const country = (inv.clientCountry ?? "").trim().toUpperCase();
  const cui = (inv.clientCui ?? "").replace(/\s+/g, "").toUpperCase();
  if (country === "RO" || country === "") {
    return { scope: "required", extern: false, reason: "Client stabilit in Romania (B2B)" };
  }
  if (/^RO\d{2,10}$/.test(cui)) {
    return {
      scope: "required",
      extern: false,
      reason: "Client nestabilit, dar inregistrat in scopuri de TVA in Romania",
    };
  }
  return {
    scope: "optional",
    extern: true,
    reason: "Client strain fara identificator fiscal romanesc — exceptat; se poate trimite cu extern=DA",
  };
}

export type EfacturaPolicy = "auto" | "send" | "skip";

/** Politica de pe factura + scopul legal → trimitem sau nu. */
export function policyAllows(policy: string, scope: EfacturaScope): boolean {
  if (policy === "skip") return false;
  if (policy === "send") return true;
  return scope === "required";
}

/* ---------------------------------------------------------- zile lucratoare */

/**
 * Sarbatori legale in Romania (Codul muncii art. 139). Pastele si Rusaliile
 * sunt ortodoxe si se muta — de actualizat anual, o singura linie.
 */
export const RO_HOLIDAYS: Record<number, string[]> = {
  2026: [
    "01-01", "01-02", "01-06", "01-07", "01-24",
    "04-10", "04-12", "04-13", // Vinerea Mare, Pastele, a doua zi de Pasti
    "05-01", "05-31", "06-01", // 1 Mai, Rusaliile (31 mai + 1 iunie), 1 Iunie
    "08-15", "11-30", "12-01", "12-25", "12-26",
  ],
  2027: [
    "01-01", "01-02", "01-06", "01-07", "01-24",
    "04-30", "05-01", "05-02", "05-03", // Vinerea Mare, 1 Mai, Pastele, a doua zi
    "06-01", "06-20", "06-21", // 1 Iunie, Rusaliile
    "08-15", "11-30", "12-01", "12-25", "12-26",
  ],
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Data in calendarul din Bucuresti, ca "YYYY-MM-DD". */
export function bucharestDate(d: Date): { y: number; m: number; d: number; key: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const y = get("year"), m = get("month"), day = get("day");
  return { y, m, d: day, key: `${y}-${pad(m)}-${pad(day)}` };
}

export function isRoWorkingDay(d: Date): boolean {
  const { y, m, d: day } = bucharestDate(d);
  // Ziua saptamanii pentru data locala (folosim UTC pe componentele locale).
  const dow = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
  if (dow === 0 || dow === 6) return false;
  return !(RO_HOLIDAYS[y] ?? []).includes(`${pad(m)}-${pad(day)}`);
}

/** Data + n zile lucratoare (ziua de plecare nu se numara). Ora ramane cea de plecare. */
export function addWorkingDays(from: Date, n: number): Date {
  const out = new Date(from.getTime());
  let left = n;
  while (left > 0) {
    out.setUTCDate(out.getUTCDate() + 1);
    if (isRoWorkingDay(out)) left--;
  }
  return out;
}

/** Termenul de transmitere: 5 zile lucratoare de la data emiterii. */
export function efacturaDeadline(issuedAt: Date): Date {
  return addWorkingDays(issuedAt, 5);
}

/** Zile lucratoare ramase pana la termen (negativ = depasit). */
export function workingDaysUntil(deadline: Date, now = new Date()): number {
  const a = bucharestDate(now).key;
  const b = bucharestDate(deadline).key;
  if (a === b) return 0;
  const step = a < b ? 1 : -1;
  let count = 0;
  const cur = new Date(now.getTime());
  while (bucharestDate(cur).key !== b && count < 400) {
    cur.setUTCDate(cur.getUTCDate() + step);
    if (isRoWorkingDay(cur)) count += step;
  }
  return count;
}

/* ------------------------------------------------------------- etichete UI */

export type SubmissionState =
  | "uploading"
  | "upload_rejected"
  | "in_prelucrare"
  | "ok"
  | "nok"
  | "xml_nepreluat"
  | "download_failed";

/**
 * Starile din care NU se mai trimite inca o data in acelasi mediu. Un singur
 * loc, folosit si de server (send) si de panou, ca sa nu se contrazica.
 */
export const LOCKED_STATES: ReadonlySet<string> = new Set([
  "uploading",
  "in_prelucrare",
  "ok",
  "download_failed",
]);

export function locksResend(
  sub: { state: string; env: string } | null | undefined,
  env: string,
): boolean {
  return Boolean(sub && sub.env === env && LOCKED_STATES.has(sub.state));
}

/** ANAF a acceptat documentul: obligatia e indeplinita chiar daca ZIP-ul nu e inca arhivat. */
export function isFiled(state: string | null | undefined): boolean {
  return state === "ok" || state === "download_failed";
}

/**
 * Stari pe PROD care fac factura de nesters: exista (sau poate exista) un
 * original sigilat de MF sub numarul ei. Un singur loc, pentru ruta DELETE si
 * pentru butonul din pagina, ca sa nu se contrazica.
 */
export const DELETE_BLOCKING_STATES: readonly string[] = [
  "uploading",
  "in_prelucrare",
  "ok",
  "nok",
  "xml_nepreluat",
  "download_failed",
];

/**
 * De cand depune aplicatia singura. Facturile emise inainte au fost depuse
 * prin SmartBill/Oblio la vremea lor — fara aceasta limita fiecare factura
 * interna din istoric ar aparea "overdue" si cronul ar trimite alerte pentru
 * obligatii demult indeplinite.
 */
export const EFACTURA_SINCE = new Date("2026-09-01T00:00:00Z");

export function efacturaTracked(issuedAt: Date): boolean {
  return issuedAt.getTime() >= EFACTURA_SINCE.getTime();
}

/* ------------------------------------------------------------------ judete */

/** Numele judetului pentru codul ISO 3166-2:RO — pe PDF, langa CountrySubentity din XML. */
export const RO_COUNTY_NAMES: Record<string, string> = {
  "RO-AB": "Alba", "RO-AR": "Arad", "RO-AG": "Arges", "RO-BC": "Bacau", "RO-BH": "Bihor",
  "RO-BN": "Bistrita-Nasaud", "RO-BT": "Botosani", "RO-BV": "Brasov", "RO-BR": "Braila",
  "RO-B": "Bucuresti", "RO-BZ": "Buzau", "RO-CS": "Caras-Severin", "RO-CL": "Calarasi",
  "RO-CJ": "Cluj", "RO-CT": "Constanta", "RO-CV": "Covasna", "RO-DB": "Dambovita", "RO-DJ": "Dolj",
  "RO-GL": "Galati", "RO-GR": "Giurgiu", "RO-GJ": "Gorj", "RO-HR": "Harghita", "RO-HD": "Hunedoara",
  "RO-IL": "Ialomita", "RO-IS": "Iasi", "RO-IF": "Ilfov", "RO-MM": "Maramures", "RO-MH": "Mehedinti",
  "RO-MS": "Mures", "RO-NT": "Neamt", "RO-OT": "Olt", "RO-PH": "Prahova", "RO-SM": "Satu Mare",
  "RO-SJ": "Salaj", "RO-SB": "Sibiu", "RO-SV": "Suceava", "RO-TR": "Teleorman", "RO-TM": "Timis",
  "RO-TL": "Tulcea", "RO-VS": "Vaslui", "RO-VL": "Valcea", "RO-VN": "Vrancea",
};

export function roCountyName(code: string | null | undefined): string | null {
  if (!code) return null;
  return RO_COUNTY_NAMES[code.trim().toUpperCase()] ?? null;
}

export function stateLabel(
  state: string | null | undefined,
  opts: { hasErrors?: boolean } = {},
): {
  text: string;
  tone: "muted" | "warn" | "ok" | "bad" | "busy";
} {
  switch (state) {
    case "ok":
      return { text: "Validated by ANAF", tone: "ok" };
    case "nok":
      return { text: "Rejected by ANAF", tone: "bad" };
    case "xml_nepreluat":
      return { text: "XML not accepted", tone: "bad" };
    case "upload_rejected":
      return { text: "Upload refused", tone: "bad" };
    case "download_failed":
      return { text: "Validated · archive pending", tone: "warn" };
    case "in_prelucrare":
      return { text: "At ANAF (in prelucrare)", tone: "busy" };
    case "uploading":
      // Cu erori = upload-ul a plecat dar raspunsul nu a ajuns; se impaca
      // automat cu lista ANAF, nu se retrimite.
      return opts.hasErrors
        ? { text: "Sent · awaiting ANAF confirmation", tone: "warn" }
        : { text: "Sending…", tone: "busy" };
    default:
      return { text: "Not sent", tone: "muted" };
  }
}
