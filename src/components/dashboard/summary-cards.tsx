import { ArrowDownRight, ArrowUpRight, Receipt, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { fmtRon, fmtUsd } from "@/lib/format";

export function SummaryCards({
  spentRon,
  spentUsd,
  earnedUsd,
  count,
}: {
  spentRon: number;
  spentUsd: number;
  earnedUsd: number;
  count: number;
}) {
  const netUsd = earnedUsd - spentUsd;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Stat
        label="Spent YTD (RON)"
        value={fmtRon(spentRon)}
        accent="destructive"
        icon={<ArrowDownRight className="h-4 w-4" />}
      />
      <Stat
        label="Spent YTD (USD)"
        value={fmtUsd(spentUsd)}
        accent="muted"
      />
      <Stat
        label="Earned YTD"
        value={fmtUsd(earnedUsd)}
        accent="success"
        icon={<ArrowUpRight className="h-4 w-4" />}
      />
      <Stat
        label={netUsd >= 0 ? "Net YTD" : "Net YTD (in red)"}
        value={fmtUsd(netUsd)}
        accent={netUsd >= 0 ? "default" : "destructive"}
        icon={<Wallet className="h-4 w-4" />}
        footer={
          <span className="inline-flex items-center gap-1">
            <Receipt className="h-3 w-3" /> {count} transactions
          </span>
        }
      />
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  icon,
  footer,
}: {
  label: string;
  value: string;
  accent: "default" | "muted" | "success" | "destructive";
  icon?: React.ReactNode;
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
      <CardContent className="p-5">
        <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
          {label}
          <span className={accentClass}>{icon}</span>
        </div>
        <div className={`mt-2 font-display text-2xl tracking-tight num ${accentClass}`}>
          {value}
        </div>
        {footer && (
          <div className="mt-2 text-xs text-muted-foreground">{footer}</div>
        )}
      </CardContent>
    </Card>
  );
}
