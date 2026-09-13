import {
  getDailyHeatmap,
  getMonthlyAggregates,
  getMonthlyCategoryBreakdown,
  getMonthTotals,
  getSettings,
  getNextTaxPayment,
  getTopMerchants,
  getYtd,
} from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { TopMerchants } from "@/components/dashboard/top-merchants";
import { UnifiedMonthlyChart } from "@/components/dashboard/unified-monthly-chart";
import { CalendarHeatmap } from "@/components/dashboard/calendar-heatmap";
import { NextTaxCard } from "@/components/dashboard/next-tax-card";
import { CurrencyToggle } from "@/components/currency-toggle";
import { fmtMonth, type DisplayCurrency } from "@/lib/format";
import { latestNetWorth } from "@/lib/investments";

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
    thisMonth,
    lastMonth,
    netWorth,
    nextTax,
  ] = await Promise.all([
    getSettings(),
    getYtd(year),
    getMonthlyAggregates(year),
    getTopMerchants(year, month, 5),
    getMonthlyCategoryBreakdown(year),
    getDailyHeatmap(year, month),
    getMonthTotals(year, month),
    // Luna trecuta, taiata in aceeasi zi a lunii: pe 9 septembrie comparam cu
    // 1-9 august, nu cu august intreg.
    getMonthTotals(prevYear, prevMonth, now.getDate()),
    latestNetWorth(),
    getNextTaxPayment(),
  ]);
  const startMonth =
    year === settings.startYear ? settings.startMonth : 1;
  const displayCurrency: DisplayCurrency =
    (settings.displayCurrency as DisplayCurrency) ?? "EUR";

  /*
   * Eticheta spune pe fata ce se compara. "vs Aug 2026" langa o luna in curs
   * era o comparatie masluita: noua zile fata de treizeci si una. Acum scrie
   * intervalul, ca sa se vada ca ambele capete sunt taiate la fel.
   */
  const prevLastDay = new Date(prevYear, prevMonth, 0).getDate();
  const throughDay = Math.min(now.getDate(), prevLastDay);
  const comparisonLabel = `1–${throughDay} ${fmtMonth(prevYear, prevMonth)}`;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="eyebrow">
            {now.toLocaleDateString("ro-RO", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </div>
          <h1 className="mt-1.5 text-[30px] sm:text-[44px] leading-[1.02] text-balance">
            Panou
          </h1>
        </div>
        <CurrencyToggle
          value={displayCurrency}
          fxRonToUsd={settings.fxRonToUsd}
        fxEurToUsd={settings.fxEurToUsd}
        />
      </header>

      <SummaryCards
        spentRon={ytd.spentRon}
        earnedUsd={ytd.earnedUsd}
        count={ytd.count}
        thisMonth={thisMonth}
        lastMonth={lastMonth}
        lastMonthLabel={comparisonLabel}
        displayCurrency={displayCurrency}
        fxRonToUsd={settings.fxRonToUsd}
        fxEurToUsd={settings.fxEurToUsd}
        netWorth={
          netWorth
            ? {
                day: netWorth.day,
                stocksRon: netWorth.stocksRon,
                savingsRon: netWorth.savingsRon,
                totalRon: netWorth.totalRon,
              }
            : null
        }
      />

      {/* Row 1: chart + heatmap, side by side, similar natural heights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Defalcare lunară</CardTitle>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              Încasat față de cheltuit, taxe sau categorii — pe lună. Bara punctată e
              ce ți-a rămas din luna trecută, după taxele ei.
            </p>
          </CardHeader>
          <Separator />
          <CardContent className="pt-6">
            <UnifiedMonthlyChart
              monthly={monthly}
              categories={categories}
              fxRonToUsd={settings.fxRonToUsd}
              fxEurToUsd={settings.fxEurToUsd}
              startMonth={startMonth}
              displayCurrency={displayCurrency}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hartă a cheltuielilor</CardTitle>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              Intensitate pe zi — treci cu mouse-ul pentru detalii.
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
              fxEurToUsd={settings.fxEurToUsd}
            />
          </CardContent>
        </Card>
      </div>

      {/* Rândul 2: merchants + ce ai de plătit la următoarea scadență. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Unde s-au dus banii</CardTitle>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              {fmtMonth(year, month)} — ordonat după cât s-a cheltuit.
            </p>
          </CardHeader>
          <Separator />
          <CardContent className="pt-6">
            <TopMerchants
              items={top}
              displayCurrency={displayCurrency}
              fxRonToUsd={settings.fxRonToUsd}
              fxEurToUsd={settings.fxEurToUsd}
            />
          </CardContent>
        </Card>

        <NextTaxCard
          forecast={nextTax}
          displayCurrency={displayCurrency}
          fx={settings}
        />
      </div>
    </div>
  );
}
