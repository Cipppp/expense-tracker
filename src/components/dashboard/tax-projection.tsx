import { Card, CardContent } from "@/components/ui/card";
import {
  fmtDisplay,
  ronBaniToDisplay,
  type DisplayCurrency,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TaxProjection, TaxPaidSummary } from "@/lib/queries";

/**
 * "At this run rate, here's where you'll land at the end of the year"
 * card for the Romanian micro-SRL: projected revenue, the taxes that
 * eat into it, and what's actually left as dividend-net for the owner.
 */
export function TaxProjectionCard({
  projection,
  paid,
  displayCurrency,
  fxRonToUsd,
}: {
  projection: TaxProjection;
  /** Ce a plecat efectiv din cont, din extrasul bancar. */
  paid: TaxPaidSummary;
  displayCurrency: DisplayCurrency;
  fxRonToUsd: number;
}) {
  const fmt = (bani: number) =>
    fmtDisplay(ronBaniToDisplay(bani, displayCurrency, fxRonToUsd), displayCurrency);
  const inRed = projection.netToOwnerRon < 0;
  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-baseline justify-between gap-2 mb-4">
          <div>
            <div className="eyebrow">
              EOY tax projection
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              At your current pace ·{" "}
              <span className="tabular-nums">
                {projection.monthsElapsed.toFixed(1)}mo elapsed
              </span>
            </p>
          </div>
          <div
            className={cn(
              "metric text-[26px] sm:text-[32px] leading-none",
              inRed ? "text-destructive" : "text-success",
            )}
          >
            {fmt(projection.netToOwnerRon)}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <Row
            label="Revenue"
            value={fmt(projection.earnedRonProjected)}
            tone="default"
          />
          <Row
            label="Operating"
            value={`− ${fmt(projection.spentRonProjected)}`}
            tone="muted"
          />
          <Row
            label="Micro tax + fixed"
            value={`− ${fmt(
              projection.microTaxRon + projection.fixedContribRon,
            )}`}
            tone="muted"
          />
          <Row
            label="Dividend tax"
            value={`− ${fmt(projection.dividendTaxRon)}`}
            tone="muted"
          />
        </div>

        {paid.totalRon > 0 && (
          <div className="mt-5 pt-4 border-t border-border">
            <div className="flex items-baseline justify-between gap-3 mb-3">
              <div>
                <div className="eyebrow">Paid so far</div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  From the company statement
                  {paid.lastPaidAt ? (
                    <>
                      {" · last "}
                      <span className="tabular-nums">
                        {paid.lastPaidAt.toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </span>
                    </>
                  ) : null}
                </p>
              </div>
              <div className="metric text-[22px] sm:text-[26px] leading-none">
                {fmt(paid.totalRon)}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {paid.byKind.map((k) => (
                <Row
                  key={k.kind}
                  label={`${k.label} · ${k.count}`}
                  value={fmt(k.amountRon)}
                  tone="muted"
                />
              ))}
            </div>

            {paid.byMonth.length > 0 && (
              <div className="mt-4">
                <div className="eyebrow text-[10px] mb-2">Per month covered</div>
                <MonthBars months={paid.byMonth} fmt={fmt} />
              </div>
            )}
            {paid.unassigned > 0 && (
              <p className="mt-3 text-[10px] text-muted-foreground">
                {fmt(paid.unassigned)} carries no month on the payment label
                (arrears, VAT, stamp duty) — counted in the total, not in the
                bars.
              </p>
            )}
          </div>
        )}

        <p className="mt-4 text-[10px] text-muted-foreground leading-relaxed">
          Net to owner = Revenue − operating expenses − micro tax (1%) − BS+BAS
          + CAM (12 mo) − dividend tax. Linear extrapolation; doesn&apos;t
          account for seasonality or one-offs.
        </p>
      </CardContent>
    </Card>
  );
}

/** O bara pe luna acoperita — nu pe luna platii: "BS+BAS martie" iese pe 4 mai. */
function MonthBars({
  months,
  fmt,
}: {
  months: Array<{ period: string; amountRon: number }>;
  fmt: (bani: number) => string;
}) {
  const max = Math.max(...months.map((m) => m.amountRon), 1);
  return (
    <div className="space-y-1.5">
      {months.map((m) => {
        const [y, mo] = m.period.split("-").map(Number);
        const label = new Date(y, mo - 1, 1).toLocaleDateString("en-US", {
          month: "short",
          year: "2-digit",
        });
        return (
          <div key={m.period} className="flex items-center gap-2.5">
            <span className="text-[10px] text-muted-foreground w-14 shrink-0 tabular-nums">
              {label}
            </span>
            <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-500 ease-expo"
                style={{ width: `${(m.amountRon / max) * 100}%` }}
              />
            </div>
            <span className="text-[10px] tabular-nums w-24 text-right shrink-0">
              {fmt(m.amountRon)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "default" | "muted";
}) {
  return (
    <div>
      <div className="eyebrow text-[10px]">
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 text-sm tabular-nums",
          tone === "muted" ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}
