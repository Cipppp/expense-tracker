import {
  fmtDisplay,
  ronBaniToDisplay,
  type DisplayCurrency,
} from "@/lib/format";

export function TopMerchants({
  items,
  displayCurrency,
  fxRonToUsd,
}: {
  items: Array<{ merchant: string; count: number; amountRon: number; amountUsd: number }>;
  displayCurrency: DisplayCurrency;
  fxRonToUsd: number;
}) {
  const fmt = (bani: number) =>
    fmtDisplay(ronBaniToDisplay(bani, displayCurrency, fxRonToUsd), displayCurrency);
  if (items.length === 0) {
    return (
      <div className="py-6 text-sm text-muted-foreground text-center">
        No expenses yet this month.
      </div>
    );
  }
  const max = Math.max(...items.map((i) => i.amountRon));
  return (
    <ol className="space-y-3">
      {items.map((m, idx) => {
        const pct = max > 0 ? (m.amountRon / max) * 100 : 0;
        return (
          <li key={m.merchant + idx} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex items-center gap-2 truncate">
                <span className="text-xs font-mono text-muted-foreground tabular-nums w-4">
                  {idx + 1}
                </span>
                <span className="text-sm font-medium capitalize truncate">
                  {m.merchant}
                </span>
                <span className="text-[10px] text-muted-foreground">×{m.count}</span>
              </span>
              <span className="text-sm tabular-nums shrink-0 text-foreground">
                {fmt(m.amountRon)}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-accent/80 transition-all ease-expo duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
