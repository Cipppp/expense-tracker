"use client";

import {
  fmtDisplay,
  ronBaniToDisplay,
  type DisplayCurrency,
  type Fx,
} from "@/lib/format";
import { cn } from "@/lib/utils";

export type CalendarEvent = {
  symbol: string;
  date: string;
  dateEnd?: string;
  status: "confirmed" | "estimated" | "disputed";
  kind: "earnings" | "dividend" | "product";
  title: string;
  typicalMove?: number;
  note?: string;
  /** Cât ai în compania asta, în bani RON. 0 = n-ai poziție. */
  exposureRon: number;
  /** Adevărat pentru CFD: expunerea e nominalul, nu banii depuși. */
  leveraged?: boolean;
  color: string;
};

const KIND_LABEL: Record<CalendarEvent["kind"], string> = {
  earnings: "Rezultate",
  dividend: "Dividend",
  product: "Produs",
};

const STATUS: Record<
  CalendarEvent["status"],
  { label: string; className: string }
> = {
  confirmed: { label: "confirmat", className: "text-success" },
  estimated: { label: "estimat", className: "text-muted-foreground" },
  disputed: { label: "dată incertă", className: "text-warning" },
};

/**
 * Calendarul evenimentelor, cu impactul tradus în banii tăi.
 *
 * O listă de date e o listă de date. Ce o face utilă e ultima coloană: „±6%"
 * nu spune nimic până nu devine „±565 $ din ce ai tu în Nvidia". Mărimea vine
 * din istoric; direcția n-o știe nimeni și scrie asta pe card, ca să nu pară
 * altceva.
 */
export function EventsCalendar({
  events,
  displayCurrency,
  fx,
}: {
  events: CalendarEvent[];
  displayCurrency: DisplayCurrency;
  fx: Fx;
}) {
  /*
   * Formatarea se face aici, nu pe server: o functie nu poate trece granita
   * catre o componenta de client. Restul aplicatiei primeste tot asa —
   * moneda plus cursurile — deci si cifrele de aici ies identice cu cele din
   * cardurile de alaturi.
   */
  const fmt = (bani: number) =>
    fmtDisplay(ronBaniToDisplay(bani, displayCurrency, fx), displayCurrency).replace(
      /[.,]\d\d$/,
      "",
    );
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Niciun eveniment programat în perioada următoare.
      </p>
    );
  }

  const today = new Date();
  const months = groupByMonth(events);
  const maxImpact = Math.max(
    ...events.map((e) => (e.exposureRon * (e.typicalMove ?? 0)) / 100),
    1,
  );

  return (
    <div className="space-y-6">
      {months.map(([month, list]) => (
        <section key={month}>
          <div className="eyebrow mb-2.5">{month}</div>
          <div className="space-y-1.5">
            {list.map((e, i) => {
              const impact = (e.exposureRon * (e.typicalMove ?? 0)) / 100;
              const days = daysUntil(e.date, today);
              return (
                <div
                  key={`${e.symbol}-${e.date}-${i}`}
                  className="group relative flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors duration-200 ease-expo hover:bg-secondary/40"
                >
                  {/* bara de intensitate — cât din banii tăi atinge evenimentul */}
                  <span
                    className="absolute inset-y-0 left-0 w-[3px] rounded-l-lg"
                    style={{
                      backgroundColor: e.color,
                      opacity: 0.25 + 0.75 * (impact / maxImpact),
                    }}
                    aria-hidden
                  />

                  <div className="w-[62px] shrink-0 pl-1.5">
                    <div className="font-display text-[17px] leading-none tabular-nums">
                      {dayNum(e.date)}
                      {e.dateEnd && (
                        <span className="text-muted-foreground">–{dayNum(e.dateEnd)}</span>
                      )}
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {days > 0 ? `în ${days} zile` : days === 0 ? "azi" : "trecut"}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums"
                        style={{ backgroundColor: `${e.color}22`, color: e.color }}
                      >
                        {e.symbol}
                      </span>
                      <span className="truncate text-sm">{e.title}</span>
                      <span
                        className={cn("text-[10px] shrink-0", STATUS[e.status].className)}
                      >
                        {STATUS[e.status].label}
                      </span>
                    </div>
                    {e.note && (
                      <p className="mt-1 text-[11px] leading-snug text-muted-foreground/80 line-clamp-2 group-hover:line-clamp-none">
                        {e.note}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 text-right">
                    {e.typicalMove ? (
                      <>
                        <div className="tabular-nums text-sm font-medium">
                          ±{fmt(impact)}
                        </div>
                        <div className="text-[10px] text-muted-foreground tabular-nums">
                          ±{e.typicalMove}% tipic
                          {e.leveraged && " · CFD"}
                        </div>
                      </>
                    ) : (
                      <div className="text-[11px] text-muted-foreground">
                        {KIND_LABEL[e.kind]}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <p className="text-[11px] leading-relaxed text-muted-foreground/70">
        Sumele sunt mărimea tipică a mișcării de o zi, din istoricul
        raportărilor, aplicată pe poziția ta.{" "}
        <span className="text-muted-foreground">Nu au semn</span> — istoricul
        spune cât se mișcă, nu încotro.
      </p>
    </div>
  );
}

function groupByMonth(events: CalendarEvent[]): Array<[string, CalendarEvent[]]> {
  const out = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const label = new Date(`${e.date}T12:00:00Z`).toLocaleDateString("ro-RO", {
      month: "long",
      year: "numeric",
    });
    const list = out.get(label) ?? [];
    list.push(e);
    out.set(label, list);
  }
  return [...out.entries()];
}

function dayNum(iso: string): string {
  return String(Number(iso.slice(8, 10)));
}

function daysUntil(iso: string, from: Date): number {
  const d = new Date(`${iso}T12:00:00Z`).getTime();
  const now = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), 12),
  ).getTime();
  return Math.round((d - now) / 86_400_000);
}
