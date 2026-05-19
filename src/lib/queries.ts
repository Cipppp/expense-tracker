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
  const expenses = await getYearExpenses(year);
  const income = await getYearIncome(year);

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
    months[m].earnedUsd += i.amountUsd;
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

/** YTD totals — used in the Dashboard summary cards. Excluded rows skipped. */
export async function getYtd(year: number) {
  const expenses = await getYearExpenses(year);
  const income = await getYearIncome(year);
  const spentRon = expenses.reduce((a, b) => a + b.amountRon, 0);
  const spentUsd = expenses.reduce((a, b) => a + b.amountUsd, 0);
  const earnedUsd = income.reduce((a, b) => a + b.amountUsd, 0);
  return { spentRon, spentUsd, earnedUsd, count: expenses.length };
}
