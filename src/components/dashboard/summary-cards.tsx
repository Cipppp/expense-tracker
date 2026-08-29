import { ArrowDownRight, ArrowUpRight, Receipt, Wallet } from "@/lib/icons";
import { Card, CardContent } from "@/components/ui/card";
import { fmtDisplay, ronBaniToDisplay, usdCentsToDisplay } from "@/lib/format";
import type { DisplayCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MonthTotals } from "@/lib/queries";

export function SummaryCards({
  spentRon,
  earnedUsd,
  count,
  thisMonth,
  lastMonth,
  lastMonthLabel,
  displayCurrency,
  fxRonToUsd,
}: {
  /** Cheltuielile in bani RON — sursa de adevar. `amountUsd` de pe fiecare
   *  rand e inghetat la cursul din ziua importului, deci reconvertit azi
   *  dadea alta cifra decat /expenses si decat proiectia de taxe. */
  spentRon: number;
  earnedUsd: number;
  count: number;
  thisMonth: MonthTotals;
  lastMonth: MonthTotals;
  lastMonthLabel: string;
  displayCurrency: DisplayCurrency;
  fxRonToUsd: number;
}) {
  /*
   * Totul se aduna in bani RON si se converteste O SINGURA DATA la afisare.
   * Amestecul de dinainte — venituri in centi USD minus cheltuieli in centi
   * USD de la import — facea ca "Spent YTD" sa nu se potriveasca cu pagina
   * de cheltuieli, iar netul sa fie calculat din doua unitati diferite.
   */
  const usdToRon = (cents: number) => usdCentsToDisplay(cents, "RON", fxRonToUsd);
  const fmtRonBani = (bani: number) =>
    fmtDisplay(ronBaniToDisplay(bani, displayCurrency, fxRonToUsd), displayCurrency);
  const fmt = fmtRonBani;

  const earnedRon = usdToRon(earnedUsd);
  const netRon = earnedRon - spentRon;
  const thisNet = usdToRon(thisMonth.earnedUsd) - thisMonth.spentRon;
  const lastNet = usdToRon(lastMonth.earnedUsd) - lastMonth.spentRon;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <Stat
        label="Earned YTD"
        value={fmt(earnedRon)}
        accent="success"
        icon={<ArrowUpRight className="h-4 w-4" />}
        delta={
          <Delta
            now={usdToRon(thisMonth.earnedUsd)}
            prev={usdToRon(lastMonth.earnedUsd)}
            higherIsGood
            prevLabel={lastMonthLabel}
            displayCurrency={displayCurrency}
            fxRonToUsd={fxRonToUsd}
          />
        }
      />
      <Stat
        label="Spent YTD"
        value={fmt(spentRon)}
        accent="destructive"
        icon={<ArrowDownRight className="h-4 w-4" />}
        delta={
          <Delta
            now={thisMonth.spentRon}
            prev={lastMonth.spentRon}
            higherIsGood={false}
            prevLabel={lastMonthLabel}
            displayCurrency={displayCurrency}
            fxRonToUsd={fxRonToUsd}
          />
        }
      />
      <Stat
        label={netRon >= 0 ? "Net YTD" : "Net YTD (in red)"}
        value={fmt(netRon)}
        accent={netRon >= 0 ? "default" : "destructive"}
        icon={<Wallet className="h-4 w-4" />}
        delta={
          <Delta
            now={thisNet}
            prev={lastNet}
            higherIsGood
            prevLabel={lastMonthLabel}
            displayCurrency={displayCurrency}
            fxRonToUsd={fxRonToUsd}
          />
        }
        footer={
          <span className="inline-flex items-center gap-1">
            <Receipt className="h-3 w-3" /> {count} transactions
          </span>
        }
      />
    </div>
  );
}

/**
 * Compares this-month-so-far against the previous full month. Color
 * direction depends on the metric: ↑ on earnings is good (green), ↑ on
 * spending is bad (red).
 */
function Delta({
  now,
  prev,
  higherIsGood,
  prevLabel,
  displayCurrency,
  fxRonToUsd,
}: {
  now: number;
  prev: number;
  higherIsGood: boolean;
  prevLabel: string;
  displayCurrency: DisplayCurrency;
  fxRonToUsd: number;
}) {
  // Intrarile vin deja in bani RON, ca sa nu se mai amestece unitatile.
  const fmt = (bani: number) =>
    fmtDisplay(ronBaniToDisplay(bani, displayCurrency, fxRonToUsd), displayCurrency);
  if (prev === 0 && now === 0) {
    return (
      <span className="text-muted-foreground">No data vs {prevLabel}</span>
    );
  }
  if (prev === 0) {
    // No baseline to compare against — show this-month only.
    return (
      <span className="text-muted-foreground">
        {fmt(now)} this month · new vs {prevLabel}
      </span>
    );
  }
  const delta = (now - prev) / Math.abs(prev);
  const isUp = delta >= 0;
  const isGood = isUp === higherIsGood;
  const arrow = isUp ? "↑" : "↓";
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-muted-foreground tabular-nums">
        {fmt(now)} this month
      </span>
      <span
        className={cn(
          "tabular-nums",
          isGood ? "text-success" : "text-destructive",
        )}
      >
        {arrow} {Math.abs(delta * 100).toFixed(0)}%
      </span>
      <span className="text-muted-foreground">vs {prevLabel}</span>
    </span>
  );
}

function Stat({
  label,
  value,
  accent,
  icon,
  delta,
  footer,
}: {
  label: string;
  value: string;
  accent: "default" | "muted" | "success" | "destructive";
  icon?: React.ReactNode;
  delta?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const accentClass =
    accent === "success"
      ? "text-success"
      : accent === "destructive"
        ? "text-destructive"
        : accent === "muted"
          ? "text-muted-foreground"
          : "text-foreground";
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center justify-between eyebrow">
          {label}
          <span className={accentClass}>{icon}</span>
        </div>
        <div className={`mt-3 metric text-[28px] sm:text-[34px] leading-none ${accentClass}`}>
          {value}
        </div>
        {delta && (
          <div className="mt-3 text-[11px] sm:text-xs leading-snug flex flex-wrap gap-x-1.5">
            {delta}
          </div>
        )}
        {footer && (
          <div className="mt-2 text-[11px] text-muted-foreground">{footer}</div>
        )}
      </CardContent>
    </Card>
  );
}
