import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  fmtDisplay,
  ronBaniToDisplay,
  type DisplayCurrency,
  type Fx,
} from "@/lib/format";
import type { NextTaxPayment } from "@/lib/queries";

/**
 * Ce ai de platit la urmatoarea scadenta, cu bucatile la vedere.
 *
 * Cifra nu vine dintr-o formula pe venit, ci din ce s-a intamplat in cont:
 * cat ai scos ca dividende luna trecuta, pachetul salarial fix, si — o data
 * la trei luni — micro-ul pe ce s-a facturat. De aia are fiecare rand nota
 * lui: cand cifra te surprinde, vrei sa vezi din ce iese, nu sa o crezi.
 */
export function NextTaxCard({
  forecast,
  displayCurrency,
  fx,
}: {
  forecast: NextTaxPayment;
  displayCurrency: DisplayCurrency;
  fx: Fx;
}) {
  const money = (bani: number) =>
    fmtDisplay(ronBaniToDisplay(bani, displayCurrency, fx), displayCurrency);
  const due = forecast.dueDate.toLocaleDateString("ro-RO", {
    day: "numeric",
    month: "long",
  });
  /*
   * Regula se teme de nepotrivirea între server și client la hidratare, dar
   * aici nu există client: e o componentă de server, randată o dată pe cerere.
   * Ceasul e citit exact ca într-o funcție obișnuită.
   */
  // eslint-disable-next-line react-hooks/purity
  const msLeft = forecast.dueDate.getTime() - Date.now();
  const daysLeft = Math.ceil(msLeft / 86_400_000);

  return (
    <Card>
      <CardHeader>
        <CardTitle>De plată pe {due}</CardTitle>
        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
          Pentru {forecast.periodLabel}
          {daysLeft >= 0
            ? daysLeft === 0
              ? " — astăzi"
              : ` — ${daysLeft} ${daysLeft === 1 ? "zi" : "zile"}`
            : " — termen depășit"}
        </p>
      </CardHeader>
      <Separator />
      <CardContent className="pt-6">
        {forecast.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nimic de plătit: tot ce se datora pentru {forecast.periodLabel} apare
            deja ca plătit în extras.
          </p>
        ) : (
          <>
            <div className="metric text-[28px] sm:text-[34px] leading-none">
              {money(forecast.totalRon)}
            </div>
            <ul className="mt-5 space-y-2.5">
              {forecast.items.map((it) => (
                <li key={it.kind} className="text-sm">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-muted-foreground">{it.label}</span>
                    <span className="tabular-nums font-medium shrink-0">
                      {money(it.amountRon)}
                    </span>
                  </div>
                  {it.note && (
                    <div className="text-[11px] text-muted-foreground/70 mt-0.5">
                      {it.note}
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {forecast.paidRon > 0 && (
              <p className="mt-4 text-[11px] text-muted-foreground/70">
                {money(forecast.paidRon)} s-au plătit deja pentru luna asta și
                nu mai apar mai sus.
              </p>
            )}
            {forecast.presumedRon > 0 && (
              <p className="mt-2 text-[11px] text-muted-foreground/70">
                {money(forecast.presumedRon)} din dividende n-aveau descriere în
                bancă și au fost presupuse dividende.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
