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
  fmtCurrency,
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
  currency: string; // "USD" | "EUR" | "RON"
  invoiceId: string | null;       // null = unbilled
  invoiceNumber: string | null;   // e.g. "CP 0012" for the badge
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

// Grid spans the full calendar day, midnight-to-midnight. Overnight entries
// split into two visual segments: a "head" on the start day clipped at
// 24:00, and a "tail" on the next day starting at 00:00.
const START_HOUR = 0;
const END_HOUR = 24;
const HOURS = END_HOUR - START_HOUR;
const ROW_PX_DEFAULT = 52;
const ROW_PX_COMPACT = 28;
const SLOT_MIN = 15; // snap to 15-minute slots
const DAY_MIN = 24 * 60;

function snap(minutes: number): number {
  return Math.round(minutes / SLOT_MIN) * SLOT_MIN;
}
function makeTopFromMin(rowPx: number) {
  return (min: number) => ((min - START_HOUR * 60) / 60) * rowPx;
}
function makeMinFromY(rowPx: number) {
  return (y: number) =>
    Math.max(START_HOUR * 60, START_HOUR * 60 + (y / rowPx) * 60);
}

/**
 * Visual slice of an entry on a single day column. Same-day entries produce
 * one "full" segment; overnight entries produce a "head" (start → 24:00 on
 * the start day) and a "tail" (00:00 → end-1440 on the next day).
 */
type Segment = {
  entry: WeekEntry;
  role: "full" | "head" | "tail";
  start: number; // 0..1440, within the segment's column
  end: number;   // 0..1440
};

type LaidOutSegment = Segment & {
  /** how many earlier segments overlap this one in time (0 = front-most). */
  stackIndex: number;
  /** how many later segments overlap this one — used to size the visible
   * "shoulder" of cards that sit underneath. */
  stackBelow: number;
};

/** yyyy-mm-dd → yyyy-mm-dd shifted by N days (tz-safe via UTC anchor). */
function shiftIsoDate(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Given an entry with raw start/end (end may exceed 1440 for overnight),
 * return one or two `{ date, segment }` pairs ready to be bucketed per day.
 */
function entrySegments(
  entry: WeekEntry,
  start: number,
  end: number,
  date: string,
): Array<{ date: string; segment: Segment }> {
  if (end <= DAY_MIN) {
    return [
      {
        date,
        segment: { entry, role: "full", start, end },
      },
    ];
  }
  return [
    {
      date,
      segment: { entry, role: "head", start, end: DAY_MIN },
    },
    {
      date: shiftIsoDate(date, 1),
      segment: { entry, role: "tail", start: 0, end: end - DAY_MIN },
    },
  ];
}

/**
 * Cascade overlap layout: overlapping segments stack on top of each other
 * (full-width minus a left offset based on stack index), translucent enough
 * to read what's underneath, with each card's left "shoulder" sticking out
 * so the back cards stay clickable. stackBelow is how many later segments
 * cover *this* one — used to decide if we need to leave a visible shoulder.
 */
function layoutDay(segments: Segment[]): LaidOutSegment[] {
  const sorted = [...segments].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return a.end - b.end;
  });

  return sorted.map((s, i) => {
    let stackIndex = 0;
    let stackBelow = 0;
    for (let j = 0; j < sorted.length; j++) {
      if (j === i) continue;
      const o = sorted[j];
      const overlaps = s.start < o.end && s.end > o.start;
      if (!overlaps) continue;
      if (j < i) stackIndex += 1;
      else stackBelow += 1;
    }
    return { ...s, stackIndex, stackBelow };
  });
}

