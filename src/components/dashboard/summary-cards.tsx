import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Receipt, Wallet } from "@/lib/icons";
import { Card, CardContent } from "@/components/ui/card";
import { fmtDisplay, ronBaniToDisplay, usdCentsToDisplay } from "@/lib/format";
import type { DisplayCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MonthTotals } from "@/lib/queries";

export type NetWorthNow = {
  day: string; // "2026-09-04", ziua din Europe/Bucharest
  stocksRon: number; // bani
  savingsRon: number; // bani
  totalRon: number; // bani
};

export function SummaryCards({
  spentRon,
  earnedUsd,
  count,
  thisMonth,
  lastMonth,
  lastMonthLabel,
  displayCurrency,
  fxRonToUsd,
  fxEurToUsd,
  netWorth,
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
  fxEurToUsd: number;
  /**
   * Banii de acum, din tabul Investments (economii + actiuni), la ultima
   * vizita acolo. NU e Earned − Spent: pe langa cheltuielile din aplicatie
   * mai sunt taxe, dividende, transferuri si tot ce nu trece prin Revolut.
   * Singura cifra care reflecta realitatea e soldul conturilor.
   */
  netWorth: NetWorthNow | null;
}) {
  /*
   * Totul se aduna in bani RON si se converteste O SINGURA DATA la afisare.
   * Amestecul de dinainte — venituri in centi USD minus cheltuieli in centi
   * USD de la import — facea ca "Cheltuit anul ăsta" sa nu se potriveasca cu pagina
   * de cheltuieli, iar netul sa fie calculat din doua unitati diferite.
   */
  const usdToRon = (cents: number) =>
    usdCentsToDisplay(cents, "RON", { fxRonToUsd, fxEurToUsd });
  const fmtRonBani = (bani: number) =>
    fmtDisplay(
      ronBaniToDisplay(bani, displayCurrency, { fxRonToUsd, fxEurToUsd }),
      displayCurrency,
    );
  const fmt = fmtRonBani;

  const earnedRon = usdToRon(earnedUsd);
  const asOf = netWorth
    ? new Date(`${netWorth.day}T12:00:00Z`).toLocaleDateString("ro-RO", {
        day: "numeric",
        month: "short",
      })
    : null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <Stat
        label="Încasat anul ăsta"
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
            fxEurToUsd={fxEurToUsd}
          />
        }
        footer="Facturi plătite anul ăsta, plus încasări fără factură"
      />
      <Stat
        label="Cheltuit anul ăsta"
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
            fxEurToUsd={fxEurToUsd}
          />
        }
        footer={
          <span className="inline-flex items-center gap-1">
            <Receipt className="h-3 w-3" /> {count} tranzacții
          </span>
        }
      />
      {/*
        Al treilea card e soldul real, nu o diferenta. Fara sageata si fara
        "vs luna trecuta", ca sa nu para calculat din primele doua.
      */}
      <Stat
        label="Bani acum"
        value={netWorth ? fmt(netWorth.totalRon) : "—"}
        accent="default"
        icon={<Wallet className="h-4 w-4" />}
        delta={
          netWorth ? (
            <span className="text-muted-foreground tabular-nums">
              {fmt(netWorth.savingsRon)} economii · {fmt(netWorth.stocksRon)} acțiuni
            </span>
          ) : (
            <span className="text-muted-foreground">No snapshot yet</span>
          )
        }
        footer={
          <Link
            href="/investments"
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            {asOf ? `La ${asOf} · din Investiții →` : "Open Investments to compute →"}
          </Link>
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
  fxEurToUsd,
}: {
  now: number;
  prev: number;
  higherIsGood: boolean;
  prevLabel: string;
  displayCurrency: DisplayCurrency;
  fxRonToUsd: number;
  fxEurToUsd: number;
}) {
  // Intrarile vin deja in bani RON, ca sa nu se mai amestece unitatile.
  const fmt = (bani: number) =>
    fmtDisplay(
      ronBaniToDisplay(bani, displayCurrency, { fxRonToUsd, fxEurToUsd }),
      displayCurrency,
    );
  if (prev === 0 && now === 0) {
    return (
      <span className="text-muted-foreground">Fără date față de {prevLabel}</span>
    );
  }
  if (prev === 0) {
    // No baseline to compare against — show this-month only.
    return (
      <span className="text-muted-foreground">
        {fmt(now)} luna asta · new vs {prevLabel}
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
        {fmt(now)} luna asta
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
