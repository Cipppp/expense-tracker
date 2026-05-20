"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  TimeEntryDialog,
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
  date: string;
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

// Hour range shown on the grid. Tweak as your day shifts.
// END_HOUR can exceed 24 — hours past midnight render in the same day's
// column (so an entry 18:00→02:00 stays on the day it started).
const START_HOUR = 6;
const END_HOUR = 26; // shows 06:00 → 02:00 next day
const HOURS = END_HOUR - START_HOUR;
const ROW_PX = 52; // 1h = 52px → 15min = 13px
const SLOT_MIN = 15; // snap to 15-minute slots

function snap(minutes: number): number {
  return Math.round(minutes / SLOT_MIN) * SLOT_MIN;
}
function topFromMin(min: number): number {
  return ((min - START_HOUR * 60) / 60) * ROW_PX;
}
function minFromY(y: number): number {
  return Math.max(START_HOUR * 60, START_HOUR * 60 + (y / ROW_PX) * 60);
}

type LaidOutEntry = WeekEntry & { laneIndex: number; totalLanes: number };

/**
 * Google Calendar-style overlap layout: entries that overlap in time are
 * grouped, then packed greedily into lanes within their group. Each entry
 * gets `laneIndex` (0..totalLanes-1) so the renderer can compute
 *   left = (laneIndex / totalLanes) * 100%
 *   width = (1 / totalLanes) * 100%
 * Result: N overlapping jobs render side-by-side at 1/N width each — no
 * occlusion regardless of N.
 */
function layoutDay(entries: WeekEntry[]): LaidOutEntry[] {
  // 1. Sort by start, then by length desc so longer entries pack first.
  const sorted = [...entries].sort((a, b) => {
    const sa = a.startMinutes ?? 0;
    const sb = b.startMinutes ?? 0;
    if (sa !== sb) return sa - sb;
    const la = (a.endMinutes ?? 0) - (a.startMinutes ?? 0);
    const lb = (b.endMinutes ?? 0) - (b.startMinutes ?? 0);
    return lb - la;
  });

  // 2. Group transitively-overlapping entries together. A new entry joins an
  // existing group if it overlaps with that group's union time range.
  type Group = {
    entries: WeekEntry[];
    minStart: number;
    maxEnd: number;
  };
  const groups: Group[] = [];
  for (const e of sorted) {
    const start = e.startMinutes ?? 0;
    const end = e.endMinutes ?? 0;
    const target = groups.find(
      (g) => start < g.maxEnd && end > g.minStart,
    );
    if (target) {
      target.entries.push(e);
      target.minStart = Math.min(target.minStart, start);
      target.maxEnd = Math.max(target.maxEnd, end);
    } else {
      groups.push({ entries: [e], minStart: start, maxEnd: end });
    }
  }

  // 3. Within each group, pack greedily into lanes: assign each entry to the
  // first lane whose last entry has already ended.
  const result: LaidOutEntry[] = [];
  for (const g of groups) {
    const laneEnds: number[] = []; // end-min of the latest entry in each lane
    const laneOf = new Map<string, number>();
    for (const e of g.entries) {
      const start = e.startMinutes ?? 0;
      const end = e.endMinutes ?? 0;
      let lane = laneEnds.findIndex((le) => le <= start);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(end);
      } else {
        laneEnds[lane] = end;
      }
      laneOf.set(e.id, lane);
    }
    const totalLanes = laneEnds.length;
    for (const e of g.entries) {
      result.push({
        ...e,
        laneIndex: laneOf.get(e.id) ?? 0,
        totalLanes,
      });
    }
  }
  return result;
}

