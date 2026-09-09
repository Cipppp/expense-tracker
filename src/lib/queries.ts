/**
 * Server-only data access helpers — used by RSC pages and route handlers.
 *
 * Convention: any query that feeds aggregates / charts / totals filters
 * `excluded: false` so excluded rows stay in the DB but never show up in
 * sums. The expense table is the only place that surfaces them, so users
 * can un-exclude.
 */
import "server-only";
import { db } from "@/lib/db";
import { endOfMonth, startOfMonth } from "@/lib/format";

export type ExpenseSortField =
  | "date"
  | "description"
  | "category"
  | "amountRon"
  | "amountUsd";
export type SortDir = "asc" | "desc";

export type ExpenseFilters = {
  category?: string;
  minRon?: number;     // bani
  maxRon?: number;     // bani
  q?: string;
  sort?: ExpenseSortField;
  dir?: SortDir;
};

/**
 * Expense table query. Returns excluded rows too — the page styles them
 * differently and the totals omit them client-side.
 */
export async function getMonthExpenses(
  year: number,
  month: number,
  filters: ExpenseFilters = {},
) {
  const sortField = filters.sort ?? "date";
  const dir = filters.dir ?? "desc";
  const orderBy: { [K in ExpenseSortField | "createdAt"]?: SortDir }[] = [
    { [sortField]: dir },
    ...(sortField !== "date" ? [{ date: "desc" as const }] : []),
    { createdAt: "desc" },
  ];

  return db.expense.findMany({
    where: {
      date: { gte: startOfMonth(year, month), lte: endOfMonth(year, month) },
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.minRon != null || filters.maxRon != null
        ? {
            amountRon: {
              ...(filters.minRon != null ? { gte: filters.minRon } : {}),
              ...(filters.maxRon != null ? { lte: filters.maxRon } : {}),
            },
          }
        : {}),
      ...(filters.q
        ? { description: { contains: filters.q, mode: "insensitive" } }
        : {}),
    },
    orderBy,
  });
}

/** Distinct categories with at least one non-excluded row in the year. */
export async function getYearCategories(year: number): Promise<string[]> {
  const rows = await db.expense.findMany({
    where: {
      date: {
        gte: new Date(year, 0, 1),
        lte: new Date(year, 11, 31, 23, 59, 59),
      },
      excluded: false,
    },
    distinct: ["category"],
    select: { category: true },
  });
  return rows.map((r) => r.category).sort();
}

/** Monthly category totals for the dashboard category chart. Excluded out. */
export async function getMonthlyCategoryBreakdown(year: number) {
  const expenses = await getYearExpenses(year);
  const months: Array<{ month: number; label: string; categories: Record<string, number> }> = [];
  for (let m = 1; m <= 12; m++) {
    months.push({
      month: m,
      label: new Date(year, m - 1, 1).toLocaleDateString("en-US", { month: "short" }),
      categories: {},
    });
  }
  /*
   * Cheltuielile de pe firma stau intr-o galeata proprie, nu imprastiate prin
   * categoriile personale. Sunt tot cheltuieli si intra tot in "spent", dar
   * intrebarea "cat am dat luna asta pe mancare" nu are acelasi raspuns daca
   * inauntru sta si abonamentul de la Anthropic platit de SRL.
   */
  for (const e of expenses) {
    const m = e.date.getMonth();
    const key = e.source === "ing" ? COMPANY_CATEGORY : e.category;
    months[m].categories[key] = (months[m].categories[key] ?? 0) + e.amountRon;
  }
  return months;
}

/** Eticheta rezervata cheltuielilor platite din contul firmei. */
export const COMPANY_CATEGORY = "Firmă";

/** Year's expenses, EXCLUDING rows the user explicitly excluded. */
export async function getYearExpenses(year: number) {
  return db.expense.findMany({
    where: {
      date: {
        gte: new Date(year, 0, 1),
        lte: new Date(year, 11, 31, 23, 59, 59),
      },
      excluded: false,
    },
  });
}

export async function getYearIncome(year: number) {
  return db.income.findMany({
    where: {
      date: {
        gte: new Date(year, 0, 1),
        lte: new Date(year, 11, 31, 23, 59, 59),
      },
    },
    include: { invoice: { select: { status: true } } },
    orderBy: { date: "desc" },
  });
}

