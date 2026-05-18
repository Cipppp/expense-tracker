import {
  getMonthlyAggregates,
  getSettings,
  getTopMerchants,
  getYtd,
} from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { MonthlyChart } from "@/components/dashboard/monthly-chart";
import { TopMerchants } from "@/components/dashboard/top-merchants";
import { TaxBreakdown } from "@/components/dashboard/tax-breakdown";
import { fmtMonth } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [settings, ytd, monthly, top] = await Promise.all([
    getSettings(),
    getYtd(year),
    getMonthlyAggregates(year),
    getTopMerchants(year, month, 5),
  ]);

  // Count active months for tax math (from start month → now).
  const startMonth =
    year === settings.startYear ? settings.startMonth : 1;
  const months = Math.max(1, month - startMonth + 1);

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
            {now.toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </div>
          <h1 className="mt-1 font-display text-4xl tracking-tight text-balance">
            Dashboard
          </h1>
        </div>
        <div className="hidden md:block text-right">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            FX rate
          </div>
          <div className="font-mono text-sm">
            1 RON ≈ ${settings.fxRonToUsd.toFixed(4)}
          </div>
        </div>
      </header>

      <SummaryCards
        spentRon={ytd.spentRon}
        spentUsd={ytd.spentUsd}
        earnedUsd={ytd.earnedUsd}
        count={ytd.count}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Monthly breakdown</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Spent vs earned, by month, in USD.
              </p>
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="pt-6">
            <MonthlyChart data={monthly} />
          </CardContent>
        </Card>

        <Card>
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Tax & dividends calculator</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Required taxes paid by the SRL, plus a what-if calculator for
              extracting dividends to your personal account.
            </p>
          </CardHeader>
          <Separator />
          <CardContent className="pt-6">
            <TaxBreakdown
              earnedUsd={ytd.earnedUsd}
              fxRonToUsd={settings.fxRonToUsd}
              bsBasRon={settings.bsBasRon}
              camRon={settings.camRon}
              microPct={settings.microPct}
              dividendePct={settings.dividendePct}
              months={months}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="pt-6 space-y-2">
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
              href="/settings"
              className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-secondary transition-colors"
            >
              <span>Tax & FX settings</span>
              <span className="text-xs text-muted-foreground">→</span>
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
