"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight } from "@/lib/icons";
import { PEOPLE, type People, type PersonKey } from "@/lib/chores";
import { cn } from "@/lib/utils";
import {
  FOODS,
  MEALS,
  PLANS,
  RECIPES,
  SWAPS,
  addDays,
  dayMacros,
  ingredientGrams,
  ingredientMacros,
  itemLabel,
  itemMacros,
  planRange,
  recipeMacros,
  variantMacros,
  type Choices,
  type FoodKey,
  type Item,
  type Macros,
  type MealKey,
  type RecipeKey,
  type Variant,
} from "@/lib/meal-plan";

export type ChoiceRow = { day: string; person: PersonKey; meal: MealKey; variant: string };

const AUTHOR_KEY = "gratitude:author"; // the same "who am I" as gratitude and supplements

const ck = (day: string, person: string, meal: string) => `${day}|${person}|${meal}`;
const kcal = (x: Macros) => Math.round(x.kcal).toLocaleString("ro-RO");
const g = (n: number) => Math.round(n).toLocaleString("ro-RO");

const utc = (day: string) => new Date(`${day}T00:00:00Z`);
const weekday = (day: string) => utc(day).toLocaleDateString("ro-RO", { weekday: "long", timeZone: "UTC" });
const shortDate = (day: string) => utc(day).toLocaleDateString("ro-RO", { day: "numeric", month: "short", timeZone: "UTC" });

function weekLabel(days: string[]): string {
  const a = utc(days[0]);
  const b = utc(days[6]);
  const month = (d: Date) => d.toLocaleDateString("ro-RO", { month: "long", timeZone: "UTC" });
  return a.getUTCMonth() === b.getUTCMonth()
    ? `${a.getUTCDate()}–${b.getUTCDate()} ${month(b)} ${b.getUTCFullYear()}`
    : `${a.getUTCDate()} ${month(a)} – ${b.getUTCDate()} ${month(b)} ${b.getUTCFullYear()}`;
}

