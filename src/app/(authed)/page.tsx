import {
  getDailyHeatmap,
  getMonthlyAggregates,
  getMonthlyCategoryBreakdown,
  getMonthTotals,
  getSettings,
  getTaxPaid,
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
import { CurrencyToggle } from "@/components/currency-toggle";
import { fmtMonth, type DisplayCurrency } from "@/lib/format";

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
    taxPaid,
    thisMonth,
    lastMonth,
  ] = await Promise.all([
    getSettings(),
    getYtd(year),
    getMonthlyAggregates(year),
    getTopMerchants(year, month, 5),
    getMonthlyCategoryBreakdown(year),
    getDailyHeatmap(year, month),
    getTaxProjection(year, now),
    getTaxPaid(year),
    getMonthTotals(year, month),
    getMonthTotals(prevYear, prevMonth),
  ]);
  const startMonth =
    year === settings.startYear ? settings.startMonth : 1;
  const displayCurrency: DisplayCurrency =
    (settings.displayCurrency as DisplayCurrency) ?? "USD";

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="eyebrow">
            {now.toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </div>
          <h1 className="mt-1.5 text-[30px] sm:text-[44px] leading-[1.02] text-balance">
            Dashboard
          </h1>
        </div>
        <CurrencyToggle
          value={displayCurrency}
          fxRonToUsd={settings.fxRonToUsd}
        />
      </header>

      <SummaryCards
        spentRon={ytd.spentRon}
        earnedUsd={ytd.earnedUsd}
        count={ytd.count}
        thisMonth={thisMonth}
        lastMonth={lastMonth}
        lastMonthLabel={fmtMonth(prevYear, prevMonth)}
        displayCurrency={displayCurrency}
        fxRonToUsd={settings.fxRonToUsd}
      />

      <TaxProjectionCard
        projection={taxProjection}
        paid={taxPaid}
        displayCurrency={displayCurrency}
        fxRonToUsd={settings.fxRonToUsd}
      />

      {/* Row 1: chart + heatmap, side by side, similar natural heights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Monthly breakdown</CardTitle>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
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
              displayCurrency={displayCurrency}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Spending heatmap</CardTitle>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              Intensity per day — hover for a quick look.
            </p>
          </CardHeader>
          <Separator />
          <CardContent className="pt-6">
            <CalendarHeatmap
              year={year}
              month={month}
              daily={daily}
              displayCurrency={displayCurrency}
              fxRonToUsd={settings.fxRonToUsd}
            />
          </CardContent>
        </Card>
      </div>

      {/* Row 2: merchants + quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Top merchants</CardTitle>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              {fmtMonth(year, month)} — sorted by amount spent.
            </p>
          </CardHeader>
          <Separator />
          <CardContent className="pt-6">
            <TopMerchants
              items={top}
              displayCurrency={displayCurrency}
              fxRonToUsd={settings.fxRonToUsd}
            />
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
