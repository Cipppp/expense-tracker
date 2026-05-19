import {
  getMonthExpenses,
  getSettings,
  getYearCategories,
  getYearExpenses,
  type ExpenseFilters,
} from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { baniFromRon, fmtDate, fmtMonth, fmtRon, fmtUsd } from "@/lib/format";
import { MonthFilter } from "@/components/expenses/month-filter";
import { ExpenseFilters as ExpenseFiltersBar } from "@/components/expenses/expense-filters";

export const dynamic = "force-dynamic";

const CATEGORY_COLORS: Record<
  string,
  "default" | "accent" | "success" | "warning" | "destructive" | "secondary" | "outline"
> = {
  Food: "accent",
  Groceries: "success",
  Transport: "warning",
  Health: "destructive",
  Bills: "secondary",
  Subscriptions: "secondary",
  Shopping: "accent",
  Transfer: "outline",
  Savings: "outline",
  Other: "outline",
};

export default async function ExpensesPage(props: {
  searchParams: Promise<{
    year?: string;
    month?: string;
    category?: string;
    minRon?: string;
    maxRon?: string;
    q?: string;
  }>;
}) {
  const params = await props.searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = Number(params.month) || now.getMonth() + 1;

  const filters: ExpenseFilters = {
    category: params.category && params.category !== "all" ? params.category : undefined,
    minRon: params.minRon ? baniFromRon(Number(params.minRon)) : undefined,
    maxRon: params.maxRon ? baniFromRon(Number(params.maxRon)) : undefined,
    q: params.q || undefined,
  };

  const [settings, monthExp, yearExp, categories] = await Promise.all([
    getSettings(),
    getMonthExpenses(year, month, filters),
    getYearExpenses(year),
    getYearCategories(year),
  ]);

  // Highlight rows where the day total (unfiltered) exceeds the red threshold.
  const dailyTotals = new Map<string, number>();
  for (const e of yearExp) {
    if (e.date.getFullYear() !== year || e.date.getMonth() + 1 !== month) continue;
    const key = e.date.toISOString().slice(0, 10);
    dailyTotals.set(key, (dailyTotals.get(key) ?? 0) + e.amountRon);
  }

  const monthTotalRon = monthExp.reduce((a, b) => a + b.amountRon, 0);
  const monthTotalUsd = monthExp.reduce((a, b) => a + b.amountUsd, 0);
  const yearTotalRon = yearExp.reduce((a, b) => a + b.amountRon, 0);
  const isFiltered = !!(filters.category || filters.minRon != null || filters.maxRon != null || filters.q);

  return (
    <div className="space-y-8">
      <header>
        <div className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
          Expenses
        </div>
        <h1 className="mt-1 font-display text-4xl tracking-tight">
          {fmtMonth(year, month)}
        </h1>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <MonthFilter year={year} month={month} />
        <div className="flex items-center gap-6 text-sm">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              {isFiltered ? "Filtered total" : "Month total"}
            </div>
            <div className="font-display text-lg tabular-nums">
              {fmtRon(monthTotalRon)}
            </div>
            <div className="text-xs text-muted-foreground tabular-nums">
              ≈ {fmtUsd(monthTotalUsd)} · {monthExp.length} txn
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Year total
            </div>
            <div className="font-display text-lg tabular-nums">
              {fmtRon(yearTotalRon)}
            </div>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex items-baseline justify-between">
            <CardTitle className="text-lg">All transactions</CardTitle>
            {isFiltered && (
              <Badge variant="accent" className="text-[10px]">Filtered</Badge>
            )}
          </div>
          <ExpenseFiltersBar
            categories={categories}
            initial={{
              category: params.category ?? "all",
              minRon: params.minRon ?? "",
              maxRon: params.maxRon ?? "",
              q: params.q ?? "",
            }}
          />
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          {monthExp.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-muted-foreground">
              {isFiltered ? (
                <>No transactions match your filters this month.</>
              ) : (
                <>
                  No expenses for this month yet.{" "}
                  <a
                    className="text-accent underline-offset-4 hover:underline"
                    href="/import"
                  >
                    Import a Revolut CSV
                  </a>{" "}
                  to get started.
                </>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[140px]">Category</TableHead>
                  <TableHead className="text-right w-[140px]">RON</TableHead>
                  <TableHead className="text-right w-[120px]">USD</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthExp.map((e) => {
                  const dayKey = e.date.toISOString().slice(0, 10);
                  const isHotDay =
                    (dailyTotals.get(dayKey) ?? 0) > settings.redThresholdRon;
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="text-muted-foreground text-xs num">
                        {fmtDate(e.date)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{e.description}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={CATEGORY_COLORS[e.category] ?? "outline"}>
                          {e.category}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={`text-right num font-medium ${
                          isHotDay ? "text-destructive" : "text-foreground"
                        }`}
                      >
                        - {fmtRon(e.amountRon).replace("- ", "")}
                      </TableCell>
                      <TableCell className="text-right num text-muted-foreground">
                        - {fmtUsd(e.amountUsd).replace("-", "")}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
