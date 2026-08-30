import { getPortfolio, recordSnapshot } from "@/lib/investments";
import { getSettings } from "@/lib/queries";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { fmtDisplay, ronBaniToDisplay, type DisplayCurrency } from "@/lib/format";
import { InvestmentsBoard } from "@/components/investments/investments-board";

export const dynamic = "force-dynamic";

export default async function InvestmentsPage() {
  const [portfolio, settings] = await Promise.all([getPortfolio(), getSettings()]);
  // Snapshotul zilei se scrie la vizitare — nu exista cron aici, iar un rand
  // pe zi e destul pentru graficul de evolutie.
  await recordSnapshot(portfolio).catch(() => {});
  const snapshots = await db.netWorthSnapshot.findMany({
    orderBy: { day: "asc" },
    take: 120,
  });

  const displayCurrency: DisplayCurrency =
    (settings.displayCurrency as DisplayCurrency) ?? "USD";
  const fmt = (bani: number) =>
    fmtDisplay(
      ronBaniToDisplay(bani, displayCurrency, settings.fxRonToUsd),
      displayCurrency,
    );

  const prev = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null;
  const delta = prev ? portfolio.totalRon - prev.totalRon : null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="eyebrow">
            Investments
            {portfolio.fxDate ? ` · BNR ${portfolio.fxDate}` : ""}
          </div>
          <h1 className="mt-1.5 text-[30px] sm:text-[44px] leading-[1.02]">
            Net worth
          </h1>
        </div>
      </header>

      {portfolio.warnings.length > 0 && (
        <Card>
          <CardContent className="p-4 text-xs text-accent-text dark:text-accent">
            <span className="font-semibold">Check: </span>
            {portfolio.warnings.join(" · ")}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 sm:p-6">
            <div className="eyebrow">Total</div>
            <div className="mt-3 metric text-[28px] sm:text-[34px] leading-none">
              {fmt(portfolio.totalRon)}
            </div>
            <div className="sub">
              {delta === null ? (
                "first snapshot — the trend starts tomorrow"
              ) : (
                <span className={delta >= 0 ? "text-success" : "text-destructive"}>
                  {delta >= 0 ? "+" : ""}
                  {fmt(delta)} vs {prev!.day}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 sm:p-6">
            <div className="eyebrow">Stocks</div>
            <div className="mt-3 metric text-[28px] sm:text-[34px] leading-none">
              {fmt(portfolio.stocksRon)}
            </div>
            <div className="sub">
              {portfolio.holdings.length} position
              {portfolio.holdings.length === 1 ? "" : "s"} · live prices
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 sm:p-6">
            <div className="eyebrow">Savings</div>
            <div className="mt-3 metric text-[28px] sm:text-[34px] leading-none">
              {fmt(portfolio.savingsRon)}
            </div>
            <div className="sub">
              {portfolio.savings.length} account
              {portfolio.savings.length === 1 ? "" : "s"}
            </div>
          </CardContent>
        </Card>
      </div>

      <InvestmentsBoard
        portfolio={portfolio}
        snapshots={snapshots.map((s) => ({ day: s.day, totalRon: s.totalRon }))}
        displayCurrency={displayCurrency}
        fxRonToUsd={settings.fxRonToUsd}
      />
    </div>
  );
}
