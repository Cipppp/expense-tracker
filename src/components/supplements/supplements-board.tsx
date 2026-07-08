"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PEOPLE, type PersonKey } from "@/lib/chores";
import {
  SUPPLEMENTS,
  SUPP_BY_KEY,
  TIMINGS,
  dailyTotals,
  smartWarnings,
  type Supplement,
  type TimingKey,
} from "@/lib/supplements";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  X,
  WarningCircle,
  Info,
} from "@/lib/icons";

export type LogRow = {
  day: string;
  person: PersonKey;
  key: string;
  count: number;
  updatedAt: string;
};

const AUTHOR_KEY = "gratitude:author"; // shared identity with the gratitude page

const lk = (day: string, person: string, key: string) => `${day}|${person}|${key}`;

function parseDay(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}
function shiftDay(day: string, delta: number): string {
  const d = parseDay(day);
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dayLabel(day: string, today: string): string {
  if (day === today) return "Azi";
  if (day === shiftDay(today, -1)) return "Ieri";
  return parseDay(day).toLocaleDateString("ro-RO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Items that count toward a person's daily adherence. */
function dailyItemsFor(person: PersonKey): Supplement[] {
  return SUPPLEMENTS.filter(
    (s) => s.daily && (!s.suggestedFor || s.suggestedFor === person),
  );
}

export function SupplementsBoard({
  initialLogs,
  today,
}: {
  initialLogs: LogRow[];
  today: string;
}) {
  const [logs, setLogs] = useState<Map<string, { count: number; updatedAt: string }>>(
    () => new Map(initialLogs.map((l) => [lk(l.day, l.person, l.key), { count: l.count, updatedAt: l.updatedAt }])),
  );
  const [day, setDay] = useState(today);
  const [person, setPerson] = useState<PersonKey>("cip");
  const [infoKey, setInfoKey] = useState<string | null>(null);
  const savingRef = useRef(0);
  const loadedFromRef = useRef(shiftDay(today, -13));

  useEffect(() => {
    try {
      const a = localStorage.getItem(AUTHOR_KEY);
      if (a === "cip" || a === "axy") setPerson(a);
    } catch {
      /* ignore */
    }
  }, []);
  function pickPerson(p: PersonKey) {
    setPerson(p);
    try {
      localStorage.setItem(AUTHOR_KEY, p);
    } catch {
      /* ignore */
    }
  }

  // Merge a set of rows into the map (server is the source of truth).
  function mergeRows(rows: LogRow[], replaceRange?: { from: string; to: string }) {
    setLogs((prev) => {
      const next = new Map(prev);
      if (replaceRange) {
        for (const k of Array.from(next.keys())) {
          const d = k.slice(0, 10);
          if (d >= replaceRange.from && d <= replaceRange.to) next.delete(k);
        }
      }
      for (const r of rows) next.set(lk(r.day, r.person, r.key), { count: r.count, updatedAt: r.updatedAt });
      return next;
    });
  }

  // Near-real-time shared state (same pattern as the gratitude feed).
  useEffect(() => {
    let stopped = false;
    async function poll() {
      if (document.hidden || savingRef.current > 0) return;
      const from = loadedFromRef.current;
      try {
        const res = await fetch(`/api/supplements?from=${from}&to=${today}`, { cache: "no-store" });
        if (!res.ok || stopped) return;
        const { logs: rows } = (await res.json()) as { logs: LogRow[] };
        if (stopped) return;
        mergeRows(rows, { from, to: today });
      } catch {
        /* transient */
      }
    }
    const id = setInterval(poll, 8000);
    const onVisible = () => {
      if (!document.hidden) poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [today]);

  // Back-navigation past the loaded window → fetch that day once.
  async function goTo(newDay: string) {
    setDay(newDay);
    if (newDay < loadedFromRef.current) {
      loadedFromRef.current = newDay;
      try {
        const res = await fetch(`/api/supplements?from=${newDay}&to=${newDay}`, { cache: "no-store" });
        if (res.ok) {
          const { logs: rows } = (await res.json()) as { logs: LogRow[] };
          mergeRows(rows);
        }
      } catch {
        /* ignore */
      }
    }
  }

  const countOf = (d: string, p: PersonKey, key: string) => logs.get(lk(d, p, key))?.count ?? 0;

  async function tap(s: Supplement) {
    const cur = countOf(day, person, s.key);
    const next = cur >= s.target ? 0 : cur + 1;
    const prev = { count: cur, updatedAt: new Date().toISOString() };
    setLogs((m) => {
      const n = new Map(m);
      n.set(lk(day, person, s.key), { count: next, updatedAt: new Date().toISOString() });
      return n;
    });
    savingRef.current++;
    try {
      const res = await fetch("/api/supplements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day, person, key: s.key, count: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setLogs((m) => {
        const n = new Map(m);
        n.set(lk(day, person, s.key), prev);
        return n;
      });
      toast.error("N-am putut salva");
    } finally {
      savingRef.current--;
    }
  }

  // Selected person's counts for the visible day.
  const counts: Record<string, number> = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of SUPPLEMENTS) c[s.key] = countOf(day, person, s.key);
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs, day, person]);

  const warnings = useMemo(() => {
    const base = smartWarnings(counts);
    // Caffeine timing: pre-workout logged today after 16:00 → sleep warning.
    const pw = logs.get(lk(day, person, "preworkout-on"));
    if (pw && pw.count > 0 && day === today) {
      const h = new Date(pw.updatedAt).getHours();
      if (h >= 16) {
        base.push({
          level: "info",
          text: "Pre-workout luat după 16:00 — cele 175 mg de cafeină îți pot afecta somnul.",
        });
      }
    }
    return base;
  }, [counts, logs, day, person, today]);

  const totals = useMemo(() => dailyTotals(counts), [counts]);

  // Adherence for a (person, day): fraction of applicable daily items taken.
  function adherence(p: PersonKey, d: string): number {
    const items = dailyItemsFor(p);
    if (items.length === 0) return 0;
    let sum = 0;
    for (const s of items) sum += Math.min(countOf(d, p, s.key) / s.target, 1);
    return sum / items.length;
  }

  const last7 = Array.from({ length: 7 }, (_, i) => shiftDay(today, -(6 - i)));
  function streak(p: PersonKey): number {
    let n = 0;
    let d = today;
    // grace: if nothing today yet, start from yesterday
    const loggedToday = SUPPLEMENTS.some((s) => countOf(today, p, s.key) > 0);
    if (!loggedToday) d = shiftDay(d, -1);
    while (SUPPLEMENTS.some((s) => countOf(d, p, s.key) > 0)) {
      n++;
      d = shiftDay(d, -1);
      if (n > 60) break;
    }
    return n;
  }

  const takenToday = (p: PersonKey) =>
    dailyItemsFor(p).filter((s) => countOf(day, p, s.key) >= s.target).length;

  const info = infoKey ? SUPP_BY_KEY[infoKey] : null;

  const sections: TimingKey[] = ["morning", "noon", "evening", "preworkout"];

  return (
    <div className="space-y-5 max-w-2xl">
      <header>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-muted-foreground">
          💊 Suplimente
        </div>
        <h1 className="mt-1 font-display text-2xl sm:text-4xl tracking-tight">
          Ce am luat azi
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bifează ce iei, pe zile și pe persoană — cu dozele și orele potrivite.
        </p>
      </header>

      {/* Day + person */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => goTo(shiftDay(day, -1))}
            aria-label="Ziua anterioară"
            className="grid h-9 w-9 place-items-center rounded-md border border-border text-muted-foreground hover:bg-secondary transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-36 px-2 text-center">
            <div className="text-sm font-medium capitalize">{dayLabel(day, today)}</div>
            {day !== today && (
              <button
                type="button"
                onClick={() => goTo(today)}
                className="text-[11px] text-accent underline-offset-2 hover:underline"
              >
                înapoi la azi
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => day < today && goTo(shiftDay(day, 1))}
            disabled={day >= today}
            aria-label="Ziua următoare"
            className="grid h-9 w-9 place-items-center rounded-md border border-border text-muted-foreground hover:bg-secondary transition-colors disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          {(["cip", "axy"] as PersonKey[]).map((pk) => {
            const p = PEOPLE[pk];
            const on = person === pk;
            return (
              <button
                key={pk}
                type="button"
                onClick={() => pickPerson(pk)}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors",
                  on ? "text-white" : "text-muted-foreground hover:bg-secondary",
                )}
                style={on ? { backgroundColor: p.color, borderColor: p.color } : { borderColor: `${p.color}55` }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: on ? "#fff" : p.color }} />
                {p.name}
                <span className={cn("tabular-nums text-xs", on ? "text-white/80" : "text-muted-foreground")}>
                  {takenToday(pk)}/{dailyItemsFor(pk).length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Smart warnings */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map((w, i) => (
            <div
              key={i}
              className={cn(
                "flex items-start gap-2 rounded-lg border px-3 py-2 text-[13px] leading-snug",
                w.level === "danger" && "border-destructive/50 bg-destructive/10 text-foreground",
                w.level === "warn" && "border-amber-500/50 bg-amber-500/10",
                w.level === "info" && "border-border bg-secondary/40 text-muted-foreground",
              )}
            >
              <WarningCircle
                className={cn(
                  "mt-0.5 h-4 w-4 shrink-0",
                  w.level === "danger" ? "text-destructive" : w.level === "warn" ? "text-amber-500" : "text-muted-foreground",
                )}
              />
              {w.text}
            </div>
          ))}
        </div>
      )}

      {/* Sections */}
      {sections.map((tk) => {
        const t = TIMINGS[tk];
        const items = SUPPLEMENTS.filter((s) => s.timing === tk);
        if (items.length === 0) return null;
        return (
          <section key={tk} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-sm">{t.emoji}</span>
              <h2 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
                {t.label}
              </h2>
              <span className="text-[11px] text-muted-foreground/70">{t.hint}</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <ul className="space-y-1">
              {items.map((s) => {
                const c = counts[s.key] ?? 0;
                const done = c >= s.target;
                const other = s.suggestedFor && s.suggestedFor !== person;
                return (
                  <li key={s.key}>
                    <div
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg border bg-card px-2.5 py-1.5 transition-all duration-200 ease-expo",
                        done ? "border-success/50 bg-success/5" : "border-border",
                        other && "opacity-55",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => tap(s)}
                        aria-label={`Bifează ${s.name}`}
                        className={cn(
                          "grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition-all duration-200 ease-expo active:scale-90",
                          done
                            ? "border-success bg-success text-white"
                            : "border-border text-transparent hover:border-foreground/40",
                        )}
                      >
                        {done ? (
                          <Check className="h-3.5 w-3.5" weight="bold" />
                        ) : s.target > 1 && c > 0 ? (
                          <span className="text-[11px] font-semibold tabular-nums text-foreground">{c}</span>
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button type="button" onClick={() => tap(s)} className="min-w-0 flex-1 text-left">
                        <div className={cn("text-[13px] font-medium leading-tight truncate", done && "line-through decoration-success/60 text-muted-foreground")}>
                          {s.name}
                          {s.suggestedFor && (
                            <span
                              className="ml-1.5 rounded-full px-1.5 py-px text-[9px] font-medium align-middle"
                              style={{
                                backgroundColor: PEOPLE[s.suggestedFor].soft,
                                color: PEOPLE[s.suggestedFor].color,
                              }}
                            >
                              {PEOPLE[s.suggestedFor].name}
                            </span>
                          )}
                        </div>
                        <div className="text-[10.5px] text-muted-foreground truncate">
                          {s.target > 1 ? `${c}/${s.target} ${s.unit === "capsulă" ? "capsule" : s.unit === "tabletă" ? "tablete" : s.unit}` : `1 ${s.unit}`}
                          {" · "}
                          <span className="text-muted-foreground/80">{s.short}</span>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setInfoKey(s.key)}
                        aria-label={`Detalii ${s.name}`}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground/60 hover:bg-secondary hover:text-foreground transition-colors"
                      >
                        <Info className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {/* End-of-day recap: who took what */}
      <section className="rounded-xl border border-border bg-card px-4 py-3.5">
        <h3 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
          Rezumatul zilei · <span className="capitalize">{dayLabel(day, today)}</span>
        </h3>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {(["cip", "axy"] as PersonKey[]).map((pk) => {
            const p = PEOPLE[pk];
            const applicable = SUPPLEMENTS.filter(
              (s) => !s.suggestedFor || s.suggestedFor === pk,
            );
            const cFor = (key: string) => countOf(day, pk, key);
            const complete = applicable.filter((s) => cFor(s.key) >= s.target);
            const partial = applicable.filter(
              (s) => cFor(s.key) > 0 && cFor(s.key) < s.target,
            );
            const missed = applicable.filter((s) => s.daily && cFor(s.key) === 0);
            const dailyApplicable = dailyItemsFor(pk);
            const doneDaily = dailyApplicable.filter((s) => cFor(s.key) >= s.target).length;
            const pct = Math.round(adherence(pk, day) * 100);
            // per-person daily totals
            const cRec: Record<string, number> = {};
            for (const s of SUPPLEMENTS) cRec[s.key] = cFor(s.key);
            const pt = dailyTotals(cRec);
            const totalsBits = [
              pt.vitaminD_IU > 0 && `D ${Math.round(pt.vitaminD_IU)} UI`,
              pt.zinc_mg > 0 && `Zn ${Math.round(pt.zinc_mg)} mg`,
              pt.magnesium_mg > 0 && `Mg ${Math.round(pt.magnesium_mg)} mg`,
              pt.iron_mg > 0 && `Fe ${Math.round(pt.iron_mg)} mg`,
              pt.caffeine_mg > 0 && `Cafeină ${Math.round(pt.caffeine_mg)} mg`,
              pt.fiveHtp_mg > 0 && `5-HTP ${Math.round(pt.fiveHtp_mg)} mg`,
            ].filter(Boolean) as string[];
            // last tick time
            let lastTs = 0;
            for (const s of applicable) {
              const row = logs.get(lk(day, pk, s.key));
              if (row && row.count > 0) {
                const ts = new Date(row.updatedAt).getTime();
                if (ts > lastTs) lastTs = ts;
              }
            }
            return (
              <div
                key={pk}
                className="rounded-lg border p-3"
                style={{ borderColor: `${p.color}44`, background: p.soft }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white"
                    style={{ backgroundColor: p.color }}
                  >
                    {p.name.slice(0, 2)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium leading-none">{p.name}</div>
                    <div className="mt-0.5 text-[10.5px] text-muted-foreground">
                      {doneDaily}/{dailyApplicable.length} zilnice
                      {lastTs > 0 &&
                        ` · ultima bifă ${new Date(lastTs).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}`}
                    </div>
                  </div>
                  <span
                    className="text-lg font-semibold tabular-nums"
                    style={{ color: p.color }}
                  >
                    {pct}%
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/10">
                  <div
                    className="h-full rounded-full transition-[width] duration-500 ease-expo"
                    style={{ width: `${pct}%`, backgroundColor: p.color }}
                  />
                </div>
                {(complete.length > 0 || partial.length > 0) && (
                  <div className="mt-2.5 flex flex-wrap gap-1">
                    {complete.map((s) => (
                      <span
                        key={s.key}
                        className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10.5px] font-medium text-success"
                      >
                        <Check className="h-3 w-3" weight="bold" />
                        {s.name}
                        {s.target > 1 && (
                          <span className="opacity-70">×{s.target}</span>
                        )}
                      </span>
                    ))}
                    {partial.map((s) => (
                      <span
                        key={s.key}
                        className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10.5px] font-medium text-amber-600 dark:text-amber-400"
                      >
                        {s.name} {cFor(s.key)}/{s.target}
                      </span>
                    ))}
                  </div>
                )}
                {missed.length > 0 && (
                  <div className="mt-2">
                    <div className="text-[9.5px] font-medium uppercase tracking-wider text-muted-foreground/70">
                      {day === today ? "De luat încă" : "Sărite"}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {missed.map((s) => (
                        <span
                          key={s.key}
                          className="rounded-full border border-border/70 px-2 py-0.5 text-[10.5px] text-muted-foreground"
                        >
                          {s.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {totalsBits.length > 0 && (
                  <div className="mt-2.5 border-t border-foreground/10 pt-2 text-[10.5px] text-muted-foreground">
                    {totalsBits.join(" · ")}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Daily totals */}
      <section className="rounded-xl border border-border bg-card px-4 py-3">
        <h3 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
          Totaluri azi · {PEOPLE[person].name}
        </h3>
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px] sm:grid-cols-3">
          <Total label="Vitamina D" value={totals.vitaminD_IU} unit="UI" max={4000} />
          <Total label="Zinc" value={totals.zinc_mg} unit="mg" max={40} />
          <Total label="Magneziu" value={totals.magnesium_mg} unit="mg" max={350} />
          <Total label="Cafeină" value={totals.caffeine_mg} unit="mg" max={400} />
          <Total label="Fier" value={totals.iron_mg} unit="mg" max={45} />
          <Total label="5-HTP" value={totals.fiveHtp_mg} unit="mg" max={200} />
        </div>
      </section>

      {/* 7-day metrics */}
      <section className="rounded-xl border border-border bg-card px-4 py-3">
        <h3 className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
          Ultimele 7 zile
        </h3>
        <div className="mt-3 space-y-3">
          {(["cip", "axy"] as PersonKey[]).map((pk) => {
            const p = PEOPLE[pk];
            const st = streak(pk);
            return (
              <div key={pk} className="flex items-center gap-3">
                <span className="w-8 text-xs font-medium" style={{ color: p.color }}>
                  {p.name}
                </span>
                <div className="flex flex-1 items-end gap-1">
                  {last7.map((d) => {
                    const a = adherence(pk, d);
                    return (
                      <div key={d} className="flex-1" title={`${d}: ${Math.round(a * 100)}%`}>
                        <div className="h-9 w-full rounded-sm bg-secondary/60 relative overflow-hidden">
                          <div
                            className="absolute bottom-0 left-0 right-0 rounded-sm transition-[height] duration-500 ease-expo"
                            style={{ height: `${Math.round(a * 100)}%`, backgroundColor: p.color, opacity: d === today ? 1 : 0.55 }}
                          />
                        </div>
                        <div className="mt-0.5 text-center text-[9px] text-muted-foreground">
                          {parseDay(d).toLocaleDateString("ro-RO", { weekday: "narrow" })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <span className="w-16 text-right text-[11px] text-muted-foreground tabular-nums">
                  {st > 0 ? `🔥 ${st} zile` : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Informațiile despre doze și interacțiuni sunt orientative (surse:
        producători, NIH, examine.com) și nu înlocuiesc sfatul medicului.
      </p>

      {/* Info bottom-sheet */}
      {info && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 animate-fade-in sm:items-center sm:p-4"
          onClick={() => setInfoKey(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-border bg-card p-4 shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-lg leading-tight">{info.name}</h3>
                <p className="text-xs text-muted-foreground">{info.brand}</p>
              </div>
              <button
                type="button"
                onClick={() => setInfoKey(null)}
                aria-label="Închide"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <dl className="mt-3 space-y-3 text-[13px] leading-relaxed">
              <InfoRow label="Compoziție">{info.composition}</InfoRow>
              <InfoRow label="Doza">{`${info.target} ${info.unit}${info.target > 1 ? " / zi" : " / zi"}`}</InfoRow>
              <InfoRow label="Când">
                {TIMINGS[info.timing].emoji} {info.timingNote}
              </InfoRow>
              <InfoRow label="Cu mâncare?">{info.foodNote}</InfoRow>
              {info.interactions.length > 0 && (
                <InfoRow label="Nu combina cu">
                  <ul className="list-disc space-y-1 pl-4">
                    {info.interactions.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </InfoRow>
              )}
              {info.cautions.length > 0 && (
                <InfoRow label="Atenție">
                  <ul className="list-disc space-y-1 pl-4">
                    {info.cautions.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </InfoRow>
              )}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}

function Total({
  label,
  value,
  unit,
  max,
}: {
  label: string;
  value: number;
  unit: string;
  max: number;
}) {
  if (value <= 0)
    return (
      <div className="text-muted-foreground/50">
        {label}: <span className="tabular-nums">0</span>
      </div>
    );
  const over = value > max;
  return (
    <div className={cn(over && "text-destructive font-medium")}>
      {label}:{" "}
      <span className="tabular-nums font-medium">
        {Math.round(value)} {unit}
      </span>
      <span className="text-muted-foreground/60 text-[11px]"> / {max}</span>
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