/*
 * Bani INCASATI vs ore din calendar.
 *
 * Orele din tracker (`hours` setat) nu sunt bani: devin bani abia cand sunt
 * facturate SI factura e marcata platita. Pana atunci sunt "unbilled" sau
 * "outstanding", nu Earned. Inainte, orele nefacturate se numarau ca
 * incasate si Earned crestea cu fiecare zi logata — cu 600 $ de la Marc in
 * august, cand nu intrase niciun ban.
 *
 * Sumele fixe (`hours` gol) sunt bani care chiar au intrat fara o factura in
 * aplicatie — platile Upwork, sau randul-oglinda creat la "Mark paid" pe o
 * factura scrisa de mana — si conteaza imediat. La fel orele cu `paidVia`
 * (contract orar Upwork, platit saptamanal, fara factura de-a noastra).
 */
type IncomeWithInvoice = {
  hours?: number | null;
  paidVia?: string | null;
  invoice?: { status: string } | null;
};
export const isCollected = (r: IncomeWithInvoice) =>
  r.hours == null
    ? !r.invoice || r.invoice.status === "paid"
    : r.invoice?.status === "paid" || Boolean(r.paidVia);
/** Ore din calendar fara nicio factura si fara alta plata inca. */
export const isUnbilled = (r: IncomeWithInvoice) => r.hours != null && !r.invoice && !r.paidVia;

/**
 * Income is stored in the currency it was billed in — NETOP and Aethra
 * invoice in EUR, BLNG in USD, FUSECON and NINE in RON — so summing
 * `amountUsd` raw would count 4,200 EUR as $4,200. Every aggregate goes
 * through here instead.
 */
export function incomeToUsdCents(
  rows: Array<{ amountUsd: number; currency: string }>,
  fx: { fxEurToUsd: number; fxRonToUsd: number },
): number {
  let total = 0;
  for (const r of rows) {
    if (r.currency === "EUR") total += r.amountUsd * fx.fxEurToUsd;
    else if (r.currency === "RON") total += r.amountUsd * fx.fxRonToUsd;
    else total += r.amountUsd;
  }
  return Math.round(total);
}

/**
 * Setarile contului curent.
 *
 * Erau un singur rand, `id = 1`, cerut in ~20 de locuri. Acum sunt ale
 * utilizatorului: `upsert` creeaza randul la prima cerere, ca un cont nou sa
 * nu inceapa cu o eroare pe o pagina care cere cursuri inexistente.
 */
