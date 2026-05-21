import { ArrowDownRight, ArrowUpRight, Receipt, Wallet } from "@/lib/icons";
import { Card, CardContent } from "@/components/ui/card";
import { fmtUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MonthTotals } from "@/lib/queries";

export function SummaryCards({
  spentUsd,
  earnedUsd,
  count,
  thisMonth,
  lastMonth,
  lastMonthLabel,
}: {
  spentUsd: number;
  earnedUsd: number;
  count: number;
  thisMonth: MonthTotals;
  lastMonth: MonthTotals;
  lastMonthLabel: string;
}) {
  const netUsd = earnedUsd - spentUsd;
  const thisNet = thisMonth.earnedUsd - thisMonth.spentUsd;
  const lastNet = lastMonth.earnedUsd - lastMonth.spentUsd;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <Stat
        label="Earned YTD"
        value={fmtUsd(earnedUsd)}
        accent="success"
        icon={<ArrowUpRight className="h-4 w-4" />}
        delta={
          <Delta
            now={thisMonth.earnedUsd}
            prev={lastMonth.earnedUsd}
            higherIsGood
            prevLabel={lastMonthLabel}
          />
        }
      />
      <Stat
        label="Spent YTD"
        value={fmtUsd(spentUsd)}
        accent="destructive"
        icon={<ArrowDownRight className="h-4 w-4" />}
        delta={
          <Delta
            now={thisMonth.spentUsd}
            prev={lastMonth.spentUsd}
            higherIsGood={false}
            prevLabel={lastMonthLabel}
          />
        }
      />
      <Stat
        label={netUsd >= 0 ? "Net YTD" : "Net YTD (in red)"}
        value={fmtUsd(netUsd)}
        accent={netUsd >= 0 ? "default" : "destructive"}
        icon={<Wallet className="h-4 w-4" />}
        delta={
          <Delta
            now={thisNet}
            prev={lastNet}
            higherIsGood
            prevLabel={lastMonthLabel}
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
}: {
  now: number;
  prev: number;
  higherIsGood: boolean;
  prevLabel: string;
}) {
  if (prev === 0 && now === 0) {
    return (
      <span className="text-muted-foreground">No data vs {prevLabel}</span>
    );
  }
  if (prev === 0) {
    // No baseline to compare against — show this-month only.
    return (
      <span className="text-muted-foreground">
        {fmtUsd(now)} this month · new vs {prevLabel}
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
        {fmtUsd(now)} this month
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
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground">
          {label}
          <span className={accentClass}>{icon}</span>
        </div>
        <div className={`mt-2 font-display text-xl sm:text-2xl tracking-tight num ${accentClass}`}>
          {value}
        </div>
        {delta && (
          <div className="mt-2 text-[10px] sm:text-xs leading-snug flex flex-wrap gap-x-1.5">
            {delta}
          </div>
        )}
        {footer && (
          <div className="mt-2 text-xs text-muted-foreground">{footer}</div>
        )}
      </CardContent>
    </Card>
  );
}
