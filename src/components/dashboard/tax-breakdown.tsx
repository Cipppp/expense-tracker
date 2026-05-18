"use client";

import { useMemo, useState } from "react";
import { Building2, User, AlertCircle } from "lucide-react";
import { computeRomanianMicroTax } from "@/lib/tax";
import { fmtRon } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function TaxBreakdown({
  earnedUsd,
  fxRonToUsd,
  bsBasRon,
  camRon,
  microPct,
  dividendePct,
  months,
}: {
  earnedUsd: number; // in cents
  fxRonToUsd: number;
  bsBasRon: number;  // in bani
  camRon: number;    // in bani
  microPct: number;
  dividendePct: number;
  months: number;
}) {
  const revenueRon = (earnedUsd / 100) / fxRonToUsd;
  const bsBasMajor = bsBasRon / 100;
  const camMajor = camRon / 100;

  // Interactive extraction input — client state, recomputes live.
  const [extractInput, setExtractInput] = useState("0");
  const t = useMemo(() => {
    const value = Math.max(0, Number(extractInput) || 0);
    return computeRomanianMicroTax({
      revenueRon,
      bsBasRon: bsBasMajor,
      camRon: camMajor,
      microPct,
      dividendePct,
      months,
      dividendsToExtractRon: value,
    });
  }, [extractInput, revenueRon, bsBasMajor, camMajor, microPct, dividendePct, months]);

  return (
    <div className="space-y-5">
      {/* Required SRL taxes */}
      <div>
        <div className="flex items-center gap-1.5 mb-3 text-xs uppercase tracking-wider text-muted-foreground">
          <Building2 className="h-3 w-3" />
          Required taxes — paid by Project CIP SRL
        </div>
        <dl className="space-y-2 text-sm">
          <Row
            label="BS + BAS"
            sub={`${months} mo × ${bsBasMajor.toFixed(0)} RON`}
            value={fmtRon(Math.round(t.bsBasTotal * 100))}
          />
          <Row
            label="CAM"
            sub={`${months} mo × ${camMajor.toFixed(0)} RON`}
            value={fmtRon(Math.round(t.camTotal * 100))}
          />
          <Row
            label="Impozit micro"
            sub={`${(microPct * 100).toFixed(1)}% × revenue`}
            value={fmtRon(Math.round(t.impozitMicro * 100))}
          />
        </dl>
        <div className="mt-3 pt-3 border-t border-border flex items-baseline justify-between">
          <span className="text-sm font-medium">Required taxes total</span>
          <span className="text-sm font-medium tabular-nums text-destructive">
            {fmtRon(Math.round(t.srlRequiredTax * 100))}
          </span>
        </div>
      </div>

      <div className="rounded-md bg-secondary/50 px-4 py-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
          Estimated revenue YTD ·{" "}
          <span className="text-foreground tabular-nums">
            {revenueRon.toLocaleString("ro-RO", { maximumFractionDigits: 0 })} RON
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-sm">Money sitting in SRL</span>
          <span className="font-display text-lg tabular-nums text-success">
            {fmtRon(Math.round(t.moneyInSrlBefore * 100))}
          </span>
        </div>
      </div>

      {/* Extraction calculator */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
          <User className="h-3 w-3" />
          Extract as dividends
        </div>
        <div className="space-y-2">
          <Label
            htmlFor="extract"
            className="sr-only"
          >
            Dividends to extract (RON)
          </Label>
          <div className="relative">
            <Input
              id="extract"
              type="number"
              min="0"
              step="100"
              value={extractInput}
              onChange={(e) => setExtractInput(e.target.value)}
              placeholder="0"
              className="pr-14 num text-lg h-12"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs uppercase tracking-wider text-muted-foreground pointer-events-none">
              RON
            </span>
          </div>
          {t.extractionExceedsCash && (
            <div className="flex items-start gap-1.5 text-xs text-warning-foreground bg-warning/15 rounded-md px-2.5 py-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                You're trying to withdraw more than what's in the SRL ({fmtRon(Math.round(t.moneyInSrlBefore * 100))}).
              </span>
            </div>
          )}
        </div>
        <dl className="space-y-2 text-sm">
          <Row
            label="Impozit dividende"
            sub={`${(dividendePct * 100).toFixed(0)}% withholding`}
            value={fmtRon(Math.round(t.impozitDividende * 100))}
            valueClass="text-destructive"
          />
          <Row
            label="Net to your pocket"
            value={fmtRon(Math.round(t.netToOwner * 100))}
            valueClass="text-success font-medium"
          />
          <Row
            label="Remaining in Project CIP SRL"
            value={fmtRon(Math.round(t.moneyInSrlAfter * 100))}
            valueClass={cn(
              "font-medium",
              t.moneyInSrlAfter < 0 ? "text-destructive" : "text-foreground",
            )}
          />
        </dl>
      </div>
    </div>
  );
}

function Row({
  label,
  sub,
  value,
  valueClass,
}: {
  label: string;
  sub?: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div className="flex flex-col">
        <span>{label}</span>
        {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
      </div>
      <span className={cn("tabular-nums text-muted-foreground", valueClass)}>
        {value}
      </span>
    </div>
  );
}
