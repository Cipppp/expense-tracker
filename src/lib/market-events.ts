import "server-only";

/**
 * Evenimentele care mișcă acțiunile pe care le ai.
 *
 * Datele sunt culese manual din surse publice, pentru că nu există un feed
 * gratuit de încredere pentru calendarul de raportări. De aceea fiecare
 * eveniment își poartă și starea: o dată „confirmată" e anunțată de companie,
 * una „estimată" e ghicită de furnizorii de date din tiparul anilor trecuți.
 * Diferența contează — pe una îți poți face planuri, pe cealaltă nu.
 *
 * `typicalMove` e mărimea mișcării de o zi de după raportare, din istoric.
 * NU e o predicție și nu are direcție: la Nvidia, ultimele cinci raportări au
 * bătut estimările și acțiunea a scăzut de fiecare dată. Mărimea se poate
 * anticipa rezonabil, semnul nu.
 */
export type EventKind = "earnings" | "dividend" | "product";
export type DateStatus = "confirmed" | "estimated" | "disputed";

export type MarketEvent = {
  symbol: string;
  /** Ziua, sau prima zi dintr-un interval incert. */
  date: string; // YYYY-MM-DD
  /** Ultima zi, când sursele nu cad de acord. */
  dateEnd?: string;
  status: DateStatus;
  kind: EventKind;
  title: string;
  /** Mișcarea tipică de o zi, în procente, din istoricul raportărilor. */
  typicalMove?: number;
  note?: string;
};

/*
 * Companiile al căror calendar ne interesează. E un superset al pozițiilor:
 * Alphabet apare aici pentru că ai un CFD pe el, chiar dacă nu figurează la
 * „Poziții" — un CFD nu e o deținere, dar te mișcă la fel de tare.
 */
export const TRACKED = ["NVDA", "MSFT", "META", "GOOGL"] as const;

export const MARKET_EVENTS: MarketEvent[] = [
  {
    symbol: "GOOGL",
    date: "2026-10-27",
    status: "confirmed",
    kind: "earnings",
    title: "Rezultate Q3 2026",
    typicalMove: 6,
    note: "Confirmată de companie.",
  },
  {
    symbol: "MSFT",
    date: "2026-10-28",
    status: "estimated",
    kind: "earnings",
    title: "Rezultate Q1 FY2027",
    typicalMove: 4,
    note: "Estimată din tiparul anilor trecuți; Microsoft n-a anunțat-o încă.",
  },
  {
    symbol: "META",
    date: "2026-10-28",
    status: "estimated",
    kind: "earnings",
    title: "Rezultate Q3 2026",
    typicalMove: 9,
    note: "Meta are cele mai violente reacții din grup — mișcări de peste 15% s-au mai văzut.",
  },
  {
    symbol: "NVDA",
    date: "2026-11-17",
    dateEnd: "2026-11-25",
    status: "disputed",
    kind: "earnings",
    title: "Rezultate Q3 FY2027",
    typicalMove: 6,
    note:
      "Sursele nu cad de acord: Yahoo zice 17, majoritatea zic 25. Nvidia n-a anunțat oficial. " +
      "Ultimele cinci raportări: −0,8%, −3,2%, −5,5%, −1,8%, −4,6% — toate după ce a bătut estimările.",
  },
  {
    symbol: "NVDA",
    date: "2026-12-04",
    status: "estimated",
    kind: "dividend",
    title: "Ex-dividend, 0,25 $",
    typicalMove: 0.1,
    note: "Randament 0,45% pe an. Mecanic, nu e un eveniment de urmărit.",
  },
];

/** Doar ce urmează, în ordine cronologică. */
export function upcomingEvents(from: Date = new Date()): MarketEvent[] {
  const today = from.toISOString().slice(0, 10);
  return MARKET_EVENTS.filter((e) => (e.dateEnd ?? e.date) >= today).sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}