export function WeekGrid({
  anchorIso,
  entries,
  jobs,
  onWeekChange,
  compact = false,
}: {
  anchorIso: string;
  entries: WeekEntry[];
  jobs: JobOpt[];
  /** If provided, controls week navigation (used to embed the grid outside
   * /income without redirecting the page). Default: navigate to /income?week. */
  onWeekChange?: (iso: string) => void;
  /** Smaller row height + footer hidden — for previews like the per-client
   * dashboard where the full-size grid would overwhelm the page. */
  compact?: boolean;
}) {
  const router = useRouter();
  const rowPx = compact ? ROW_PX_COMPACT : ROW_PX_DEFAULT;
  const topFromMin = useMemo(() => makeTopFromMin(rowPx), [rowPx]);
  const minFromY = useMemo(() => makeMinFromY(rowPx), [rowPx]);
  const anchor = useMemo(() => new Date(`${anchorIso}T12:00:00`), [anchorIso]);
  const days = useMemo(() => weekDates(anchor), [anchor]);
  const todayIso = localISODate(new Date());

  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<EntryDraft | null>(null);

  // Drag state for moving / resizing time blocks. `moved` flips true once
  // the pointer crosses a small threshold — until then we treat the gesture
  // as a click that opens the edit dialog.
  type DragMode = "move" | "resize-top" | "resize-bottom";
  type DragState = {
    entryId: string;
    mode: DragMode;
    origStart: number;
    origEnd: number;
    origDate: string;       // entry.date (start day)
    origRenderDate: string; // column where the drag began
    segmentRole: "full" | "head" | "tail";
    pointerStart: { x: number; y: number };
    current: { start: number; end: number; date: string };
    moved: boolean;
  };
  const [drag, setDrag] = useState<DragState | null>(null);
  const gridBodyRef = useRef<HTMLDivElement | null>(null);

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

  function startDrag(
    segment: Segment,
    mode: DragMode,
    e: React.PointerEvent,
    renderDate: string,
  ) {
    e.stopPropagation();
    e.preventDefault();
    const entry = segment.entry;
    setDrag({
      entryId: entry.id,
      mode,
      origStart: entry.startMinutes ?? 540,
      origEnd: entry.endMinutes ?? 1020,
      origDate: entry.date,
      // The column where the user grabbed this segment — may differ from
      // the entry's start date (for a tail segment grabbed on day+1).
      origRenderDate: renderDate,
      segmentRole: segment.role,
      pointerStart: { x: e.clientX, y: e.clientY },
      current: {
        start: entry.startMinutes ?? 540,
        end: entry.endMinutes ?? 1020,
        date: entry.date,
      },
      moved: false,
    });
  }

  useEffect(() => {
    if (!drag) return;
    function snap(min: number) {
      return Math.round(min / SLOT_MIN) * SLOT_MIN;
    }
    function onMove(ev: PointerEvent) {
      setDrag((d) => {
        if (!d) return d;
        const dy = ev.clientY - d.pointerStart.y;
        const dx = ev.clientX - d.pointerStart.x;
        const moved = d.moved || Math.abs(dx) > 4 || Math.abs(dy) > 4;
        const deltaMin = snap((dy / rowPx) * 60);
        let newStart = d.origStart;
        let newEnd = d.origEnd;
        let newDate = d.origDate;
        if (d.mode === "move") {
          newStart = d.origStart + deltaMin;
          newEnd = d.origEnd + deltaMin;
          // Horizontal day swap: figure out how many columns the cursor
          // has crossed relative to where the drag started, then apply the
          // same offset to the entry's start date. This works regardless
          // of which segment (head or tail) was grabbed.
          const body = gridBodyRef.current;
          if (body) {
            const rect = body.getBoundingClientRect();
            const dayStart = rect.left + 56;
            const dayWidth = (rect.right - dayStart) / 7;
            const col = Math.floor((ev.clientX - dayStart) / dayWidth);
            const colClamped = Math.max(0, Math.min(6, col));
            const renderOrigCol = days.findIndex(
              (dd) => localISODate(dd) === d.origRenderDate,
            );
            const origCol = days.findIndex(
              (dd) => localISODate(dd) === d.origDate,
            );
            if (renderOrigCol !== -1 && origCol !== -1) {
              const delta = colClamped - renderOrigCol;
              const targetCol = Math.max(0, Math.min(6, origCol + delta));
              newDate = localISODate(days[targetCol]);
            }
          }
        } else if (d.mode === "resize-bottom") {
          newEnd = Math.max(d.origStart + SLOT_MIN, d.origEnd + deltaMin);
        } else if (d.mode === "resize-top") {
          newStart = Math.min(d.origEnd - SLOT_MIN, d.origStart + deltaMin);
        }
        // Time-axis clamps. End may run past 1440 (overnight); cap at
        // start + 24h to avoid runaway shifts; start stays inside one day.
        newStart = Math.max(0, Math.min(DAY_MIN, newStart));
        newEnd = Math.min(newStart + 24 * 60, Math.max(0, newEnd));
        return {
          ...d,
          current: { start: newStart, end: newEnd, date: newDate },
          moved,
        };
      });
    }
    async function onUp() {
      const d = drag;
      if (!d) return;
      setDrag(null);
      if (!d.moved) {
        // Treat as a click — open the edit dialog.
        const entry = entries.find((e) => e.id === d.entryId);
        if (entry) openEdit(entry);
        return;
      }
      const changed =
        d.current.start !== d.origStart ||
        d.current.end !== d.origEnd ||
        d.current.date !== d.origDate;
      if (!changed) return;
      try {
        const res = await fetch(`/api/income/${d.entryId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: d.current.date,
            startMinutes: d.current.start,
            endMinutes: d.current.end,
          }),
        });
        if (!res.ok) throw new Error("update failed");
        router.refresh();
      } catch {
        // Surface failure quietly; the row will snap back on next refresh.
      }
    }
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, entries, days, router]);

  function navWeek(delta: number) {
    const d = new Date(anchor);
    d.setDate(d.getDate() + delta * 7);
    const nextIso = localISODate(d);
    if (onWeekChange) onWeekChange(nextIso);
    else router.push(`/income?week=${nextIso}`);
  }

  // Build the per-day segment buckets, overlaying live drag state so the
  // visual matches the cursor during a drag without mutating real entries.
  const byDay = useMemo(() => {
    const m = new Map<string, Segment[]>();
    for (const e of entries) {
      if (e.startMinutes == null || e.endMinutes == null) continue;
      const isDragging = drag?.entryId === e.id;
      const start = isDragging ? drag!.current.start : e.startMinutes;
      const end = isDragging ? drag!.current.end : e.endMinutes;
      const date = isDragging ? drag!.current.date : e.date;
      for (const { date: d, segment } of entrySegments(e, start, end, date)) {
        const arr = m.get(d) ?? [];
        arr.push(segment);
        m.set(d, arr);
      }
    }
    return m;
  }, [entries, drag]);

  const weekTotals = useMemo(() => {
    const hours = entries.reduce((a, b) => a + b.hours, 0);
    const perClient = new Map<
      string,
      {
        name: string;
        color: string;
        hours: number;
        amount: number; // in the client's own currency (cents)
        currency: string;
      }
    >();
    // Per-currency cents totals. The stored amount represents the amount in
    // the client's contract currency (we display it with the right symbol).
    const byCurrency: Record<string, number> = {};
    for (const e of entries) {
      const key = e.jobId ?? e.jobName;
      const cur =
        perClient.get(key) ??
        {
          name: e.jobName,
          color: e.jobColor,
          hours: 0,
          amount: 0,
          currency: e.currency || "USD",
        };
      cur.hours += e.hours;
      cur.amount += e.amountUsd;
      perClient.set(key, cur);
      const c = e.currency || "USD";
      byCurrency[c] = (byCurrency[c] ?? 0) + e.amountUsd;
    }
    // Convert per-currency subtotals to USD for the grand total.
    // Hardcoded approximation: 1 EUR ≈ 1.08 USD, 1 RON ≈ 0.22 USD.
    const FX: Record<string, number> = { USD: 1, EUR: 1.08, RON: 0.22 };
    let totalUsd = 0;
    for (const [c, cents] of Object.entries(byCurrency)) {
      totalUsd += cents * (FX[c] ?? 1);
    }
    return {
      hours,
      totalUsd,
      byCurrency,
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
            onClick={() =>
              onWeekChange
                ? onWeekChange(todayIso)
                : router.push(`/income?week=${todayIso}`)
            }
            className="ml-2"
          >
            Today
          </Button>
        </div>

        <div className="flex items-start gap-6 text-sm">
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
              {fmtUsd(weekTotals.totalUsd)}
            </div>
            {Object.keys(weekTotals.byCurrency).length > 1 && (
              <div className="text-[10px] text-muted-foreground tabular-nums mt-0.5 space-x-2">
                {Object.entries(weekTotals.byCurrency)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([c, cents]) => (
                    <span key={c}>
                      {fmtCurrency(cents, c)}
                    </span>
                  ))}
              </div>
            )}
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
                  // Sum the visible segment durations on this day — for an
                  // overnight entry the head shows on day N and the tail
                  // on day N+1, so each column counts only its own slice.
                  const dayHours = (byDay.get(iso) ?? []).reduce(
                    (a, b) => a + (b.end - b.start) / 60,
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
                ref={gridBodyRef}
                className="grid relative"
                style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}
              >
                {/* Hour labels */}
                <div className="border-r border-border">
                  {Array.from({ length: HOURS }).map((_, i) => (
                    <div
                      key={i}
                      className="text-[10px] text-muted-foreground pr-2 pt-1 text-right tabular-nums"
                      style={{ height: rowPx }}
                    >
                      {String((START_HOUR + i) % 24).padStart(2, "0")}:00
                    </div>
                  ))}
                </div>

                {/* Day columns. byDay already reflects live drag state so
                    each column just renders its bucket of segments. */}
                {days.map((d) => {
                  const iso = localISODate(d);
                  const segments = byDay.get(iso) ?? [];
                  const isToday = iso === todayIso;
                  return (
                    <DayColumn
                      key={iso}
                      iso={iso}
                      isToday={isToday}
                      segments={layoutDay(segments)}
                      draggedEntryId={drag?.entryId ?? null}
                      rowPx={rowPx}
                      topFromMin={topFromMin}
                      minFromY={minFromY}
                      onStartDrag={startDrag}
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

      {weekTotals.perClient.length > 0 && !compact && (
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
                      {fmtCurrency(c.amount, c.currency)}
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
  iso,
  isToday,
  segments,
  draggedEntryId,
  rowPx,
  topFromMin,
  minFromY,
  onStartDrag,
  onCreateDraft,
}: {
  iso: string;
  isToday: boolean;
  segments: LaidOutSegment[];
  draggedEntryId: string | null;
  rowPx: number;
  topFromMin: (min: number) => number;
  minFromY: (y: number) => number;
  onStartDrag: (
    segment: Segment,
    mode: "move" | "resize-top" | "resize-bottom",
    e: React.PointerEvent,
    renderDate: string,
  ) => void;
  onCreateDraft: (d: EntryDraft) => void;
}) {
  const colRef = useRef<HTMLDivElement>(null);
  const [createDrag, setCreateDrag] = useState<{ startMin: number; endMin: number } | null>(null);

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
    setCreateDrag({ startMin: start, endMin: start + SLOT_MIN });
  }

  useEffect(() => {
    if (!createDrag) return;
    function onMove(ev: MouseEvent) {
      if (!createDrag) return;
      const m = minFromEvent(ev.clientY);
      setCreateDrag((cur) => (cur ? { ...cur, endMin: m } : cur));
    }
    function onUp() {
      setCreateDrag((cur) => {
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
  }, [createDrag, iso, minFromEvent, onCreateDraft]);

  const dragLo = createDrag ? Math.min(createDrag.startMin, createDrag.endMin) : 0;
  const dragHi = createDrag ? Math.max(createDrag.startMin, createDrag.endMin) : 0;

  return (
    <div
      ref={colRef}
      onMouseDown={onMouseDown}
      className={cn(
        "relative border-l border-border cursor-crosshair select-none",
        isToday && "bg-accent/[0.04]",
      )}
      style={{ height: HOURS * rowPx }}
    >
      {/* Hour gridlines */}
      {Array.from({ length: HOURS }).map((_, i) => (
        <div
          key={i}
          className="border-b border-border/40"
          style={{ height: rowPx }}
        />
      ))}
      {/* 30-min subgridlines */}
      {Array.from({ length: HOURS }).map((_, i) => (
        <div
          key={`half-${i}`}
          className="absolute left-0 right-0 border-b border-border/20"
          style={{ top: i * rowPx + rowPx / 2 }}
        />
      ))}

      {/* Segments — stacked with a cascading left offset so a small left
          shoulder of each card behind stays clickable. Overnight entries
          appear as two segments (head clipped at 24:00 on the start day,
          tail rendered at 00:00 on the next day). */}
      {segments.map((s) => {
        const e = s.entry;
        const isMe = draggedEntryId === e.id;
        const top = topFromMin(s.start);
        const height = topFromMin(s.end) - top;
        // Each subsequent stack layer shifts right by 10px — the leftmost
        // sliver of every card behind stays exposed so the user can click
        // it directly without needing to bring it forward first.
        const offset = s.stackIndex * 10;

        // Resize grips only make sense on real edges, not at midnight
        // (which is fixed by the day split).
        const showTopResize = s.role === "full" || s.role === "head";
        const showBottomResize = s.role === "full" || s.role === "tail";
        const headRadius = s.role === "tail" ? "rounded-b-md" : s.role === "head" ? "rounded-t-md" : "rounded-md";

        const fullStartMin = e.startMinutes ?? 0;
        const fullEndMin = e.endMinutes ?? 0;
        return (
          <div
            key={`${e.id}-${s.role}`}
            data-entry-block
            className="absolute"
            style={{
              top: top + 1,
              height: Math.max(18, height - 2),
              left: 4 + offset,
              right: 4,
              zIndex: isMe ? 100 : 10 + s.stackIndex,
            }}
          >
            <div
              onPointerDown={(ev) =>
                onStartDrag(
                  s,
                  "move",
                  ev as unknown as React.PointerEvent,
                  iso,
                )
              }
              title={`${e.jobName} · ${minutesToTime(fullStartMin)}–${minutesToTime(fullEndMin)} · ${fmtDuration(e.hours)}${e.description ? ` · ${e.description}` : ""}`}
              className={cn(
                "group/entry absolute inset-0 text-left px-2 py-1 overflow-hidden border-2 touch-none select-none backdrop-blur-[1px]",
                "transition-all duration-150 ease-expo hover:shadow-md hover:!z-50 hover:scale-[1.005]",
                headRadius,
                isMe
                  ? "shadow-lg cursor-grabbing scale-[1.02]"
                  : "cursor-grab",
              )}
              style={{
                backgroundColor: `${e.jobColor}33`,
                borderColor: `${e.jobColor}80`,
                color: e.jobColor,
              }}
            >
              {showTopResize && (
                <div
                  onPointerDown={(ev) => {
                    ev.stopPropagation();
                    onStartDrag(
                      s,
                      "resize-top",
                      ev as unknown as React.PointerEvent,
                      iso,
                    );
                  }}
                  className="absolute top-0 left-0 right-0 h-1.5 cursor-ns-resize z-10"
                  aria-label="Resize start"
                />
              )}
              {showBottomResize && (
                <div
                  onPointerDown={(ev) => {
                    ev.stopPropagation();
                    onStartDrag(
                      s,
                      "resize-bottom",
                      ev as unknown as React.PointerEvent,
                      iso,
                    );
                  }}
                  className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize z-10"
                  aria-label="Resize end"
                />
              )}
              <div className="flex items-baseline gap-1.5 min-w-0 pointer-events-none">
                <span
                  className="h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: e.jobColor }}
                />
                <span className="font-medium text-[11px] truncate text-foreground">
                  {e.jobName}
                </span>
                {e.invoiceNumber && (
                  <span
                    className="text-[9px] font-mono tabular-nums opacity-70 shrink-0"
                    title={`Billed on ${e.invoiceNumber}`}
                  >
                    ✓ {e.invoiceNumber}
                  </span>
                )}
                {s.role === "tail" && (
                  <span className="text-[9px] uppercase tracking-wider opacity-60 ml-auto pl-1">
                    cont.
                  </span>
                )}
              </div>
              {height > 28 && (
                <div className="text-[10px] tabular-nums text-muted-foreground mt-0.5 pointer-events-none">
                  {minutesToTime(fullStartMin)}–{minutesToTime(fullEndMin)}
                  {height > 48 && ` · ${fmtDuration(e.hours)}`}
                </div>
              )}
              {height > 56 && e.description && (
                <div className="text-[10px] leading-snug text-muted-foreground/90 mt-1 line-clamp-3 pointer-events-none">
                  {e.description}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Create-drag ghost (when dragging in an empty area to create new) */}
      {createDrag && (
        <div
          className="absolute left-1 right-1 rounded-md border-2 border-dashed border-accent bg-accent/10 pointer-events-none"
          style={{
            top: topFromMin(dragLo),
            height: Math.max(rowPx / 4, topFromMin(dragHi) - topFromMin(dragLo)),
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
