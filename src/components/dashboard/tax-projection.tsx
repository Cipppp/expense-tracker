import { Card, CardContent } from "@/components/ui/card";
import {
  fmtDisplay,
  ronBaniToDisplay,
  type DisplayCurrency,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TaxProjection } from "@/lib/queries";

/**
 * "At this run rate, here's where you'll land at the end of the year"
 * card for the Romanian micro-SRL: projected revenue, the taxes that
 * eat into it, and what's actually left as dividend-net for the owner.
 */
export function TaxProjectionCard({
  projection,
  displayCurrency,
  fxRonToUsd,
}: {
  projection: TaxProjection;
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
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
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
              "font-display text-xl sm:text-2xl tabular-nums",
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

        <p className="mt-4 text-[10px] text-muted-foreground leading-relaxed">
          Net to owner = Revenue − operating expenses − micro tax (1%) − BS+BAS
          + CAM (12 mo) − dividend tax. Linear extrapolation; doesn&apos;t
          account for seasonality or one-offs.
        </p>
      </CardContent>
    </Card>
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
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
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