export function MealsBoard({
  people = PEOPLE,
  days,
  today,
  thisWeek,
  initialChoices,
}: {
  people?: People;
  days: string[];
  today: string;
  thisWeek: string;
  initialChoices: ChoiceRow[];
}) {
  const [choices, setChoices] = useState<Map<string, string>>(
    () => new Map(initialChoices.map((c) => [ck(c.day, c.person, c.meal), c.variant])),
  );
  const [person, setPerson] = useState<PersonKey>("cip");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const a = localStorage.getItem(AUTHOR_KEY);
      // The selected person lives in the browser; the server can't know it.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const plan = PLANS[person];

  /*
   * Optimistic: the grid changes first, then the server is told. On failure
   * only the cells this call touched go back, so a quick second tap that did
   * save isn't undone by the first one failing.
   */
  async function apply(rows: ChoiceRow[]) {
    const keys = rows.map((r) => ck(r.day, r.person, r.meal));
    const before = new Map(keys.map((k) => [k, choices.get(k)]));
    setChoices((prev) => {
      const n = new Map(prev);
      rows.forEach((r, i) => {
        if (r.variant) n.set(keys[i], r.variant);
        else n.delete(keys[i]);
      });
      return n;
    });
    setSaving(true);
    try {
      const res = await fetch("/api/meals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choices: rows.map((r) => ({ ...r, variant: r.variant || null })) }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setChoices((prev) => {
        const n = new Map(prev);
        for (const [k, v] of before) {
          if (v) n.set(k, v);
          else n.delete(k);
        }
        return n;
      });
      toast.error("N-am putut salva alegerea. Încearcă din nou.");
    } finally {
      setSaving(false);
    }
  }

  function choose(day: string, meal: MealKey, variant: string) {
    const key = ck(day, person, meal);
    const next = choices.get(key) === variant ? "" : variant; // tapping the chosen one clears it
    void apply([{ day, person, meal, variant: next }]);
  }

  /*
   * Fills only the empty meals, rotating through the variants so two days in a
   * row don't repeat. Each meal starts the rotation at a different variant, so
   * a filled day is not "all V1".
   */
  function fillWeek() {
    const rows: ChoiceRow[] = [];
    days.forEach((day, i) =>
      MEALS.forEach(({ key }, mi) => {
        if (choices.has(ck(day, person, key))) return;
        const vs = plan.meals[key];
        rows.push({ day, person, meal: key, variant: vs[(i + mi) % vs.length].key });
      }),
    );
    if (rows.length) void apply(rows);
  }

  const week = useMemo(() => {
    const complete = days
      .map((d) => dayChoicesFor(choices, d, person))
      .filter((c) => MEALS.every(({ key }) => c[key]))
      .map((c) => dayMacros(person, c));
    const n = complete.length;
    const avg = n ? { kcal: complete.reduce((a, x) => a + x.kcal, 0) / n, protein: complete.reduce((a, x) => a + x.protein, 0) / n } : null;
    const empty = days.reduce((a, d) => a + MEALS.filter(({ key }) => !choices.has(ck(d, person, key))).length, 0);
    return { n, avg, empty };
  }, [choices, days, person]);

  const range = planRange(person);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[30px] sm:text-[44px] leading-[1.02]">Meniul săptămânii</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
          Alege varianta pentru fiecare masă. Caloriile se calculează din gramajele planului, cântărite crude.
        </p>
      </header>

      {/* Week + person */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1">
          <Link
            href={`/meals?w=${addDays(days[0], -7)}`}
            aria-label="Săptămâna anterioară"
            className="grid h-9 w-9 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-44 px-2 text-center">
            <div className="text-sm font-medium">{weekLabel(days)}</div>
            {days[0] !== thisWeek && (
              <Link href="/meals" className="text-[11px] text-accent underline-offset-2 hover:underline">
                înapoi la săptămâna asta
              </Link>
            )}
          </div>
          <Link
            href={`/meals?w=${addDays(days[0], 7)}`}
            aria-label="Săptămâna următoare"
            className="grid h-9 w-9 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="flex items-center gap-1.5">
          {(["cip", "axy"] as PersonKey[]).map((pk) => {
            const p = people[pk];
            const on = person === pk;
            return (
              <button
                key={pk}
                type="button"
                onClick={() => pickPerson(pk)}
                aria-pressed={on}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  on ? "text-white" : "text-muted-foreground hover:bg-secondary",
                )}
                style={on ? { backgroundColor: p.color, borderColor: p.color } : { borderColor: `${p.color}55` }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: on ? "#fff" : p.color }} />
                {p.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Week summary */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] leading-relaxed">
          {week.avg ? (
            <>
              <span className="font-medium tabular-nums">
                {g(week.avg.kcal)} kcal · {g(week.avg.protein)} g proteină
              </span>{" "}
              <span className="text-muted-foreground">
                în medie, pe {week.n === 1 ? "o zi completă" : `${week.n} zile complete`}.
              </span>{" "}
            </>
          ) : (
            <span className="text-muted-foreground">Nicio zi completă încă. </span>
          )}
          <span className="text-muted-foreground">
            {plan.target
              ? `Ținta: ${g(plan.target.kcal)} kcal și ${g(plan.target.protein)} g proteină.`
              : `Planul dă între ${kcal(range.min)} și ${kcal(range.max)} kcal pe zi.`}
          </span>
        </p>
        <button
          type="button"
          onClick={fillWeek}
          disabled={week.empty === 0 || saving}
          className="shrink-0 rounded-md border border-border px-3 py-1.5 text-[12.5px] font-medium transition-colors hover:bg-secondary disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {week.empty === 0 ? "Săptămâna e completă" : `Completează ${week.empty === 1 ? "masa goală" : `cele ${week.empty} mese goale`}`}
        </button>
      </div>

      {/* Week grid */}
      <section aria-label="Alegerile pe zile" className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="hidden border-b border-border px-4 py-2 text-[11px] font-medium uppercase tracking-[0.07em] text-muted-foreground lg:grid lg:grid-cols-[7rem_repeat(4,minmax(0,1fr))_6.5rem] lg:gap-4">
          <span>Ziua</span>
          {MEALS.map((ml) => (
            <span key={ml.key}>{ml.label}</span>
          ))}
          <span className="text-right">Total</span>
        </div>
        <ul className="divide-y divide-border">
          {days.map((day) => {
            const c = dayChoicesFor(choices, day, person);
            const total = dayMacros(person, c);
            const picked = MEALS.filter(({ key }) => c[key]).length;
            const isToday = day === today;
            const totalText = (
              <>
                <div className="text-[13px] font-medium tabular-nums">{picked ? `${kcal(total)} kcal` : "–"}</div>
                <div className="text-[11px] tabular-nums text-muted-foreground">
                  {picked === 4 ? `${g(total.protein)} g proteină` : picked ? `${picked} din 4 mese` : "nimic ales"}
                </div>
              </>
            );
            return (
              <li
                key={day}
                className={cn(
                  "grid grid-cols-1 gap-3 px-4 py-3 lg:grid-cols-[7rem_repeat(4,minmax(0,1fr))_6.5rem] lg:items-start lg:gap-4",
                  isToday && "bg-secondary/40",
                )}
              >
                <div className="flex items-start justify-between gap-3 lg:block">
                  <div>
                    <div className="text-[13px] font-medium capitalize">{weekday(day)}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {shortDate(day)}
                      {isToday && <span className="ml-1.5 font-medium text-accent">azi</span>}
                    </div>
                  </div>
                  <div className="text-right lg:hidden">{totalText}</div>
                </div>
                {MEALS.map((ml) => (
                  <MealCell
                    key={ml.key}
                    mealLabel={ml.label}
                    variants={plan.meals[ml.key]}
                    chosen={c[ml.key]}
                    color={people[person].color}
                    soft={people[person].soft}
                    onChoose={(v) => choose(day, ml.key, v)}
                    groupLabel={`${ml.label}, ${weekday(day)} ${shortDate(day)}`}
                  />
                ))}
                <div className="hidden text-right lg:block">{totalText}</div>
              </li>
            );
          })}
        </ul>
      </section>

      <PlanDetails person={person} name={people[person].name} />
    </div>
  );
}