export async function getSettings() {
  const userId = await requireUserId();
  return db.settings.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

/** Utilizatorul curent, sau o eroare limpede daca nu exista sesiune. */
export async function requireUserId(): Promise<string> {
  const { currentUserId } = await import("@/lib/session");
  const id = await currentUserId();
  if (!id) throw new Error("Nicio sesiune — nu stiu al cui e randul asta.");
  return id;
}

/** TOP 5 merchants for a month — excluded rows skipped. */
export async function getTopMerchants(year: number, month: number, limit = 5) {
  const grouped = await db.expense.groupBy({
    by: ["merchant"],
    where: {
      date: { gte: startOfMonth(year, month), lte: endOfMonth(year, month) },
      excluded: false,
    },
    _sum: { amountRon: true, amountUsd: true },
    _count: true,
    orderBy: { _sum: { amountRon: "desc" } },
    take: limit,
  });
  return grouped.map((g) => ({
    merchant: g.merchant || "—",
    count: g._count,
    amountRon: g._sum.amountRon ?? 0,
    amountUsd: g._sum.amountUsd ?? 0,
  }));
}

/** Monthly aggregates for the year — used in the Dashboard chart. */
export async function getMonthlyAggregates(year: number) {
  const [expenses, income, settings, taxes, payouts] = await Promise.all([
    getYearExpenses(year),
    getYearIncome(year),
    getSettings(),
    db.taxPayment.findMany({ where: { forPeriod: { startsWith: String(year) } } }),
    db.companyPayout.findMany({ where: { forPeriod: { startsWith: String(year) } } }),
  ]);

  const months: Array<{
    month: number;
    label: string;
    spentRon: number;
    spentUsd: number;
    /** Din `spentUsd`, cat a fost platit din contul firmei. */
    spentCompanyUsd: number;
    earnedUsd: number;
    outstandingUsd: number;
    /** Taxe chiar platite pentru luna asta, pe fel, in bani RON. */
    taxRon: Record<string, number>;
    taxTotalRon: number;
    /** Obligatii fixe estimate, pentru lunile inca neplatite. */
    taxForecastRon: number;
    /** Tot ce se datoreaza pentru luna asta: platit daca s-a platit, altfel estimat. */
    taxOwedRon: number;
    /** Dividende scoase in luna asta, din extrasul ING. */
    dividendsRon: number;
    /** Cat din ele n-aveau eticheta in banca si le-am presupus dividende. */
    dividendsPresumedRon: number;
    /**
     * Banii ramasi din luna trecuta dupa taxele ei — cat ai de cheltuit in
     * luna asta. Se pune pe luna URMATOARE celei din care provin.
     */
    availableUsd: number;
  }> = [];
  for (let m = 1; m <= 12; m++) {
    months.push({
      month: m,
      label: new Date(year, m - 1, 1).toLocaleDateString("en-US", { month: "short" }),
      spentRon: 0,
      spentUsd: 0,
      spentCompanyUsd: 0,
      earnedUsd: 0,
      outstandingUsd: 0,
      taxRon: {},
      taxTotalRon: 0,
      taxForecastRon: 0,
      taxOwedRon: 0,
      dividendsRon: 0,
      dividendsPresumedRon: 0,
      availableUsd: 0,
    });
  }

  for (const e of expenses) {
    const m = e.date.getMonth();
    months[m].spentRon += e.amountRon;
    months[m].spentUsd += e.amountUsd;
    if (e.source === "ing") months[m].spentCompanyUsd += e.amountUsd;
  }
  /*
   * Taxele vin din platile reale, nu dintr-o formula.
   *
   * Formula de dinainte punea CAM in fiecare luna, impozit micro in fiecare
   * luna si 16% dividende pe tot ce ramanea — trei presupuneri false. CAM se
   * plateste doar cateva luni, micro-ul e trimestrial, iar impozitul pe
   * dividende se datoreaza pe dividendele chiar distribuite. Pe iulie formula
   * dadea 10.242 RON fata de 7.325 platiti in realitate.
   */
  /*
   * Estimare pentru lunile inca neplatite.
   *
   * Doar obligatiile chiar fixe: contributiile salariale (BS+BAS) si CAM,
   * care se datoreaza in fiecare luna indiferent de incasari. Impozitul micro
   * e trimestrial, iar cel pe dividende depinde de cat distribui — alea NU se
   * estimeaza, pentru ca exact asta facea graficul vechi gresit.
   */
  /*
   * Prima luna pentru care mai are rost o estimare. Pe anul curent e luna
   * TRECUTA: taxele ei se platesc pana pe 25 luna asta, deci lipsa unei plati
   * nu inseamna ca nu se datoreaza. Pe un an inchis nu estimam nimic — de aia
   * 13, si nu 12: cu 12, `m >= nowMonth - 1` ar fi prins decembrie.
   */
  const nowMonth =
    year === new Date().getFullYear() ? new Date().getMonth() : 13;

  for (const t of taxes) {
    if (!t.forPeriod?.startsWith(String(year))) continue;
    const m = Number(t.forPeriod.slice(5, 7)) - 1;
    if (m < 0 || m > 11) continue;
    months[m].taxRon[t.kind] = (months[m].taxRon[t.kind] ?? 0) + t.amountRon;
    months[m].taxTotalRon += t.amountRon;
  }

  // Baza pentru impozitul micro: ce s-a FACTURAT in luna aia, incasat sau nu.
  const invoicedUsd = new Array(12).fill(0);
  for (const i of income) {
    const m = i.date.getMonth();
    const usd = incomeToUsdCents([i], settings);
    if (isCollected(i)) months[m].earnedUsd += usd;
    else months[m].outstandingUsd += usd;
    if (!isUnbilled(i)) invoicedUsd[m] += usd;
  }

  for (const p of payouts) {
    const m = Number(p.forPeriod.slice(5, 7)) - 1;
    if (m < 0 || m > 11 || p.kind !== "dividende") continue;
    months[m].dividendsRon += p.amountRon;
    if (p.presumed) months[m].dividendsPresumedRon += p.amountRon;
  }

  for (let m = 0; m < 12; m++) {
    /*
     * Estimarea acopera luna curenta, cele viitoare SI luna trecuta — pentru
     * ea taxele se platesc abia pe 25 a lunii asta, deci lipsa unei plati nu
     * inseamna ca nu se datoreaza nimic. Mai departe in trecut nu inventam:
     * ori s-a platit, ori nu se mai plateste.
     *
     * Criteriul e lipsa contributiilor salariale, nu totalul lunii pe zero:
     * o taxa de timbru de 200 RON facea totalul nenul si stergea estimarea
     * pentru restul obligatiei, care ramanea totusi de platit.
     */
    if (m >= nowMonth - 1) {
      /*
       * Ce se datoreaza pentru o luna, cand n-a fost inca platit:
       *   - pachetul salarial, fix in fiecare luna (BS+BAS si CAM)
       *   - impozitul pe dividendele chiar scoase in luna aia. Cota e pe
       *     BRUT, iar din banca vezi netul, deci 16% pe brut inseamna
       *     16/84 din cat ti-a intrat in cont.
       *   - impozitul micro pe ce s-a facturat. Se plateste trimestrial, dar
       *     aici il repartizam lunar: intrebarea e cat din banii lunii sunt
       *     ai tai, nu cand pleaca viramentul.
       *
       * Fiecare bucata se estimeaza doar daca n-a fost deja platita. Altfel,
       * o luna platita pe jumatate — impozitul pe dividende virat pe 5, dar
       * contributiile abia pe 25 — s-ar numara de doua ori: o data ca plata
       * chiar facuta, o data in estimare.
       */
      const paid = months[m].taxRon;
      const pct = settings.dividendePct;
      const fixedRon =
        paid.bs_bas || paid.cam ? 0 : settings.bsBasRon + settings.camRon;
      const dividendTaxRon = paid.dividende
        ? 0
        : Math.round((months[m].dividendsRon * pct) / (1 - pct));
      const microRon = paid.micro
        ? 0
        : Math.round((invoicedUsd[m] / settings.fxRonToUsd) * settings.microPct);
      months[m].taxForecastRon = fixedRon + dividendTaxRon + microRon;
    }
    months[m].taxOwedRon = months[m].taxTotalRon + months[m].taxForecastRon;
  }

  /*
   * "Money available": ce a ramas din luna trecuta dupa taxele ei. Se aseaza
   * pe luna urmatoare, pentru ca aia e luna in care ai banii de cheltuit —
   * banii din august, minus taxele lui august, se cheltuie in septembrie.
   */
  for (let m = 1; m < 12; m++) {
    const prev = months[m - 1];
    // Fara incasari in luna trecuta n-are ce sa ramana — nu desenam o bara
    // negativa peste noiembrie doar pentru ca acolo sta un salariu estimat.
    if (prev.earnedUsd <= 0) continue;
    const taxUsd = Math.round(prev.taxOwedRon * settings.fxRonToUsd);
    months[m].availableUsd = prev.earnedUsd - taxUsd;
  }

  return months;
}

/** Daily totals for the current month — for the dashboard sparkline. */
export async function getDailyTotals(year: number, month: number) {
  const expenses = await getMonthExpenses(year, month);
  const days = new Date(year, month, 0).getDate();
  const out: Array<{ day: number; ron: number; usd: number }> = [];
  for (let d = 1; d <= days; d++) out.push({ day: d, ron: 0, usd: 0 });
  for (const e of expenses) {
    if (e.excluded) continue;
    const d = e.date.getDate();
    out[d - 1].ron += e.amountRon;
    out[d - 1].usd += e.amountUsd;
  }
  return out;
}

/**
 * Per-day expense summary for the heatmap tooltip — total + top N items.
 * Limited to non-excluded rows so the heatmap matches the analytics.
 */
export async function getDailyExpenseSummary(year: number, month: number) {
  const expenses = await getMonthExpenses(year, month);
  const days = new Date(year, month, 0).getDate();
  type DayCell = {
    day: number;
    ron: number;
    count: number;
    top: Array<{
      description: string;
      amountRon: number;
      category: string;
      notes: string | null;
    }>;
  };
  const out: DayCell[] = [];
  for (let d = 1; d <= days; d++)
    out.push({ day: d, ron: 0, count: 0, top: [] });
  for (const e of expenses) {
    if (e.excluded) continue;
    const d = e.date.getDate();
    out[d - 1].ron += e.amountRon;
    out[d - 1].count += 1;
    out[d - 1].top.push({
      description: e.description,
      amountRon: e.amountRon,
      category: e.category,
      notes: e.notes,
    });
  }
  for (const cell of out) {
    cell.top.sort((a, b) => b.amountRon - a.amountRon);
    cell.top = cell.top.slice(0, 4);
  }
  return out;
}

export type DailyHeatmapCell = {
  /** Cat din ziua aia a fost platit din contul firmei, in bani. */
  companyRon?: number;
  date: string; // YYYY-MM-DD
  ron: number;
  count: number;
  top: Array<{
    description: string;
    amountRon: number;
    category: string;
    notes: string | null;
  }>;
};

/**
 * Heatmap-shaped view of `getDailyExpenseSummary`: day numbers resolved to ISO
 * dates so the client can key cells by date while navigating between months.
 * Shared by the dashboard RSC (initial month) and /api/expenses/daily (the
 * months fetched on demand when you page backwards).
 */
export async function getDailyHeatmap(
  year: number,
  month: number,
): Promise<DailyHeatmapCell[]> {
  const daily = await getDailyExpenseSummary(year, month);
  const mm = String(month).padStart(2, "0");
  /*
   * Cat din ziua aia a fost platit de pe firma. Heatmap-ul coloreaza dupa
   * total, dar ziua in care singura cheltuiala e o factura de AWS nu se
   * citeste la fel ca una cu cumparaturi — de aia si cifra separata.
   */
  const companyByDay = new Map<number, number>();
  const rows = await db.expense.findMany({
    where: {
      date: { gte: startOfMonth(year, month), lte: endOfMonth(year, month) },
      excluded: false,
      source: "ing",
    },
    select: { date: true, amountRon: true },
  });
  for (const r of rows) {
    const d = r.date.getDate();
    companyByDay.set(d, (companyByDay.get(d) ?? 0) + r.amountRon);
  }

  return daily.map((d) => ({
    date: `${year}-${mm}-${String(d.day).padStart(2, "0")}`,
    ron: d.ron,
    count: d.count,
    top: d.top,
    companyRon: companyByDay.get(d.day) ?? 0,
  }));
}

export type TaxPaidSummary = {
  totalRon: number;                       // bani
  byKind: Array<{ kind: string; label: string; amountRon: number; count: number }>;
  byMonth: Array<{ period: string; amountRon: number }>;
  lastPaidAt: Date | null;
  unassigned: number;                     // bani, plati fara luna in eticheta
};

const TAX_LABELS: Record<string, string> = {
  bs_bas: "BS + BAS",
  dividende: "Impozit dividende",
  venit: "Impozit venit",
  micro: "Impozit micro",
  cam: "CAM",
  tva: "TVA",
  alte: "Alte obligații",
};

/**
 * Taxe chiar platite intr-un an, din extrasul bancar.
 *
 * Perechea proiectiei: aia estimeaza ce vei datora la ritmul curent, asta
 * spune ce a plecat deja din cont si pentru ce luna. Gruparea e pe luna
 * ACOPERITA, nu pe cea a platii — "BS+BAS martie" iese pe 4 mai, iar altfel
 * lunile ar arata mereu decalate.
 */
export async function getTaxPaid(year: number): Promise<TaxPaidSummary> {
  const rows = await db.taxPayment.findMany({
    where: {
      OR: [
        { forPeriod: { startsWith: String(year) } },
        {
          AND: [
            { forPeriod: null },
            {
              paidAt: {
                gte: new Date(Date.UTC(year, 0, 1)),
                lte: new Date(Date.UTC(year, 11, 31, 23, 59, 59)),
              },
            },
          ],
        },
      ],
    },
    orderBy: { paidAt: "asc" },
  });

  const kinds = new Map<string, { amountRon: number; count: number }>();
  const months = new Map<string, number>();
  let unassigned = 0;
  for (const r of rows) {
    const k = kinds.get(r.kind) ?? { amountRon: 0, count: 0 };
    k.amountRon += r.amountRon;
    k.count += 1;
    kinds.set(r.kind, k);
    if (r.forPeriod) months.set(r.forPeriod, (months.get(r.forPeriod) ?? 0) + r.amountRon);
    else unassigned += r.amountRon;
  }

  return {
    totalRon: rows.reduce((a, r) => a + r.amountRon, 0),
    byKind: [...kinds.entries()]
      .map(([kind, v]) => ({ kind, label: TAX_LABELS[kind] ?? kind, ...v }))
      .sort((a, b) => b.amountRon - a.amountRon),
    byMonth: [...months.entries()]
      .map(([period, amountRon]) => ({ period, amountRon }))
      .sort((a, b) => (a.period < b.period ? -1 : 1)),
    lastPaidAt: rows.length ? rows[rows.length - 1].paidAt : null,
    unassigned,
  };
}

export type ClientInvoicingSummary = {
  jobId: string;
  name: string;
  color: string;
  currency: string;
  hoursWorked: number;           // YTD
  hoursThisMonth: number;        // current calendar month
  hoursLastMonth: number;        // previous calendar month
  hoursInvoiced: number;
  hoursOutstanding: number;
  amountInvoiced: number;        // in client's currency (major units, not cents)
  invoiceCount: number;
  lastInvoiceAt: Date | null;
};

/** Label like "Jun" for the current/previous month columns. */
export function monthShort(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short" });
}

/**
 * Per-client aggregates for the invoicing dashboard. "Hours worked" comes
 * from Income (whatever the client logged this year). "Hours invoiced" is
 * the subset that's been linked to an Invoice (Income.invoiceId set).
 * Outstanding = the diff — the hours the user still needs to bill.
 */
export async function getClientInvoicingSummaries(
  year: number,
  ref: Date = new Date(),
): Promise<ClientInvoicingSummary[]> {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59);

  // Current + previous calendar month windows (relative to `ref`). The
  // previous month may sit in December of the prior year, so widen the
  // income fetch lower bound to cover it.
  const curStart = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const curEnd = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
  const prevStart = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
  const prevEnd = new Date(ref.getFullYear(), ref.getMonth(), 0, 23, 59, 59, 999);
  const fetchFrom = prevStart < yearStart ? prevStart : yearStart;
  const inWindow = (d: Date, lo: Date, hi: Date) => d >= lo && d <= hi;

  const [jobs, incomeRows, invoices] = await Promise.all([
    db.job.findMany({ orderBy: { name: "asc" } }),
    db.income.findMany({
      where: {
        jobId: { not: null },
        date: { gte: fetchFrom, lte: yearEnd },
        hours: { not: null },
      },
      select: { jobId: true, hours: true, invoiceId: true, date: true },
    }),
    db.invoice.findMany({
      where: {
        status: { not: "void" },
        jobId: { not: null },
        issuedAt: { gte: yearStart, lte: yearEnd },
      },
      include: { lines: true },
      orderBy: { issuedAt: "desc" },
    }),
  ]);

  const out: ClientInvoicingSummary[] = jobs.map((j) => ({
    jobId: j.id,
    name: j.name,
    color: j.color,
    currency: j.defaultCurrency ?? "USD",
    hoursWorked: 0,
    hoursThisMonth: 0,
    hoursLastMonth: 0,
    hoursInvoiced: 0,
    hoursOutstanding: 0,
    amountInvoiced: 0,
    invoiceCount: 0,
    lastInvoiceAt: null,
  }));

  const byId = new Map(out.map((c) => [c.jobId, c]));

  for (const r of incomeRows) {
    const c = byId.get(r.jobId!);
    if (!c) continue;
    const h = r.hours ?? 0;
    // YTD only counts rows inside the report year (the fetch is widened past
    // it to capture last December for the previous-month column).
    if (inWindow(r.date, yearStart, yearEnd)) c.hoursWorked += h;
    if (r.invoiceId && inWindow(r.date, yearStart, yearEnd)) c.hoursInvoiced += h;
    if (inWindow(r.date, curStart, curEnd)) c.hoursThisMonth += h;
    if (inWindow(r.date, prevStart, prevEnd)) c.hoursLastMonth += h;
  }

  for (const inv of invoices) {
    const c = byId.get(inv.jobId!);
    if (!c) continue;
    c.invoiceCount += 1;
    if (!c.lastInvoiceAt || inv.issuedAt > c.lastInvoiceAt) {
      c.lastInvoiceAt = inv.issuedAt;
    }
    // Match currency to the client's default — invoices in a different
    // currency would skew the total; surface them separately if it ever
    // becomes a pattern.
    if (inv.invoiceCurrency === c.currency) {
      const lineTotal = inv.lines.reduce((a, l) => a + l.amount, 0);
      c.amountInvoiced += lineTotal;
    }
  }

  for (const c of out) {
    c.hoursOutstanding = Math.max(0, c.hoursWorked - c.hoursInvoiced);
  }

  // Default sort: clients with the most outstanding hours first — that's
  // what the user came to this page to see.
  return out.sort((a, b) => b.hoursOutstanding - a.hoursOutstanding);
}

