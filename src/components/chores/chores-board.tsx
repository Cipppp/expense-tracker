"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Broom,
  ShoppingCart,
  Sparkle,
  CheckCircle,
  Circle,
  ArrowsLeftRight,
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import {
  CHORES,
  DAYS,
  PEOPLE,
  choreKey,
  setTotal,
  personForSet,
  type SetId,
  type PersonKey,
} from "@/lib/chores";

type Assignment = { cip: SetId; axy: SetId };

export function ChoresBoard({
  weekKey,
  weekRange,
  assignmentThis,
  assignmentNext,
  done: initialDone,
  todayIdx,
  dayNums,
}: {
  weekKey: string;
  weekRange: string;
  assignmentThis: Assignment;
  assignmentNext: Assignment;
  done: string[];
  todayIdx: number;
  dayNums: number[];
  flip: boolean;
}) {
  const [done, setDone] = useState<Set<string>>(() => new Set(initialDone));
  const [assign, setAssign] = useState<Assignment>(assignmentThis);
  const [assignNext, setAssignNext] = useState<Assignment>(assignmentNext);
  const [swapping, setSwapping] = useState(false);

  const invert = (a: Assignment): Assignment => ({
    cip: a.cip === 1 ? 2 : 1,
    axy: a.axy === 1 ? 2 : 1,
  });

  async function swap() {
    if (swapping) return;
    setSwapping(true);
    setAssign(invert);
    setAssignNext(invert);
    try {
      const res = await fetch("/api/chores", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ swap: true }),
      });
      if (!res.ok) throw new Error();
      toast.success("Rândul a fost schimbat");
    } catch {
      setAssign(invert);
      setAssignNext(invert);
      toast.error("N-am putut schimba rândul");
    } finally {
      setSwapping(false);
    }
  }

  async function toggle(key: string) {
    const want = !done.has(key);
    setDone((s) => {
      const n = new Set(s);
      if (want) n.add(key);
      else n.delete(key);
      return n;
    });
    try {
      const res = await fetch("/api/chores", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isoWeek: weekKey, key, done: want }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setDone((s) => {
        const n = new Set(s);
        if (want) n.delete(key);
        else n.add(key);
        return n;
      });
      toast.error("N-am putut salva");
    }
  }

  function setProgress(set: SetId) {
    let d = 0;
    CHORES[set].forEach((day, di) =>
      day.forEach((_, ci) => {
        if (done.has(choreKey(set, di, ci))) d++;
      }),
    );
    return { done: d, total: setTotal(set) };
  }

  return (
    <div className="space-y-8">
      <header>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.07em] text-muted-foreground">
          <Broom className="h-3.5 w-3.5" />
          Treburi casnice
        </div>
        <h1 className="mt-1.5 text-[30px] sm:text-[44px] leading-[1.02]">
          Rândul săptămânii
        </h1>
        <p className="mt-1 text-sm text-muted-foreground capitalize">
          {weekRange}
        </p>
      </header>

      {/* Who's on what this week */}
      <Card className="overflow-hidden">
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 sm:p-4">
          {(["cip", "axy"] as PersonKey[]).map((pk) => {
            const set = assign[pk];
            const p = PEOPLE[pk];
            const prog = setProgress(set);
            const pct = Math.round((prog.done / prog.total) * 100);
            const allDone = prog.done === prog.total;
            return (
              <div
                key={pk}
                className="relative rounded-xl border p-4 overflow-hidden"
                style={{ borderColor: `${p.color}55`, background: p.soft }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="grid h-10 w-10 place-items-center rounded-full text-sm font-semibold text-white shrink-0"
                    style={{ backgroundColor: p.color }}
                  >
                    {p.name.slice(0, 2)}
                  </span>
                  <div className="min-w-0">
                    <div className="font-medium leading-tight">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Rândul {set}
                    </div>
                  </div>
                  <div className="ml-auto text-right">
                    <div
                      className="text-lg font-semibold tabular-nums leading-none flex items-center gap-1 justify-end"
                      style={{ color: p.color }}
                    >
                      {allDone && <Sparkle weight="fill" className="h-4 w-4" />}
                      {prog.done}
                      <span className="text-muted-foreground font-normal">
                        /{prog.total}
                      </span>
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                      {allDone ? "gata!" : "bifate"}
                    </div>
                  </div>
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-[width] duration-500 ease-expo"
                    style={{ width: `${pct}%`, backgroundColor: p.color }}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
        <Separator />
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Săptămâna viitoare ·{" "}
            <span className="text-foreground">
              {PEOPLE.cip.name} → Rândul {assignNext.cip}
            </span>{" "}
            ·{" "}
            <span className="text-foreground">
              {PEOPLE.axy.name} → Rândul {assignNext.axy}
            </span>
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={swap}
            disabled={swapping}
          >
            <ArrowsLeftRight className="h-4 w-4" />
            Schimbă rândul
          </Button>
        </div>
      </Card>

      {/* The two chore sets */}
      {([1, 2] as SetId[]).map((set) => {
        const pk = personForSet(set, assign);
        const p = PEOPLE[pk];
        const prog = setProgress(set);
        return (
          <section key={set} className="space-y-3">
            <div className="flex items-center gap-2.5">
              <h2 className="font-display text-lg tracking-tight">
                Rândul {set}
              </h2>
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{ backgroundColor: p.soft, color: p.color }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: p.color }}
                />
                {p.name}
              </span>
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                {prog.done}/{prog.total}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-2.5">
              {DAYS.map((dayName, di) => {
                const isToday = di === todayIdx;
                return (
                  <div
                    key={di}
                    className={cn(
                      "rounded-lg border p-3 transition-colors",
                      isToday
                        ? "border-accent/60 bg-accent/5"
                        : "border-border bg-card",
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-1">
                      <span className="text-sm font-medium">{dayName}</span>
                      <span
                        className={cn(
                          "text-[11px] tabular-nums",
                          isToday
                            ? "text-accent font-medium"
                            : "text-muted-foreground",
                        )}
                      >
                        {isToday ? "azi" : dayNums[di]}
                      </span>
                    </div>
                    <ul className="mt-2 space-y-0.5">
                      {CHORES[set][di].map((chore, ci) => {
                        const key = choreKey(set, di, ci);
                        const isDone = done.has(key);
                        return (
                          <li key={ci}>
                            <button
                              type="button"
                              onClick={() => toggle(key)}
                              className="group flex w-full items-start gap-2 rounded-md py-1 pl-0.5 pr-1 text-left text-[13px] hover:bg-secondary/60 transition-colors"
                            >
                              {isDone ? (
                                <CheckCircle
                                  weight="fill"
                                  className="h-4 w-4 mt-px shrink-0"
                                  style={{ color: p.color }}
                                />
                              ) : (
                                <Circle className="h-4 w-4 mt-px shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground" />
                              )}
                              <span
                                className={cn(
                                  "leading-snug",
                                  isDone && "line-through text-muted-foreground",
                                  chore.shopping &&
                                    !isDone &&
                                    "text-accent font-medium",
                                )}
                              >
                                {chore.shopping && (
                                  <ShoppingCart className="inline h-3.5 w-3.5 mr-1 -mt-px" />
                                )}
                                {chore.label}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
        <ShoppingCart className="h-3.5 w-3.5" /> Bringo = cumpărături · bifările
        se resetează automat în fiecare luni.
      </p>
    </div>
  );
}
