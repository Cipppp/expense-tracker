import { getPortfolio, recordSnapshot } from "@/lib/investments";
import { getSettings } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { type DisplayCurrency } from "@/lib/format";
import { InvestmentsBoard } from "@/components/investments/investments-board";
import {
  EventsCalendar,
  type CalendarEvent,
} from "@/components/investments/events-calendar";
import { upcomingEvents } from "@/lib/market-events";

export const dynamic = "force-dynamic";

export default async function InvestmentsPage() {
  const [portfolio, settings] = await Promise.all([getPortfolio(), getSettings()]);
  // Snapshotul zilei se scrie la vizitare — nu exista cron aici, iar un rand
  // pe zi e destul pentru graficul de evolutie.
  await recordSnapshot(portfolio).catch(() => {});

  const displayCurrency: DisplayCurrency =
    (settings.displayCurrency as DisplayCurrency) ?? "EUR";

  /*
   * Calendarul, cu expunerea ta pusa peste fiecare eveniment.
   *
   * Alphabet nu apare la "Pozitii" — e un CFD, iar in Holdings ar fi fost
   * numarat la nominal si ti-ar fi umflat averea. Aici insa nominalul e exact
   * cifra corecta: o miscare de 6% pe Google iti misca 6% din nominal, nu din
   * marja depusa. De-aia il trecem separat, marcat ca fiind cu levier.
   */
  const CFD_GOOGL_NOTIONAL_USD = 2967.57;
  /*
   * Culorile nu se inventeaza aici — se imprumuta de la inelul de alocare de
   * mai jos, care e pe aceeasi pagina. Daca Nvidia e albastra in donut si
   * verde in calendar, nu mai e evident ca vorbim de aceeasi companie.
   *
   * Inelul coloreaza fiecare pozitie in parte, iar Nvidia sta in doua conturi;
   * simbolul primeste culoarea celei mai mari dintre ele, adica felia pe care
   * o vezi prima. Alphabet nu are pozitie, deci ia prima culoare ramasa
   * libera.
   */
  const PALETTE = [
    "hsl(var(--chart-2))",
    "hsl(var(--chart-1))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
    "hsl(var(--action))",
  ];
  const alloc = [...portfolio.holdings]
    .filter((h) => (h.valueRon ?? 0) > 0)
    .sort((a, b) => (b.valueRon ?? 0) - (a.valueRon ?? 0));
  const symbolColor = new Map<string, string>();
  alloc.forEach((h, i) => {
    if (!symbolColor.has(h.symbol)) symbolColor.set(h.symbol, PALETTE[i % PALETTE.length]);
  });
  let spare = alloc.length;
  const colorFor = (symbol: string) => {
    const known = symbolColor.get(symbol);
    if (known) return known;
    const c = PALETTE[spare++ % PALETTE.length];
    symbolColor.set(symbol, c);
    return c;
  };

  const events: CalendarEvent[] = upcomingEvents().map((e) => {
    const held = portfolio.holdings.filter((h) => h.symbol === e.symbol);
    const heldRon = held.reduce((a, h) => a + (h.valueRon ?? 0), 0);
    const cfdRon =
      e.symbol === "GOOGL"
        ? Math.round((CFD_GOOGL_NOTIONAL_USD / (portfolio.usdPerRon ?? settings.fxRonToUsd)) * 100)
        : 0;
    return {
      ...e,
      exposureRon: heldRon + cfdRon,
      leveraged: cfdRon > 0,
      color: colorFor(e.symbol),
    };
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="eyebrow">
            Investments
            {portfolio.fxDate ? ` · BNR ${portfolio.fxDate}` : ""}
          </div>
          <h1 className="mt-1.5 text-[30px] sm:text-[44px] leading-[1.02]">
            Net worth
          </h1>
        </div>
      </header>

      {portfolio.warnings.length > 0 && (
        <Card>
          <CardContent className="p-4 text-xs text-accent-text dark:text-accent">
            <span className="font-semibold">Check: </span>
            {portfolio.warnings.join(" · ")}
          </CardContent>
        </Card>
      )}

      <InvestmentsBoard
        portfolio={portfolio}
        displayCurrency={displayCurrency}
        // Cursul BNR de azi, nu setarea invechita — altfel o suma in USD
        // convertita in RON si inapoi se intoarce cu 1,86% mai mare.
        fxRonToUsd={portfolio.usdPerRon ?? settings.fxRonToUsd}
        fxEurToUsd={settings.fxEurToUsd}
      />

      <Card>
        <CardHeader>
          <CardTitle>Ce urmează</CardTitle>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Evenimentele companiilor din portofoliu, cu cât îți mișcă din bani.
          </p>
        </CardHeader>
        <Separator />
        <CardContent className="pt-6">
          <EventsCalendar
            events={events}
            displayCurrency={displayCurrency}
            fx={{
              fxRonToUsd: portfolio.usdPerRon ?? settings.fxRonToUsd,
              fxEurToUsd: settings.fxEurToUsd,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