/** YTD totals — used in the Dashboard summary cards. Excluded rows skipped. */
export async function getYtd(year: number) {
  const [expenses, income, settings] = await Promise.all([
    getYearExpenses(year),
    getYearIncome(year),
    getSettings(),
  ]);
  const spentRon = expenses.reduce((a, b) => a + b.amountRon, 0);
  const spentUsd = expenses.reduce((a, b) => a + b.amountUsd, 0);
  const earnedUsd = incomeToUsdCents(income.filter(isCollected), settings);
  // Facturat, dar neincasat inca.
  const outstandingUsd = incomeToUsdCents(
    income.filter((r) => !isCollected(r) && !isUnbilled(r)),
    settings,
  );
  // Ore din calendar care n-au ajuns inca pe nicio factura.
  const unbilledUsd = incomeToUsdCents(income.filter(isUnbilled), settings);
  // Baza pe care se datoreaza impozitul: veniturile FACTURATE, indiferent daca
  // au fost incasate. Micro-ul nu asteapta plata clientului.
  const invoicedUsd = incomeToUsdCents(
    income.filter((r) => !isUnbilled(r)),
    settings,
  );
  return {
    spentRon,
    spentUsd,
    earnedUsd,
    outstandingUsd,
    unbilledUsd,
    invoicedUsd,
    count: expenses.length,
  };
}

