import {
  getDailyExpenseSummary,
  getMonthlyAggregates,
  getMonthlyCategoryBreakdown,
  getMonthTotals,
  getSettings,
  getTaxProjection,
  getTopMerchants,
  getYtd,
} from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { TaxProjectionCard } from "@/components/dashboard/tax-projection";
import { TopMerchants } from "@/components/dashboard/top-merchants";
import { UnifiedMonthlyChart } from "@/components/dashboard/unified-monthly-chart";
import { CalendarHeatmap } from "@/components/dashboard/calendar-heatmap";
import { fmtMonth } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const prevMonthDate = new Date(year, month - 2, 1);
  const prevYear = prevMonthDate.getFullYear();
  const prevMonth = prevMonthDate.getMonth() + 1;

  const [
    settings,
    ytd,
    monthly,
    top,
    categories,
    daily,
    taxProjection,
    thisMonth,
    lastMonth,
  ] = await Promise.all([
    getSettings(),
    getYtd(year),
    getMonthlyAggregates(year),
    getTopMerchants(year, month, 5),
    getMonthlyCategoryBreakdown(year),
    getDailyExpenseSummary(year, month),
    getTaxProjection(year, now),
    getMonthTotals(year, month),
    getMonthTotals(prevYear, prevMonth),
  ]);
  const dailyForHeatmap = daily.map((d) => ({
    date: `${year}-${String(month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`,
    ron: d.ron,
    count: d.count,
    top: d.top,
  }));

  const startMonth =
    year === settings.startYear ? settings.startMonth : 1;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
            {now.toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </div>
          <h1 className="mt-1 font-display text-2xl sm:text-4xl tracking-tight text-balance">
            Dashboard
          </h1>
        </div>
        <div className="text-right">
          <div className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground">
            FX rate
          </div>
          <div className="font-mono text-xs sm:text-sm">
            1 RON ≈ ${settings.fxRonToUsd.toFixed(4)}
          </div>
        </div>
      </header>

      <SummaryCards
        spentUsd={ytd.spentUsd}
        earnedUsd={ytd.earnedUsd}
        count={ytd.count}
        thisMonth={thisMonth}
        lastMonth={lastMonth}
        lastMonthLabel={fmtMonth(prevYear, prevMonth)}
      />

      <TaxProjectionCard projection={taxProjection} />

      {/* Row 1: chart + heatmap, side by side, similar natural heights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Monthly breakdown</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Switch views to see earned vs spent, taxes, or spending categories
              — all per month.
            </p>
          </CardHeader>
          <Separator />
          <CardContent className="pt-6">
            <UnifiedMonthlyChart
              monthly={monthly}
              categories={categories}
              fxRonToUsd={settings.fxRonToUsd}
              bsBasRon={settings.bsBasRon}
              camRon={settings.camRon}
              microPct={settings.microPct}
              dividendePct={settings.dividendePct}
              startMonth={startMonth}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Spending heatmap</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Intensity per day — hover for a quick look.
            </p>
          </CardHeader>
          <Separator />
          <CardContent className="pt-6">
            <CalendarHeatmap
              year={year}
              month={month}
              daily={dailyForHeatmap}
            />
          </CardContent>
        </Card>
      </div>

      {/* Row 2: merchants + quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Top merchants</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {fmtMonth(year, month)} — sorted by RON spent.
            </p>
          </CardHeader>
          <Separator />
          <CardContent className="pt-6">
            <TopMerchants items={top} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="pt-6 space-y-1">
            <a
              href="/import"
              className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-secondary transition-colors"
            >
              <span>Import Revolut CSV</span>
              <span className="text-xs text-muted-foreground">→</span>
            </a>
            <a
              href="/expenses"
              className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-secondary transition-colors"
            >
              <span>View all expenses</span>
              <span className="text-xs text-muted-foreground">→</span>
            </a>
            <a
              href="/income"
              className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-secondary transition-colors"
            >
              <span>Log income</span>
              <span className="text-xs text-muted-foreground">→</span>
            </a>
            <a
              href="/invoices"
              className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-secondary transition-colors"
            >
              <span>Invoices</span>
              <span className="text-xs text-muted-foreground">→</span>
            </a>
            <a
              href="/settings"
              className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-secondary transition-colors"
            >
              <span>Tax, FX & clients</span>
              <span className="text-xs text-muted-foreground">→</span>
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
