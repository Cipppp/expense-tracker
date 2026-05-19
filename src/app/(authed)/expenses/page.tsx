import {
  getMonthExpenses,
  getSettings,
  getYearCategories,
  getYearExpenses,
  type ExpenseFilters,
  type ExpenseSortField,
  type SortDir,
} from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { baniFromRon, fmtMonth, fmtRon, fmtUsd } from "@/lib/format";
import { MonthFilter } from "@/components/expenses/month-filter";
import { ExpenseFilters as ExpenseFiltersBar } from "@/components/expenses/expense-filters";
import { SortableHeader } from "@/components/expenses/sortable-header";

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

const VALID_SORTS: ExpenseSortField[] = [
  "date",
  "description",
  "category",
  "amountRon",
  "amountUsd",
];

export default async function ExpensesPage(props: {
  searchParams: Promise<{
    year?: string;
    month?: string;
    category?: string;
    minRon?: string;
    maxRon?: string;
    q?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  const params = await props.searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = Number(params.month) || now.getMonth() + 1;

  const sort = VALID_SORTS.includes(params.sort as ExpenseSortField)
    ? (params.sort as ExpenseSortField)
    : "date";
  const dir: SortDir = params.dir === "asc" ? "asc" : "desc";

  const filters: ExpenseFilters = {
    category:
      params.category && params.category !== "all" ? params.category : undefined,
    minRon: params.minRon ? baniFromRon(Number(params.minRon)) : undefined,
    maxRon: params.maxRon ? baniFromRon(Number(params.maxRon)) : undefined,
    q: params.q || undefined,
    sort,
    dir,
  };

  const [settings, monthExp, yearExp, categories] = await Promise.all([
    getSettings(),
    getMonthExpenses(year, month, filters),
    getYearExpenses(year),
    getYearCategories(year),
  ]);

  const dailyTotals = new Map<string, number>();
  for (const e of yearExp) {
    if (e.date.getFullYear() !== year || e.date.getMonth() + 1 !== month) continue;
    const key = e.date.toISOString().slice(0, 10);
    dailyTotals.set(key, (dailyTotals.get(key) ?? 0) + e.amountRon);
  }

  const monthTotalRon = monthExp.reduce((a, b) => a + b.amountRon, 0);
  const monthTotalUsd = monthExp.reduce((a, b) => a + b.amountUsd, 0);
  const yearTotalRon = yearExp.reduce((a, b) => a + b.amountRon, 0);
  const isFiltered = !!(
    filters.category ||
    filters.minRon != null ||
    filters.maxRon != null ||
    filters.q
  );

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
        <CardHeader className="space-y-4 pb-4">
          <div className="flex items-baseline justify-between">
            <CardTitle className="text-lg">All transactions</CardTitle>
            {isFiltered && (
              <Badge variant="accent" className="text-[10px]">
                Filtered
              </Badge>
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground w-[100px]">
                      <SortableHeader field="date" label="Date" defaultDir="desc" />
                    </th>
                    <th className="px-4 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      <SortableHeader
                        field="description"
                        label="Description"
                        defaultDir="asc"
                      />
                    </th>
                    <th className="px-4 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground w-[130px]">
                      <SortableHeader
                        field="category"
                        label="Category"
                        defaultDir="asc"
                      />
                    </th>
                    <th className="px-4 py-2 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground w-[120px]">
                      <SortableHeader
                        field="amountRon"
                        label="RON"
                        align="right"
                        defaultDir="desc"
                      />
                    </th>
                    <th className="px-4 py-2 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground w-[100px]">
                      <SortableHeader
                        field="amountUsd"
                        label="USD"
                        align="right"
                        defaultDir="desc"
                      />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {monthExp.map((e) => {
                    const dayKey = e.date.toISOString().slice(0, 10);
                    const isHotDay =
                      (dailyTotals.get(dayKey) ?? 0) > settings.redThresholdRon;
                    return (
                      <tr
                        key={e.id}
                        className="hover:bg-secondary/40 transition-colors"
                      >
                        <td className="px-4 py-2 whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                          {e.date.toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </td>
                        <td className="px-4 py-2">
                          <span className="font-medium">{e.description}</span>
                        </td>
                        <td className="px-4 py-2">
                          <Badge
                            variant={CATEGORY_COLORS[e.category] ?? "outline"}
                            className="text-[10px] font-normal"
                          >
                            {e.category}
                          </Badge>
                        </td>
                        <td
                          className={`px-4 py-2 text-right tabular-nums whitespace-nowrap ${
                            isHotDay ? "text-destructive" : ""
                          }`}
                        >
                          -{fmtRon(e.amountRon).replace("- ", "")}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                          -{fmtUsd(e.amountUsd).replace("-", "")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