export type MonthTotals = {
  spentRon: number;
  spentUsd: number;
  earnedUsd: number;
};

/** Totals for one calendar month — used for MoM deltas. */
/**
 * Totalurile unei luni, optional taiate la o anumita zi.
 *
 * `throughDay` exista pentru comparatia dintre luni: pe 9 septembrie, luna
 * curenta are noua zile in ea, iar luna trecuta are treizeci si una. Puse una
 * langa alta asa, orice luna in curs arata ca o prabusire de 80% — nu pentru
 * ca ai cheltuit mai putin, ci pentru ca inca n-a trecut. Ziua se limiteaza
 * la cate zile are luna comparata: 31 martie fata de februarie inseamna
 * februarie intreg, nu o zi care nu exista.
 */
export async function getMonthTotals(
  year: number,
  month: number,
  throughDay?: number,
): Promise<MonthTotals> {
  const start = startOfMonth(year, month);
  const lastDay = new Date(year, month, 0).getDate();
  const end =
    throughDay == null
      ? endOfMonth(year, month)
      : new Date(year, month - 1, Math.min(throughDay, lastDay), 23, 59, 59, 999);
  const [expenses, income, settings] = await Promise.all([
    db.expense.findMany({
      where: { date: { gte: start, lte: end }, excluded: false },
      select: { amountRon: true, amountUsd: true },
    }),
    db.income.findMany({
      where: { date: { gte: start, lte: end } },
      select: {
        amountUsd: true,
        currency: true,
        hours: true,
        paidVia: true,
        invoice: { select: { status: true } },
      },
    }),
    getSettings(),
  ]);
  return {
    spentRon: expenses.reduce((a, b) => a + b.amountRon, 0),
    spentUsd: expenses.reduce((a, b) => a + b.amountUsd, 0),
    earnedUsd: incomeToUsdCents(income.filter(isCollected), settings),
  };
}

