import { computeRomanianMicroTax } from "@/lib/tax";
import { fmtRon } from "@/lib/format";

export function TaxBreakdown({
  earnedUsd,
  fxRonToUsd,
  bsBasRon,
  camRon,
  microPct,
  dividendePct,
  months,
}: {
  earnedUsd: number;        // in cents
  fxRonToUsd: number;
  bsBasRon: number;          // in bani
  camRon: number;            // in bani
  microPct: number;
  dividendePct: number;
  months: number;
}) {
  const earnedRonMajor = (earnedUsd / 100) / fxRonToUsd;
  const t = computeRomanianMicroTax({
    revenueRon: earnedRonMajor,
    bsBasRon: bsBasRon / 100,
    camRon: camRon / 100,
    microPct,
    dividendePct,
    months,
  });

  const rows: Array<[string, number, string?]> = [
    ["BS + BAS", t.bsBasTotal, `${months}× ${(bsBasRon / 100).toFixed(0)} RON`],
    ["CAM", t.camTotal, `${months}× ${(camRon / 100).toFixed(0)} RON`],
    ["Impozit micro", t.impozitMicro, `${(microPct * 100).toFixed(1)}% × venit`],
    ["Impozit dividende", t.impozitDividende, `${(dividendePct * 100).toFixed(0)}% × profit`],
  ];

  return (
    <div className="space-y-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        Estimated revenue · {earnedRonMajor.toLocaleString("ro-RO", { maximumFractionDigits: 0 })} RON
      </div>
      <dl className="space-y-2">
        {rows.map(([label, value, sub]) => (
          <div key={label} className="flex items-baseline justify-between">
            <dt className="flex flex-col">
              <span className="text-sm">{label}</span>
              {sub && (
                <span className="text-[10px] text-muted-foreground">{sub}</span>
              )}
            </dt>
            <dd className="text-sm tabular-nums text-muted-foreground">
              {fmtRon(Math.round(value * 100))}
            </dd>
          </div>
        ))}
      </dl>
      <div className="border-t border-border pt-3 space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium">Total tax</span>
          <span className="text-sm font-medium tabular-nums text-destructive">
            {fmtRon(Math.round(t.totalTax * 100))}
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="font-display text-base">Net</span>
          <span className="font-display text-lg tabular-nums text-success">
            {fmtRon(Math.round(t.netRon * 100))}
          </span>
        </div>
      </div>
    </div>
  );
}
