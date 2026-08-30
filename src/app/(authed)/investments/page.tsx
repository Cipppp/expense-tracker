import { getPortfolio, recordSnapshot } from "@/lib/investments";
import { getSettings } from "@/lib/queries";
import { Card, CardContent } from "@/components/ui/card";
import { type DisplayCurrency } from "@/lib/format";
import { InvestmentsBoard } from "@/components/investments/investments-board";

export const dynamic = "force-dynamic";

export default async function InvestmentsPage() {
  const [portfolio, settings] = await Promise.all([getPortfolio(), getSettings()]);
  // Snapshotul zilei se scrie la vizitare — nu exista cron aici, iar un rand
  // pe zi e destul pentru graficul de evolutie.
  await recordSnapshot(portfolio).catch(() => {});

  const displayCurrency: DisplayCurrency =
    (settings.displayCurrency as DisplayCurrency) ?? "USD";
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

      <InvestmentsBoard
        portfolio={portfolio}
        displayCurrency={displayCurrency}
        fxRonToUsd={settings.fxRonToUsd}
      />
    </div>
  );
}