export type TaxProjection = {
  monthsElapsed: number;
  earnedRonProjected: number;     // bani, full year
  spentRonProjected: number;       // bani, full year (operating)
  microTaxRon: number;             // bani
  fixedContribRon: number;         // bani — (BS+BAS + CAM) × 12
  profitBeforeDivRon: number;      // bani
  dividendTaxRon: number;          // bani
  netToOwnerRon: number;           // bani
};

/**
 * End-of-year tax projection for the Romanian micro-SRL setup. We linearly
 * extrapolate YTD numbers to a full year, then apply the standard math from
 * Settings (microPct, dividendePct, bsBasRon, camRon, fxRonToUsd). All
 * outputs are in BANI so the Dashboard can use fmtRon directly.
 *
 * Caveats: the projection assumes the rest of the year matches the run
 * rate. New clients, slowdowns, and one-off expenses will distort it.
 * Best used as "if I keep going at this pace, here's what EOY looks like".
 */
export async function getTaxProjection(
  year: number,
  ref: Date = new Date(),
): Promise<TaxProjection> {
  const [ytd, settings] = await Promise.all([getYtd(year), getSettings()]);

  // Months elapsed including the current partial month — Apr 15 → 3.5.
  const monthIdx = ref.getMonth();        // 0..11
  const dayOfMonth = ref.getDate();
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const monthsElapsed = Math.max(0.1, monthIdx + dayOfMonth / daysInMonth);

  // USD cents → RON bani. fxRonToUsd is RON-per-USD-ish, e.g. 0.2255 means
  // 1 RON ≈ $0.2255, so 1 USD ≈ 1 / 0.2255 RON. Cents × (1 / fx) = bani.
  /*
   * Proiectia de taxe merge pe venitul FACTURAT, nu pe cel incasat: impozitul
   * micro se datoreaza cand emiti factura, nu cand iti intra banii. Cardul de
   * Earned arata incasarile — sunt doua intrebari diferite si e in regula sa
   * dea cifre diferite, atat timp cat scrie pe ele care e care.
   */
  const earnedRonYtd = ytd.invoicedUsd / settings.fxRonToUsd;
  const spentRonYtd = ytd.spentRon;

  const scale = 12 / monthsElapsed;
  const earnedRonProjected = Math.round(earnedRonYtd * scale);
  const spentRonProjected = Math.round(spentRonYtd * scale);

  const microTaxRon = Math.round(earnedRonProjected * settings.microPct);
  const fixedContribRon = (settings.bsBasRon + settings.camRon) * 12;
  const profitBeforeDivRon =
    earnedRonProjected - microTaxRon - spentRonProjected - fixedContribRon;
  const dividendTaxRon = Math.round(
    Math.max(0, profitBeforeDivRon) * settings.dividendePct,
  );
  const netToOwnerRon = profitBeforeDivRon - dividendTaxRon;

  return {
    monthsElapsed,
    earnedRonProjected,
    spentRonProjected,
    microTaxRon,
    fixedContribRon,
    profitBeforeDivRon,
    dividendTaxRon,
    netToOwnerRon,
  };
}

