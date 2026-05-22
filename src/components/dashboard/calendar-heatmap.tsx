"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "@/lib/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  fmtDisplay,
  ronBaniToDisplay,
  type DisplayCurrency,
} from "@/lib/format";
import { cn } from "@/lib/utils";

type DailyTotal = {
  date: string;
  ron: number;
  count: number;
  top: Array<{ description: string; amountRon: number; category: string }>;
};

export function CalendarHeatmap({
  year: initialYear,
  month: initialMonth,
  daily,
  displayCurrency,
  fxRonToUsd,
}: {
  year: number;
  month: number;
  daily: DailyTotal[];
  displayCurrency: DisplayCurrency;
  fxRonToUsd: number;
}) {
  const fmtMoney = (bani: number) =>
    fmtDisplay(ronBaniToDisplay(bani, displayCurrency, fxRonToUsd), displayCurrency);
  const [{ year, month }, setRange] = useState({
    year: initialYear,
    month: initialMonth,
  });

  const byDay = useMemo(() => {
    const m = new Map<string, DailyTotal>();
    for (const d of daily) m.set(d.date, d);
    return m;
  }, [daily]);

  const cells = useMemo(() => {
    const first = new Date(year, month - 1, 1);
    const startWeekday = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month, 0).getDate();
    const grid: Array<{ day: number | null; iso: string | null; data: DailyTotal | null }> = [];
    for (let i = 0; i < startWeekday; i++)
      grid.push({ day: null, iso: null, data: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      grid.push({ day: d, iso, data: byDay.get(iso) ?? null });
    }
    while (grid.length % 7 !== 0)
      grid.push({ day: null, iso: null, data: null });
    return grid;
  }, [year, month, byDay]);

  const max = useMemo(
    () => cells.reduce((m, c) => (c.data && c.data.ron > m ? c.data.ron : m), 0),
    [cells],
  );

  const stats = useMemo(() => {
    const withData = cells.filter((c) => c.data && c.data.ron > 0);
    const total = withData.reduce((a, c) => a + (c.data?.ron ?? 0), 0);
    const avg = withData.length > 0 ? total / withData.length : 0;
    return { total, avg, daysWithSpend: withData.length };
  }, [cells]);

  function nav(delta: number) {
    let m = month + delta;
    let y = year;
    while (m < 1) {
      m += 12;
      y -= 1;
    }
    while (m > 12) {
      m -= 12;
      y += 1;
    }
    setRange({ year: y, month: m });
  }

  const title = new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium tabular-nums">{title}</div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => nav(-1)}
            className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => nav(1)}
            className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <div
            key={i}
            className="text-[10px] uppercase tracking-wider text-muted-foreground text-center"
          >
            {d}
          </div>
        ))}
        {cells.map((c, i) => {
          if (!c.day) return <div key={i} className="aspect-square" />;
          const ron = c.data?.ron ?? 0;
          const intensity = max > 0 ? ron / max : 0;
          const opacity = ron > 0 ? 0.1 + intensity * 0.85 : 0;
          const isHot = intensity > 0.6;
          const trigger = (
            <button
              type="button"
              className={cn(
                "aspect-square rounded-md flex flex-col items-center justify-center gap-0.5 relative transition-all duration-200 ease-expo w-full px-0.5",
                ron > 0 ? "hover:scale-110 cursor-pointer" : "cursor-default",
              )}
              style={{
                backgroundColor:
                  ron > 0
                    ? `hsl(var(--accent) / ${opacity})`
                    : "hsl(var(--secondary) / 0.4)",
              }}
            >
              <span
                className={cn(
                  "tabular-nums leading-none text-[10px]",
                  isHot ? "text-white font-medium" : "text-foreground",
                )}
              >
                {c.day}
              </span>
              {ron > 0 && (
                <span
                  className={cn(
                    "tabular-nums leading-none text-[9px]",
                    isHot ? "text-white/85" : "text-muted-foreground",
                  )}
                >
                  {compactRon(ron)}
                </span>
              )}
            </button>
          );

          if (ron === 0) {
            return (
              <div key={i} aria-label={`${c.day}: no expenses`}>
                {trigger}
              </div>
            );
          }

          return (
            <Popover key={i}>
              <PopoverTrigger asChild>{trigger}</PopoverTrigger>
              <PopoverContent
                className="w-72 p-0 overflow-hidden"
                align="center"
                side="top"
              >
                <DayDetail
                  data={c.data!}
                  day={c.day!}
                  year={year}
                  month={month}
                  fmt={fmtMoney}
                />
              </PopoverContent>
            </Popover>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-[10px] text-muted-foreground pt-1">
        {stats.daysWithSpend > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums">
            <span>
              Avg/day · <span className="text-foreground font-medium">{fmtMoney(stats.avg)}</span>
            </span>
            <span>
              Max ·{" "}
              <span className="text-foreground font-medium">{fmtMoney(max)}</span>
            </span>
            <span className="hidden sm:inline">
              Total ·{" "}
              <span className="text-foreground font-medium">
                {fmtMoney(stats.total)}
              </span>
            </span>
          </div>
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          <span>Less</span>
          <div className="flex gap-0.5">
            {[0.1, 0.3, 0.5, 0.7, 0.95].map((o) => (
              <div
                key={o}
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: `hsl(var(--accent) / ${o})` }}
              />
            ))}
          </div>
          <span>More</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact RON formatter for the small heatmap cells. Falls back to whole
 * RON values below 1000 and "Xk" above to fit a 9px font.
 */
function compactRon(bani: number): string {
  const ron = Math.round(bani / 100);
  if (ron < 1000) return String(ron);
  if (ron < 10000) return `${(ron / 1000).toFixed(1)}k`;
  return `${Math.round(ron / 1000)}k`;
}

function DayDetail({
  data,
  day,
  year,
  month,
  fmt,
}: {
  data: DailyTotal;
  day: number;
  year: number;
  month: number;
  fmt: (bani: number) => string;
}) {
  const fmtMoney = fmt;
  const dateLabel = new Date(year, month - 1, day).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <>
      <div className="px-4 pt-3 pb-2 border-b border-border bg-secondary/30">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {dateLabel}
        </div>
        <div className="flex items-baseline justify-between mt-0.5">
          <span className="font-display text-lg tabular-nums">
            {fmtMoney(data.ron)}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {data.count} {data.count === 1 ? "transaction" : "transactions"}
          </span>
        </div>
      </div>
      <ul className="divide-y divide-border/60 max-h-[200px] overflow-y-auto">
        {data.top.map((t, i) => (
          <li
            key={i}
            className="flex items-center justify-between gap-2 px-4 py-2 text-xs"
          >
            <div className="min-w-0">
              <div className="font-medium truncate">{t.description}</div>
              <div className="text-[10px] text-muted-foreground">{t.category}</div>
            </div>
            <span className="tabular-nums font-semibold shrink-0">
              {fmtMoney(t.amountRon)}
            </span>
          </li>
        ))}
      </ul>
      <Link
        href={`/expenses?year=${year}&month=${month}&q=${encodeURIComponent("")}`}
        className="block px-4 py-2 text-[11px] text-accent hover:bg-secondary text-center transition-colors"
      >
        View all transactions for the month →
      </Link>
    </>
  );
}
