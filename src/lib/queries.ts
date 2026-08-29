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
  for (const e of expenses) {
    const m = e.date.getMonth();
    months[m].categories[e.category] =
      (months[m].categories[e.category] ?? 0) + e.amountRon;
  }
  return months;
}

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
    orderBy: { date: "desc" },
  });
}

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

export async function getSettings() {
  return db.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
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
  const [expenses, income, settings] = await Promise.all([
    getYearExpenses(year),
    getYearIncome(year),
    getSettings(),
  ]);

  const months: Array<{
    month: number;
    label: string;
    spentRon: number;
    spentUsd: number;
    earnedUsd: number;
  }> = [];
  for (let m = 1; m <= 12; m++) {
    months.push({
      month: m,
      label: new Date(year, m - 1, 1).toLocaleDateString("en-US", { month: "short" }),
      spentRon: 0,
      spentUsd: 0,
      earnedUsd: 0,
    });
  }

  for (const e of expenses) {
    const m = e.date.getMonth();
    months[m].spentRon += e.amountRon;
    months[m].spentUsd += e.amountUsd;
  }
  for (const i of income) {
    const m = i.date.getMonth();
    months[m].earnedUsd += incomeToUsdCents([i], settings);
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
    top: Array<{ description: string; amountRon: number; category: string }>;
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
    });
  }
  for (const cell of out) {
    cell.top.sort((a, b) => b.amountRon - a.amountRon);
    cell.top = cell.top.slice(0, 4);
  }
  return out;
}

export type DailyHeatmapCell = {
  date: string; // YYYY-MM-DD
  ron: number;
  count: number;
  top: Array<{ description: string; amountRon: number; category: string }>;
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
  return daily.map((d) => ({
    date: `${year}-${mm}-${String(d.day).padStart(2, "0")}`,
    ron: d.ron,
    count: d.count,
    top: d.top,
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
  const earnedUsd = incomeToUsdCents(income, settings);
  return { spentRon, spentUsd, earnedUsd, count: expenses.length };
}

export type MonthTotals = {
  spentRon: number;
  spentUsd: number;
  earnedUsd: number;
};

/** Totals for one calendar month — used for MoM deltas. */
export async function getMonthTotals(
  year: number,
  month: number,
): Promise<MonthTotals> {
  const start = startOfMonth(year, month);
  const end = endOfMonth(year, month);
  const [expenses, income, settings] = await Promise.all([
    db.expense.findMany({
      where: { date: { gte: start, lte: end }, excluded: false },
      select: { amountRon: true, amountUsd: true },
    }),
    db.income.findMany({
      where: { date: { gte: start, lte: end } },
      select: { amountUsd: true, currency: true },
    }),
    getSettings(),
  ]);
  return {
    spentRon: expenses.reduce((a, b) => a + b.amountRon, 0),
    spentUsd: expenses.reduce((a, b) => a + b.amountUsd, 0),
    earnedUsd: incomeToUsdCents(income, settings),
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
  const earnedRonYtd = ytd.earnedUsd / settings.fxRonToUsd;
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