export type NextTaxItem = {
  kind: string;
  label: string;
  amountRon: number; // bani
  note?: string;
};

export type NextTaxPayment = {
  /** Luna acoperita, "2026-08". */
  forPeriod: string;
  periodLabel: string;
  /** Scadenta, 25 a lunii urmatoare. */
  dueDate: Date;
  items: NextTaxItem[];
  totalRon: number;
  /** Dividende nete scoase in luna acoperita — baza impozitului. */
  dividendsRon: number;
  /** Cat din ele au fost deduse din lipsa de eticheta in banca. */
  presumedRon: number;
  /** Ce s-a platit deja pentru luna aia, ca sa nu ceara de doua ori. */
  paidRon: number;
};

/**
 * Cat ai de platit la urmatoarea scadenta.
 *
 * Termenul e 25 a lunii urmatoare celei acoperite. Pana pe 25 inclusiv,
 * urmatoarea plata e cea pentru luna trecuta; dupa, se muta pe luna curenta.
 * Cifrele nu vin dintr-o formula pe venit, ci din ce s-a intamplat efectiv in
 * cont: cat ai scos ca dividende, cat e pachetul salarial, cat ai facturat.
 */
export async function getNextTaxPayment(
  ref: Date = new Date(),
): Promise<NextTaxPayment> {
  const beforeDeadline = ref.getDate() <= 25;
  const covered = new Date(
    ref.getFullYear(),
    ref.getMonth() - (beforeDeadline ? 1 : 0),
    1,
  );
  const year = covered.getFullYear();
  const month = covered.getMonth() + 1;
  const forPeriod = `${year}-${String(month).padStart(2, "0")}`;
  const dueDate = new Date(year, month, 25, 12, 0, 0);

  const [settings, payouts, paid, income] = await Promise.all([
    getSettings(),
    db.companyPayout.findMany({ where: { forPeriod, kind: "dividende" } }),
    db.taxPayment.findMany({ where: { forPeriod } }),
    getYearIncome(year),
  ]);

  const dividendsRon = payouts.reduce((a, p) => a + p.amountRon, 0);
  const presumedRon = payouts
    .filter((p) => p.presumed)
    .reduce((a, p) => a + p.amountRon, 0);
  const paidByKind = new Map<string, number>();
  for (const t of paid) {
    paidByKind.set(t.kind, (paidByKind.get(t.kind) ?? 0) + t.amountRon);
  }

  const items: NextTaxItem[] = [];
  if (!paidByKind.get("bs_bas")) {
    items.push({
      kind: "bs_bas",
      label: "CAS + CASS + impozit pe salariu",
      amountRon: settings.bsBasRon,
    });
  }
  if (!paidByKind.get("cam")) {
    items.push({ kind: "cam", label: "CAM", amountRon: settings.camRon });
  }
  if (dividendsRon > 0 && !paidByKind.get("dividende")) {
    const pct = settings.dividendePct;
    items.push({
      kind: "dividende",
      label: "Impozit pe dividende",
      amountRon: Math.round((dividendsRon * pct) / (1 - pct)),
      note: `${Math.round(pct * 100)}% pe brut = ${(
        (pct / (1 - pct)) * 100
      ).toFixed(2)}% din cei ${Math.round(dividendsRon / 100).toLocaleString(
        "ro-RO",
      )} RON scoși`,
    });
  }

  /*
   * Micro-ul e trimestrial: se plateste pana pe 25 a lunii de dupa trimestru,
   * pe tot ce s-a FACTURAT in cele trei luni. Apare doar cand luna acoperita
   * inchide un trimestru — martie, iunie, septembrie, decembrie.
   */
  if (month % 3 === 0 && !paidByKind.get("micro")) {
    const qStart = month - 2;
    const invoicedUsd = incomeToUsdCents(
      income.filter((r) => {
        const m = r.date.getMonth() + 1;
        return m >= qStart && m <= month && !isUnbilled(r);
      }),
      settings,
    );
    const microRon = Math.round(
      (invoicedUsd / settings.fxRonToUsd) * settings.microPct,
    );
    if (microRon > 0) {
      items.push({
        kind: "micro",
        label: "Impozit micro, trimestrul",
        amountRon: microRon,
        note: `${(settings.microPct * 100).toFixed(0)}% din ce s-a facturat în T${
          month / 3
        }`,
      });
    }
  }

  return {
    forPeriod,
    periodLabel: covered.toLocaleDateString("ro-RO", {
      month: "long",
      year: "numeric",
    }),
    dueDate,
    items,
    totalRon: items.reduce((a, i) => a + i.amountRon, 0),
    dividendsRon,
    presumedRon,
    paidRon: paid.reduce((a, t) => a + t.amountRon, 0),
  };
}
