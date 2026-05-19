"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { fmtRon } from "@/lib/format";
import { cn } from "@/lib/utils";

type DailyTotal = { date: string; ron: number };

export function CalendarHeatmap({
  year: initialYear,
  month: initialMonth,
  daily,
}: {
  year: number;
  month: number;
  daily: DailyTotal[];
}) {
  const [{ year, month }, setRange] = useState({
    year: initialYear,
    month: initialMonth,
  });

  const byDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of daily) m.set(d.date, d.ron);
    return m;
  }, [daily]);

  const cells = useMemo(() => {
    const first = new Date(year, month - 1, 1);
    const startWeekday = (first.getDay() + 6) % 7; // 0 = Monday
    const daysInMonth = new Date(year, month, 0).getDate();
    const grid: Array<{ day: number | null; iso: string | null; value: number }> = [];
    for (let i = 0; i < startWeekday; i++) grid.push({ day: null, iso: null, value: 0 });
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      grid.push({ day: d, iso, value: byDay.get(iso) ?? 0 });
    }
    while (grid.length % 7 !== 0) grid.push({ day: null, iso: null, value: 0 });
    return grid;
  }, [year, month, byDay]);

  const max = useMemo(
    () => cells.reduce((m, c) => (c.value > m ? c.value : m), 0),
    [cells],
  );

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
          const intensity = max > 0 ? c.value / max : 0;
          const opacity = c.value > 0 ? 0.1 + intensity * 0.85 : 0;
          return (
            <Link
              key={i}
              href={`/expenses?year=${year}&month=${month}`}
              prefetch={false}
              className={cn(
                "aspect-square rounded-md flex flex-col items-center justify-center text-[10px] relative group/cell transition-all duration-200 ease-expo",
                c.value > 0 ? "hover:scale-110" : "",
              )}
              style={{
                backgroundColor: c.value > 0 ? `hsl(var(--accent) / ${opacity})` : "hsl(var(--secondary) / 0.4)",
              }}
              title={c.value > 0 ? `${c.day}: ${fmtRon(c.value)}` : `${c.day}: no expenses`}
            >
              <span
                className={cn(
                  "tabular-nums leading-none",
                  intensity > 0.6 ? "text-white font-medium" : "text-foreground",
                )}
              >
                {c.day}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
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
  );
}