function dayChoicesFor(choices: Map<string, string>, day: string, person: PersonKey): Choices {
  return Object.fromEntries(
    MEALS.flatMap(({ key }) => {
      const v = choices.get(ck(day, person, key));
      return v ? [[key, v]] : [];
    }),
  );
}

function MealCell({
  mealLabel,
  variants,
  chosen,
  color,
  soft,
  onChoose,
  groupLabel,
}: {
  mealLabel: string;
  variants: Variant[];
  chosen?: string;
  color: string;
  soft: string;
  onChoose: (key: string) => void;
  groupLabel: string;
}) {
  const v = chosen ? variants.find((x) => x.key === chosen) : undefined;
  return (
    <div className="flex items-start justify-between gap-3 lg:block">
      <div className="pt-1 text-[12px] text-muted-foreground lg:hidden">{mealLabel}</div>
      <div className="min-w-0 text-right lg:text-left">
        <div role="group" aria-label={groupLabel} className="inline-flex gap-1">
          {variants.map((x, i) => {
            const on = x.key === chosen;
            return (
              <button
                key={x.key}
                type="button"
                onClick={() => onChoose(x.key)}
                aria-pressed={on}
                aria-label={`Varianta ${i + 1}: ${x.title}, ${kcal(variantMacros(x))} kcal`}
                title={`${x.title} · ${kcal(variantMacros(x))} kcal`}
                className={cn(
                  "grid h-9 w-9 place-items-center rounded-md border text-[13px] lg:h-7 lg:w-7 lg:text-[12px] font-medium tabular-nums transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  on ? "font-semibold text-foreground" : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
                style={on ? { borderColor: color, backgroundColor: soft, boxShadow: `inset 0 0 0 1px ${color}` } : undefined}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
        <div className="mt-1 text-[12px] leading-snug">
          {v ? (
            <>
              <div className="truncate">{v.title}</div>
              <div className="tabular-nums text-muted-foreground">{kcal(variantMacros(v))} kcal</div>
            </>
          ) : (
            <div className="text-muted-foreground/70">nealeasă</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- plan details */

function MacroLine({ x, className }: { x: Macros; className?: string }) {
  return (
    <div className={cn("tabular-nums text-muted-foreground", className)}>
      {g(x.protein)} g proteină · {g(x.carbs)} g carbohidrați · {g(x.fat)} g grăsimi · {g(x.fiber)} g fibre
    </div>
  );
}

function ItemRow({ item }: { item: Item }) {
  const x = itemMacros(item);
  return (
    <li className="flex items-baseline justify-between gap-3">
      <span className="min-w-0">
        {itemLabel(item)}
        {"recipe" in item && (
          <a href={`#reteta-${item.recipe}`} className="ml-1.5 text-[11.5px] text-accent underline-offset-2 hover:underline">
            rețeta
          </a>
        )}
      </span>
      <span className="shrink-0 tabular-nums text-muted-foreground">{kcal(x)} kcal</span>
    </li>
  );
}

function PlanDetails({ person, name }: { person: PersonKey; name: string }) {
  const plan = PLANS[person];
  const recipes = useMemo(() => {
    const used = new Set<RecipeKey>();
    for (const { key } of MEALS)
      for (const v of plan.meals[key]) for (const i of v.items) if ("recipe" in i) used.add(i.recipe);
    return [...used];
  }, [plan]);
  const foods = useMemo(() => {
    const used = new Set<FoodKey>();
    const addIng = (i: Item) => {
      if ("recipe" in i) RECIPES[i.recipe].ingredients.forEach((r) => used.add(r.food));
      else used.add(i.food);
    };
    for (const { key } of MEALS) for (const v of plan.meals[key]) v.items.forEach(addIng);
    return [...used].sort((a, b) => FOODS[a].name.localeCompare(FOODS[b].name, "ro"));
  }, [plan]);

  return (
    <section className="space-y-6 pt-2">
      <div>
        <h2 className="text-[22px] leading-tight">
          {plan.title}
          <span className="text-muted-foreground"> · {name}</span>
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{plan.byline}</p>
      </div>

      {MEALS.map(({ key, label }) => (
        <div key={key} className="space-y-2">
          <h3 className="text-[13px] font-medium">{label}</h3>
          <div className="grid items-start gap-2 md:grid-cols-2">
            {plan.meals[key].map((v, i) => {
              const x = variantMacros(v);
              return (
                <div key={v.key} id={`${person}-${key}-${v.key}`} className="rounded-lg border border-border bg-card px-3.5 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="text-[13.5px] font-medium">
                      <span className="mr-1.5 tabular-nums text-muted-foreground">{i + 1}</span>
                      {v.title}
                    </div>
                    <div className="shrink-0 text-[13px] font-medium tabular-nums">{kcal(x)} kcal</div>
                  </div>
                  <MacroLine x={x} className="mt-0.5 text-[11.5px]" />
                  <ul className="mt-2.5 space-y-1 text-[12.5px]">
                    {v.items.map((it, j) => (
                      <ItemRow key={j} item={it} />
                    ))}
                    {v.extras?.map((e) => (
                      <li key={e} className="text-muted-foreground">
                        {e}
                      </li>
                    ))}
                  </ul>
                  {v.tip && <p className="mt-2.5 text-[12px] leading-snug text-muted-foreground">{v.tip}</p>}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="space-y-2">
        <h3 className="text-[13px] font-medium">Rețete</h3>
        <div className="divide-y divide-border rounded-lg border border-border bg-card">
          {recipes.map((rk) => {
            const r = RECIPES[rk];
            const x = recipeMacros(rk);
            return (
              <details key={rk} id={`reteta-${rk}`} className="group px-3.5 py-2.5">
                <summary className="flex cursor-pointer list-none items-baseline justify-between gap-3 text-[13px] [&::-webkit-details-marker]:hidden">
                  <span>
                    <span className="font-medium">{r.name}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {r.servings === 1 ? "1 porție" : `${r.servings} porții`}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{kcal(x)} kcal / porție</span>
                </summary>
                <div className="mt-2 space-y-2.5 pb-1 text-[12.5px]">
                  <MacroLine x={x} className="text-[11.5px]" />
                  <ul className="space-y-1">
                    {r.ingredients.map((ing, j) => (
                      <li key={j} className="flex items-baseline justify-between gap-3">
                        <span>{itemLabel(ing)}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {g(ingredientGrams(ing))} g · {kcal(ingredientMacros(ing))} kcal
                        </span>
                      </li>
                    ))}
                  </ul>
                  <ol className="list-decimal space-y-1 pl-4 text-muted-foreground">
                    {r.steps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ol>
                </div>
              </details>
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <h3 className="text-[13px] font-medium">De reținut</h3>
          <ul className="list-disc space-y-1 pl-4 text-[12.5px] leading-snug text-muted-foreground">
            {plan.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
        <div className="space-y-2">
          <h3 className="text-[13px] font-medium">Echivalențe</h3>
          <ul className="list-disc space-y-1 pl-4 text-[12.5px] leading-snug text-muted-foreground">
            {SWAPS.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      </div>

      <details className="rounded-lg border border-border bg-card px-3.5 py-2.5">
        <summary className="cursor-pointer list-none text-[13px] font-medium [&::-webkit-details-marker]:hidden">
          De unde vin caloriile
          <span className="font-normal text-muted-foreground"> · valorile la 100 g pentru fiecare aliment</span>
        </summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[560px] text-[12px]">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-1 pr-3 font-medium">Aliment</th>
                <th className="py-1 pr-3 text-right font-medium">kcal</th>
                <th className="py-1 pr-3 text-right font-medium">Proteine</th>
                <th className="py-1 pr-3 text-right font-medium">Carbo</th>
                <th className="py-1 pr-3 text-right font-medium">Grăsimi</th>
                <th className="py-1 font-medium">Sursa</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {foods.map((f) => {
                const food: { name: string; per100: Macros; unit?: { one: string; grams: number }; source: string } = FOODS[f];
                const p = food.per100;
                return (
                  <tr key={f} className="border-t border-border">
                    <td className="py-1 pr-3">
                      {food.name}
                      {food.unit && (
                        <span className="text-muted-foreground"> · 1 {food.unit.one} = {food.unit.grams.toLocaleString("ro-RO")} g</span>
                      )}
                    </td>
                    <td className="py-1 pr-3 text-right">{g(p.kcal)}</td>
                    <td className="py-1 pr-3 text-right">{p.protein.toLocaleString("ro-RO")}</td>
                    <td className="py-1 pr-3 text-right">{p.carbs.toLocaleString("ro-RO")}</td>
                    <td className="py-1 pr-3 text-right">{p.fat.toLocaleString("ro-RO")}</td>
                    <td className="py-1 text-muted-foreground">{food.source}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

