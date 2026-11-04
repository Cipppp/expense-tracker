"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Trash2 } from "@/lib/icons";
import type { Person, PersonKey } from "@/lib/chores";
import { cn } from "@/lib/utils";
import { MEASUREMENTS, type MeasurementKey } from "@/lib/body";

export type CheckIn = {
  person: PersonKey;
  day: string;
  weightKg: number | null;
  note: string;
} & Record<MeasurementKey, number | null>;

const EMPTY = Object.fromEntries(MEASUREMENTS.map((m) => [m.key, ""])) as Record<MeasurementKey, string>;

const utc = (day: string) => new Date(`${day}T00:00:00Z`);
const dateLabel = (day: string) =>
  utc(day).toLocaleDateString("ro-RO", { day: "numeric", month: "short", timeZone: "UTC" });
const num = (n: number, d = 1) => n.toLocaleString("ro-RO", { minimumFractionDigits: d, maximumFractionDigits: d });
const signed = (n: number, unit: string) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${num(Math.abs(n))} ${unit}`;

/** Parses "95,4" or "95.4"; empty is null, junk is NaN. */
function parse(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (!t) return null;
  return Number(t);
}

const axis = { tickLine: false, axisLine: false, fontSize: 11, stroke: "hsl(var(--muted-foreground))" };

export function CheckIns({
  person,
  today,
  initial,
  targetRate,
}: {
  person: Person;
  today: string;
  initial: CheckIn[];
  /** Weekly loss the plan aims for, kg; null when the plan has no target. */
  targetRate: { min: number; max: number } | null;
}) {
  const [all, setAll] = useState<CheckIn[]>(initial);
  const [day, setDay] = useState(today);
  const [weight, setWeight] = useState("");
  const [measures, setMeasures] = useState<Record<MeasurementKey, string>>(EMPTY);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const mine = useMemo(() => all.filter((c) => c.person === person.key).sort((a, b) => a.day.localeCompare(b.day)), [all, person.key]);
  const weighed = mine.filter((c) => c.weightKg !== null) as (CheckIn & { weightKg: number })[];

  /*
   * Pace = change between the first and last weigh-in, per week. One reading
   * says nothing about a trend, so the line waits for two at least a week apart.
   */
  const pace = useMemo(() => {
    if (weighed.length < 2) return null;
    const a = weighed[0];
    const b = weighed[weighed.length - 1];
    const weeks = (utc(b.day).getTime() - utc(a.day).getTime()) / (7 * 86400000);
    if (weeks < 1) return null;
    return { total: b.weightKg - a.weightKg, perWeek: (b.weightKg - a.weightKg) / weeks, weeks };
  }, [weighed]);

  // Whole kilograms, evenly spaced: Recharts' own "nice" ticks came out as 94, 96, 99.
  const ticks = useMemo(() => {
    if (!weighed.length) return [0, 1];
    const lo = Math.floor(Math.min(...weighed.map((c) => c.weightKg))) - 1;
    const hi = Math.ceil(Math.max(...weighed.map((c) => c.weightKg))) + 1;
    const step = hi - lo > 8 ? 2 : 1;
    const out: number[] = [];
    for (let t = lo; t <= hi + step - 1; t += step) out.push(t);
    return out;
  }, [weighed]);

  async function submit(e: { preventDefault(): void }) {
    e.preventDefault();
    const weightKg = parse(weight);
    const cm = Object.fromEntries(MEASUREMENTS.map((m) => [m.key, parse(measures[m.key])])) as Record<MeasurementKey, number | null>;
    if ([weightKg, ...Object.values(cm)].some((v) => Number.isNaN(v))) {
      toast.error("Greutatea și măsurătorile se scriu ca numere, de exemplu 95,4.");
      return;
    }
    if (weightKg === null && Object.values(cm).every((v) => v === null) && !note.trim()) {
      toast.error("Scrie măcar greutatea, o măsurătoare sau o notă.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/meals/checkin", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person: person.key, day, weightKg, ...cm, note }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.checkIn) throw new Error(String(res.status));
      setAll((prev) => [...prev.filter((c) => !(c.person === person.key && c.day === day)), data.checkIn as CheckIn]);
      setWeight("");
      setMeasures(EMPTY);
      setNote("");
      toast.success("Check-in salvat.");
    } catch {
      toast.error("N-am putut salva check-in-ul. Verifică valorile și încearcă din nou.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(c: CheckIn) {
    const prev = all;
    setAll((xs) => xs.filter((x) => !(x.person === c.person && x.day === c.day)));
    const res = await fetch(`/api/meals/checkin?person=${c.person}&day=${c.day}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      setAll(prev);
      toast.error("N-am putut șterge check-in-ul.");
    }
  }

  const input =
    "h-9 w-full rounded-md border border-border bg-background px-2.5 text-[13px] tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
      <form onSubmit={submit} className="space-y-3 rounded-xl border border-border bg-card px-4 py-4">
        <div>
          <h3 className="text-[14px] font-medium">Check-in pentru {person.name}</h3>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Dimineața, pe stomacul gol. Aceeași zi în fiecare săptămână dă cea mai curată comparație.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="col-span-2 space-y-1 text-[12px] text-muted-foreground">
            Ziua
            <input type="date" value={day} max={today} onChange={(e) => setDay(e.target.value)} required className={input} />
          </label>
          <label className="col-span-2 space-y-1 text-[12px] text-muted-foreground">
            Greutate (kg)
            <input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="95,4" className={input} />
          </label>
          {MEASUREMENTS.map((m) => (
            <label key={m.key} className="space-y-1 text-[12px] text-muted-foreground">
              {m.label} (cm)
              <input
                inputMode="decimal"
                value={measures[m.key]}
                onChange={(e) => setMeasures((prev) => ({ ...prev, [m.key]: e.target.value }))}
                placeholder={m.hint}
                className={input}
              />
            </label>
          ))}
          <label className="col-span-2 space-y-1 text-[12px] text-muted-foreground">
            Notă
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Cum a mers săptămâna, balonare, somn…"
              className={cn(input, "h-auto py-2 font-sans")}
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="h-9 w-full rounded-md bg-accent px-3 text-[13px] font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {saving ? "Se salvează…" : "Salvează check-in-ul"}
        </button>
      </form>

      <div className="space-y-4">
        <section className="rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-[14px] font-medium">Greutatea lui {person.name}</h3>
            {pace && (
              <p className="text-[12px] tabular-nums text-muted-foreground">
                {signed(pace.total, "kg")} în {num(pace.weeks, 0)} {Math.round(pace.weeks) === 1 ? "săptămână" : "săptămâni"} ·{" "}
                <span
                  className={cn(
                    "font-medium",
                    targetRate &&
                      (-pace.perWeek >= targetRate.min && -pace.perWeek <= targetRate.max + 0.2
                        ? "text-success"
                        : "text-amber-600 dark:text-amber-400"),
                  )}
                >
                  {signed(pace.perWeek, "kg")}/săptămână
                </span>
                {targetRate && ` (ținta: −${num(targetRate.min)} până la −${num(targetRate.max)})`}
              </p>
            )}
          </div>
          {weighed.length >= 2 ? (
            <div className="mt-3 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weighed.map((c) => ({ label: dateLabel(c.day), kg: c.weightKg }))} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 5" strokeOpacity={0.7} vertical={false} />
                  <XAxis dataKey="label" {...axis} tickMargin={8} />
                  <YAxis
                    {...axis}
                    width={40}
                    domain={[ticks[0], ticks[ticks.length - 1]]}
                    ticks={ticks}
                    tickFormatter={(v: number) => num(v, 0)}
                  />
                  <Tooltip
                    cursor={{ stroke: "hsl(var(--muted-foreground))", strokeOpacity: 0.4 }}
                    content={({ active, payload, label }) =>
                      active && payload?.length ? (
                        <div className="rounded-lg border border-border bg-popover/95 px-3 py-2 text-[12px] shadow-lg backdrop-blur-sm">
                          <div className="text-muted-foreground">{label}</div>
                          <div className="font-medium tabular-nums text-foreground">{num(Number(payload[0].value))} kg</div>
                        </div>
                      ) : null
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="kg"
                    stroke={person.color}
                    strokeWidth={2}
                    dot={{ r: 4, fill: person.color, stroke: "hsl(var(--card))", strokeWidth: 2 }}
                    activeDot={{ r: 5, stroke: "hsl(var(--card))", strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="mt-2 text-[12.5px] text-muted-foreground">
              {weighed.length === 1
                ? "Mai e nevoie de un check-in ca să apară graficul."
                : "Niciun check-in încă. Primul se face din formularul din stânga."}
            </p>
          )}
        </section>

        {mine.length > 0 && (
          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="grid grid-cols-[5.5rem_5.5rem_minmax(0,1fr)_2rem] gap-3 border-b border-border px-4 py-2 text-[11px] font-medium uppercase tracking-[0.07em] text-muted-foreground">
              <span>Ziua</span>
              <span className="text-right">Greutate</span>
              <span>Măsurători</span>
              <span />
            </div>
            <ul className="divide-y divide-border">
              {[...mine].reverse().map((c, i, rev) => {
                const prev = rev.slice(i + 1).find((x) => x.weightKg !== null);
                const delta = c.weightKg !== null && prev?.weightKg != null ? c.weightKg - prev.weightKg : null;
                return (
                  <li key={c.day} className="grid grid-cols-[5.5rem_5.5rem_minmax(0,1fr)_2rem] items-baseline gap-x-3 gap-y-1 px-4 py-2 text-[12.5px]">
                    <span>{dateLabel(c.day)}</span>
                    <span className="text-right tabular-nums">
                      {c.weightKg !== null ? `${num(c.weightKg)} kg` : "–"}
                      {delta !== null && (
                        <span className="block text-[11px] text-muted-foreground">{signed(delta, "kg")}</span>
                      )}
                    </span>
                    {/* Each measurement with its change since the last check-in that had it. */}
                    <span className="flex min-w-0 flex-wrap gap-x-3 gap-y-0.5 tabular-nums">
                      {MEASUREMENTS.filter((m) => c[m.key] !== null).map((m) => {
                        const before = rev.slice(i + 1).find((x) => x[m.key] !== null)?.[m.key];
                        const d = before != null ? c[m.key]! - before : null;
                        return (
                          <span key={m.key} className="whitespace-nowrap">
                            <span className="text-muted-foreground">{m.label}</span> {num(c[m.key]!)}
                            {d !== null && d !== 0 && (
                              <span className="ml-1 text-[11px] text-muted-foreground">{signed(d, "")}</span>
                            )}
                          </span>
                        );
                      })}
                      {MEASUREMENTS.every((m) => c[m.key] === null) && <span className="text-muted-foreground">–</span>}
                    </span>
                    <button
                      type="button"
                      onClick={() => void remove(c)}
                      aria-label={`Șterge check-in-ul din ${dateLabel(c.day)}`}
                      className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    {c.note && <span className="col-span-full text-[12px] text-muted-foreground">{c.note}</span>}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
