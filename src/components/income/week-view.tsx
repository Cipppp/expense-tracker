"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  TimeEntryDialog,
  makeEmptyDraft,
  type EntryDraft,
  type JobOpt,
} from "@/components/income/time-entry-dialog";
import {
  fmtDuration,
  fmtUsd,
  localISODate,
  minutesToTime,
  weekDates,
} from "@/lib/format";
import { cn } from "@/lib/utils";

export type WeekEntry = {
  id: string;
  date: string;          // yyyy-mm-dd (local)
  jobId: string | null;
  jobName: string;
  jobColor: string;
  startMinutes: number | null;
  endMinutes: number | null;
  hours: number;
  amountUsd: number;
  description: string;
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function WeekView({
  anchorIso,
  entries,
  jobs,
}: {
  anchorIso: string; // yyyy-mm-dd of any day in the target week
  entries: WeekEntry[];
  jobs: JobOpt[];
}) {
  const router = useRouter();
  const anchor = useMemo(() => new Date(`${anchorIso}T12:00:00`), [anchorIso]);
  const days = useMemo(() => weekDates(anchor), [anchor]);
  const todayIso = localISODate(new Date());

  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<EntryDraft | null>(null);

  function openNew(date: Date) {
    setDraft(makeEmptyDraft(date));
    setDialogOpen(true);
  }
  function openEdit(e: WeekEntry) {
    setDraft({
      id: e.id,
      date: e.date,
      jobId: e.jobId,
      startMinutes: e.startMinutes ?? 9 * 60,
      endMinutes: e.endMinutes ?? 13 * 60,
      description: e.description,
    });
    setDialogOpen(true);
  }

  function navWeek(delta: number) {
    const d = new Date(anchor);
    d.setDate(d.getDate() + delta * 7);
    router.push(`/income?week=${localISODate(d)}`);
  }

  const byDay = useMemo(() => {
    const m = new Map<string, WeekEntry[]>();
    for (const e of entries) {
      const arr = m.get(e.date) ?? [];
      arr.push(e);
      m.set(e.date, arr);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => (a.startMinutes ?? 0) - (b.startMinutes ?? 0));
    }
    return m;
  }, [entries]);

  const weekTotals = useMemo(() => {
    const hours = entries.reduce((a, b) => a + b.hours, 0);
    const usd = entries.reduce((a, b) => a + b.amountUsd, 0);
    const perClient = new Map<string, { name: string; color: string; hours: number; usd: number }>();
    for (const e of entries) {
      const key = e.jobId ?? e.jobName;
      const cur =
        perClient.get(key) ??
        { name: e.jobName, color: e.jobColor, hours: 0, usd: 0 };
      cur.hours += e.hours;
      cur.usd += e.amountUsd;
      perClient.set(key, cur);
    }
    return { hours, usd, perClient: Array.from(perClient.values()) };
  }, [entries]);

  const weekLabel = `${days[0].toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  })} – ${days[6].toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navWeek(-1)}
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="px-3 text-sm font-medium tabular-nums">{weekLabel}</div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => navWeek(1)}
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/income?week=${todayIso}`)}
            className="ml-2"
          >
            Today
          </Button>
        </div>

        <div className="flex items-center gap-6 text-sm">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Week
            </div>
            <div className="font-display text-lg tabular-nums">
              {fmtDuration(weekTotals.hours)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Earned
            </div>
            <div className="font-display text-lg tabular-nums text-success">
              {fmtUsd(weekTotals.usd)}
            </div>
          </div>
        </div>
      </div>

      {/* 7-day grid */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
        {days.map((d, i) => {
          const iso = localISODate(d);
          const dayEntries = byDay.get(iso) ?? [];
          const isToday = iso === todayIso;
          const dayHours = dayEntries.reduce((a, b) => a + b.hours, 0);
          return (
            <Card
              key={iso}
              className={cn(
                "overflow-hidden transition-all duration-200 ease-expo group/day",
                isToday && "ring-1 ring-accent",
              )}
            >
              <CardContent className="p-3 flex flex-col gap-2 min-h-[140px]">
                <header className="flex items-baseline justify-between">
                  <div>
                    <div
                      className={cn(
                        "text-[10px] uppercase tracking-wider",
                        isToday ? "text-accent" : "text-muted-foreground",
                      )}
                    >
                      {DAY_LABELS[i]}
                    </div>
                    <div
                      className={cn(
                        "font-display text-xl leading-none tabular-nums",
                        isToday && "text-accent",
                      )}
                    >
                      {d.getDate()}
                    </div>
                  </div>
                  {dayHours > 0 && (
                    <div className="text-[10px] tabular-nums text-muted-foreground">
                      {fmtDuration(dayHours)}
                    </div>
                  )}
                </header>
                <div className="flex-1 space-y-1">
                  {dayEntries.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => openEdit(e)}
                      className="w-full text-left rounded-md border border-transparent hover:border-border px-2 py-1.5 transition-colors duration-200 ease-expo"
                      style={{ backgroundColor: `${e.jobColor}15` }}
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-1.5 w-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: e.jobColor }}
                        />
                        <span className="text-[11px] font-medium truncate flex-1">
                          {e.jobName}
                        </span>
                        <span className="text-[10px] tabular-nums text-muted-foreground">
                          {fmtDuration(e.hours)}
                        </span>
                      </div>
                      {e.startMinutes != null && e.endMinutes != null && (
                        <div className="text-[10px] text-muted-foreground tabular-nums mt-0.5 ml-3">
                          {minutesToTime(e.startMinutes)}–{minutesToTime(e.endMinutes)}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => openNew(d)}
                  className="mt-auto flex items-center justify-center gap-1 text-xs text-muted-foreground rounded-md border border-dashed border-border py-1.5 opacity-0 group-hover/day:opacity-100 hover:text-accent hover:border-accent transition-all duration-200 ease-expo focus:opacity-100"
                >
                  <Plus className="h-3 w-3" />
                  Add
                </button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Per-client breakdown */}
      {weekTotals.perClient.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
              This week by client
            </div>
            <div className="space-y-2">
              {weekTotals.perClient
                .sort((a, b) => b.hours - a.hours)
                .map((c) => (
                  <div
                    key={c.name}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: c.color }}
                      />
                      <span className="text-sm font-medium truncate">{c.name}</span>
                    </div>
                    <div className="flex items-baseline gap-3 tabular-nums text-sm">
                      <span className="text-muted-foreground">
                        {fmtDuration(c.hours)}
                      </span>
                      <span className="text-foreground font-medium min-w-[64px] text-right">
                        {fmtUsd(c.usd)}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {jobs.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            You don&apos;t have any clients yet. Add one in{" "}
            <Link
              href="/settings"
              className="text-accent underline-offset-4 hover:underline"
            >
              Settings → Clients
            </Link>{" "}
            to start logging time.
          </CardContent>
        </Card>
      )}

      <TimeEntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        draft={draft}
        jobs={jobs}
      />
    </>
  );
}