export function WeekGrid({
  anchorIso,
  entries,
  jobs,
}: {
  anchorIso: string;
  entries: WeekEntry[];
  jobs: JobOpt[];
}) {
  const router = useRouter();
  const anchor = useMemo(() => new Date(`${anchorIso}T12:00:00`), [anchorIso]);
  const days = useMemo(() => weekDates(anchor), [anchor]);
  const todayIso = localISODate(new Date());

  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<EntryDraft | null>(null);

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
      if (e.startMinutes == null || e.endMinutes == null) continue;
      const arr = m.get(e.date) ?? [];
      arr.push(e);
      m.set(e.date, arr);
    }
    return m;
  }, [entries]);

  const weekTotals = useMemo(() => {
    const hours = entries.reduce((a, b) => a + b.hours, 0);
    const usd = entries.reduce((a, b) => a + b.amountUsd, 0);
    const perClient = new Map<
      string,
      { name: string; color: string; hours: number; usd: number }
    >();
    for (const e of entries) {
      const key = e.jobId ?? e.jobName;
      const cur =
        perClient.get(key) ?? { name: e.jobName, color: e.jobColor, hours: 0, usd: 0 };
      cur.hours += e.hours;
      cur.usd += e.amountUsd;
      perClient.set(key, cur);
    }
    return {
      hours,
      usd,
      perClient: Array.from(perClient.values()).sort((a, b) => b.hours - a.hours),
    };
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

      <Card>
        <CardContent className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Day header */}
              <div
                className="grid border-b border-border bg-card"
                style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}
              >
                <div />
                {days.map((d, i) => {
                  const iso = localISODate(d);
                  const isToday = iso === todayIso;
                  const dayHours = (byDay.get(iso) ?? []).reduce(
                    (a, b) => a + b.hours,
                    0,
                  );
                  return (
                    <div
                      key={iso}
                      className={cn(
                        "border-l border-border px-3 py-2.5",
                        isToday && "bg-accent/5",
                      )}
                    >
                      <div className="flex items-baseline justify-between gap-1">
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
                              "font-display text-lg leading-tight tabular-nums",
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
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Grid body */}
              <div
                className="grid relative"
                style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}
              >
                {/* Hour labels */}
                <div className="border-r border-border">
                  {Array.from({ length: HOURS }).map((_, i) => (
                    <div
                      key={i}
                      className="text-[10px] text-muted-foreground pr-2 pt-1 text-right tabular-nums"
                      style={{ height: ROW_PX }}
                    >
                      {String((START_HOUR + i) % 24).padStart(2, "0")}:00
                    </div>
                  ))}
                </div>

                {/* Day columns */}
                {days.map((d) => {
                  const iso = localISODate(d);
                  const dayEntries = byDay.get(iso) ?? [];
                  const isToday = iso === todayIso;
                  return (
                    <DayColumn
                      key={iso}
                      date={d}
                      iso={iso}
                      isToday={isToday}
                      entries={layoutDay(dayEntries)}
                      onEditEntry={openEdit}
                      onCreateDraft={(d) => {
                        setDraft(d);
                        setDialogOpen(true);
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {weekTotals.perClient.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
              This week by client
            </div>
            <div className="space-y-2">
              {weekTotals.perClient.map((c) => (
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

function DayColumn({
  date,
  iso,
  isToday,
  entries,
  onEditEntry,
  onCreateDraft,
}: {
  date: Date;
  iso: string;
  isToday: boolean;
  entries: LaidOutEntry[];
  onEditEntry: (e: WeekEntry) => void;
  onCreateDraft: (d: EntryDraft) => void;
}) {
  const colRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ startMin: number; endMin: number } | null>(null);

  const minFromEvent = useCallback((clientY: number): number => {
    const el = colRef.current;
    if (!el) return START_HOUR * 60;
    const rect = el.getBoundingClientRect();
    const y = clientY - rect.top;
    return snap(minFromY(y));
  }, []);

  function onMouseDown(e: React.MouseEvent) {
    // Only left button; ignore clicks bubbling up from existing blocks.
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-entry-block]")) return;
    const start = minFromEvent(e.clientY);
    setDrag({ startMin: start, endMin: start + SLOT_MIN });
  }

  useEffect(() => {
    if (!drag) return;
    function onMove(ev: MouseEvent) {
      if (!drag) return;
      const m = minFromEvent(ev.clientY);
      setDrag((cur) => (cur ? { ...cur, endMin: m } : cur));
    }
    function onUp() {
      setDrag((cur) => {
        if (!cur) return null;
        const lo = Math.min(cur.startMin, cur.endMin);
        const hi = Math.max(cur.startMin, cur.endMin);
        const finalEnd = hi <= lo ? lo + SLOT_MIN : hi;
        if (finalEnd > lo) {
          onCreateDraft({
            date: iso,
            jobId: null,
            startMinutes: lo,
            endMinutes: finalEnd,
            description: "",
          });
        }
        return null;
      });
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag, iso, minFromEvent, onCreateDraft]);

  const dragLo = drag ? Math.min(drag.startMin, drag.endMin) : 0;
  const dragHi = drag ? Math.max(drag.startMin, drag.endMin) : 0;

  return (
    <div
      ref={colRef}
      onMouseDown={onMouseDown}
      className={cn(
        "relative border-l border-border cursor-crosshair select-none",
        isToday && "bg-accent/[0.04]",
      )}
      style={{ height: HOURS * ROW_PX }}
    >
      {/* Hour gridlines */}
      {Array.from({ length: HOURS }).map((_, i) => (
        <div
          key={i}
          className="border-b border-border/40"
          style={{ height: ROW_PX }}
        />
      ))}
      {/* 30-min subgridlines */}
      {Array.from({ length: HOURS }).map((_, i) => (
        <div
          key={`half-${i}`}
          className="absolute left-0 right-0 border-b border-border/20"
          style={{ top: i * ROW_PX + ROW_PX / 2 }}
        />
      ))}

      {/* Existing entries — packed into lanes, side-by-side when overlapping */}
      {entries.map((e) => {
        const top = topFromMin(e.startMinutes ?? 0);
        const height = topFromMin(e.endMinutes ?? 0) - top;
        // Each lane is an equal slice of the column width. With N=1 the entry
        // takes the full width; with N=3 each one is ~33%.
        const laneWidthPct = 100 / e.totalLanes;
        const leftPct = e.laneIndex * laneWidthPct;
        const isNarrow = e.totalLanes >= 3;
        return (
          <button
            key={e.id}
            data-entry-block
            type="button"
            onClick={(ev) => {
              ev.stopPropagation();
              onEditEntry(e);
            }}
            title={`${e.jobName} · ${minutesToTime(e.startMinutes ?? 0)}–${minutesToTime(e.endMinutes ?? 0)} · ${fmtDuration(e.hours)}`}
            className="group/entry absolute rounded-md text-left px-1.5 py-1 overflow-hidden border transition-all duration-150 ease-expo hover:shadow-md hover:z-50 hover:scale-[1.02]"
            style={{
              top: top + 1,
              height: Math.max(18, height - 2),
              left: `calc(${leftPct}% + 2px)`,
              width: `calc(${laneWidthPct}% - 4px)`,
              zIndex: 10 + e.laneIndex,
              backgroundColor: `${e.jobColor}33`, // 20% opacity
              borderColor: `${e.jobColor}80`, // 50% opacity
              color: e.jobColor,
            }}
          >
            <div className="flex items-baseline gap-1 min-w-0">
              <span
                className="h-1.5 w-1.5 rounded-full shrink-0"
                style={{ backgroundColor: e.jobColor }}
              />
              <span
                className={cn(
                  "font-medium truncate text-foreground",
                  isNarrow ? "text-[10px]" : "text-[11px]",
                )}
              >
                {e.jobName}
              </span>
            </div>
            {height > 28 && !isNarrow && (
              <div className="text-[10px] tabular-nums text-muted-foreground mt-0.5">
                {minutesToTime(e.startMinutes ?? 0)}–
                {minutesToTime(e.endMinutes ?? 0)}
                {height > 48 && ` · ${fmtDuration(e.hours)}`}
              </div>
            )}
            {height > 28 && isNarrow && (
              <div className="text-[9px] tabular-nums text-muted-foreground mt-0.5">
                {fmtDuration(e.hours)}
              </div>
            )}
          </button>
        );
      })}

      {/* Drag ghost */}
      {drag && (
        <div
          className="absolute left-1 right-1 rounded-md border-2 border-dashed border-accent bg-accent/10 pointer-events-none"
          style={{
            top: topFromMin(dragLo),
            height: Math.max(ROW_PX / 4, topFromMin(dragHi) - topFromMin(dragLo)),
          }}
        >
          <div className="text-[10px] text-accent font-medium tabular-nums px-2 pt-1">
            {minutesToTime(dragLo)} – {minutesToTime(dragHi)}
          </div>
        </div>
      )}
    </div>
  );
}
