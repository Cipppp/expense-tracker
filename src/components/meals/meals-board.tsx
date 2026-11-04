"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Bread,
  BowlFood,
  BowlSteam,
  Cake,
  Carrot,
  Cheese,
  Cherries,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cookie,
  CookingPot,
  Egg,
  Hamburger,
  MoonStars,
  Shrimp,
  SunHorizon,
} from "@/lib/icons";
import { PEOPLE, type People, type PersonKey } from "@/lib/chores";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
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
  type DishIcon,
  type Item,
  type Macros,
  type MealKey,
  type Plan,
  type RecipeKey,
  type Variant,
} from "@/lib/meal-plan";

export type ChoiceRow = { day: string; person: PersonKey; meal: MealKey; variant: string };

const AUTHOR_KEY = "gratitude:author"; // the same "who am I" as gratitude and supplements

/* The side panel needs room next to a four-meal grid; below this the day opens in a sheet. */
const WIDE = "(min-width: 1536px)";

type Icon = typeof SunHorizon;

/*
 * One colour per meal, used for its icon tile everywhere on the page, so a
 * glance at a column, a card or the day panel says which meal it is. Light and
 * dark get their own shade; the tile is the same hue at low opacity.
 */
const MEAL_STYLE: Record<MealKey, { icon: Icon; tile: string; fg: string }> = {
  breakfast: { icon: SunHorizon, tile: "bg-amber-500/15", fg: "text-amber-600 dark:text-amber-400" },
  lunch: { icon: BowlFood, tile: "bg-emerald-500/15", fg: "text-emerald-600 dark:text-emerald-400" },
  snack: { icon: Cherries, tile: "bg-rose-500/15", fg: "text-rose-600 dark:text-rose-400" },
  dinner: { icon: MoonStars, tile: "bg-indigo-500/15", fg: "text-indigo-600 dark:text-indigo-400" },
};

const DISH_ICON: Record<DishIcon, Icon> = {
  porridge: BowlSteam,
  bread: Bread,
  egg: Egg,
  cake: Cake,
  bowl: BowlFood,
  pot: CookingPot,
  sandwich: Hamburger,
  cookie: Cookie,
  fruit: Cherries,
  shrimp: Shrimp,
  veg: Carrot,
  cheese: Cheese,
};

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

function dayChoicesFor(choices: Map<string, string>, day: string, person: PersonKey): Choices {
  return Object.fromEntries(
    MEALS.flatMap(({ key }) => {
      const v = choices.get(ck(day, person, key));
      return v ? [[key, v]] : [];
    }),
  );
}

/** Within 8% of the target counts as on target; the plan itself moves ±5%. */
function onTarget(total: Macros, plan: Plan): boolean | null {
  if (!plan.target) return null;
  return Math.abs(total.kcal - plan.target.kcal) <= plan.target.kcal * 0.08;
}

function Tile({ meal, icon, size = "md" }: { meal: MealKey; icon?: Icon; size?: "sm" | "md" }) {
  const s = MEAL_STYLE[meal];
  const I = icon ?? s.icon;
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-md",
        s.tile,
        s.fg,
        size === "sm" ? "h-5 w-5" : "h-7 w-7",
      )}
    >
      <I weight="duotone" className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
    </span>
  );
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
  // The day shown in the side panel. Today by default, so the page answers "what do I eat today".
  const [selected, setSelected] = useState(days.includes(today) ? today : days[0]);
  const [sheetOpen, setSheetOpen] = useState(false);

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

  /** Shows a day's meals: in the side panel when there's room, otherwise in a sheet over the page. */
  function showDay(day: string) {
    setSelected(day);
    if (!window.matchMedia(WIDE).matches) setSheetOpen(true);
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
    // The side panel follows the day you're editing; on a narrow screen nothing pops up.
    setSelected(day);
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
    const avg = n
      ? { kcal: complete.reduce((a, x) => a + x.kcal, 0) / n, protein: complete.reduce((a, x) => a + x.protein, 0) / n }
      : null;
    const empty = days.reduce((a, d) => a + MEALS.filter(({ key }) => !choices.has(ck(d, person, key))).length, 0);
    return { n, avg, empty };
  }, [choices, days, person]);

  const range = planRange(person);
  const accent = people[person];

  const detail = (
    <DayDetail
      day={selected}
      isToday={selected === today}
      plan={plan}
      choices={dayChoicesFor(choices, selected, person)}
    />
  );

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
          {week.empty === 0
            ? "Săptămâna e completă"
            : `Completează ${week.empty === 1 ? "masa goală" : `cele ${week.empty} mese goale`}`}
        </button>
      </div>

      <div className="2xl:grid 2xl:grid-cols-[minmax(0,1fr)_380px] 2xl:items-start 2xl:gap-5">
        {/* Week grid */}
        <section aria-label="Alegerile pe zile" className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="hidden border-b border-border px-4 py-2 lg:grid lg:grid-cols-[6.5rem_repeat(4,minmax(0,1fr))_5.5rem] lg:items-center lg:gap-4">
            <span className="text-[11px] font-medium uppercase tracking-[0.07em] text-muted-foreground">Ziua</span>
            {MEALS.map((ml) => (
              <span key={ml.key} className="flex items-center gap-1.5">
                <Tile meal={ml.key} size="sm" />
                <span className="text-[11px] font-medium uppercase tracking-[0.07em] text-muted-foreground">{ml.label}</span>
              </span>
            ))}
            <span className="text-right text-[11px] font-medium uppercase tracking-[0.07em] text-muted-foreground">Total</span>
          </div>
          <ul className="divide-y divide-border">
            {days.map((day) => {
              const c = dayChoicesFor(choices, day, person);
              const total = dayMacros(person, c);
              const picked = MEALS.filter(({ key }) => c[key]).length;
              const isToday = day === today;
              const isSelected = day === selected;
              const hit = picked === 4 ? onTarget(total, plan) : null;
              const totalText = (
                <>
                  <div
                    className={cn(
                      "text-[13px] font-medium tabular-nums",
                      hit === true && "text-success",
                      hit === false && "text-amber-600 dark:text-amber-400",
                    )}
                  >
                    {picked ? `${kcal(total)} kcal` : "–"}
                  </div>
                  <div className="text-[11px] tabular-nums text-muted-foreground">
                    {picked === 4 ? `${g(total.protein)} g proteină` : picked ? `${picked} din 4 mese` : "nimic ales"}
                  </div>
                </>
              );
              return (
                <li
                  key={day}
                  className="grid grid-cols-1 gap-2.5 px-4 py-2.5 transition-colors duration-150 lg:grid-cols-[6.5rem_repeat(4,minmax(0,1fr))_5.5rem] lg:items-start lg:gap-4"
                  style={isSelected ? { backgroundColor: accent.soft } : undefined}
                >
                  <div className="flex items-start justify-between gap-3 lg:block">
                    <button
                      type="button"
                      onClick={() => showDay(day)}
                      aria-pressed={isSelected}
                      className="-mx-1.5 -my-1 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="block text-[13px] font-medium capitalize">{weekday(day)}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {shortDate(day)}
                        {isToday && <span className="ml-1.5 font-medium text-accent">azi</span>}
                      </span>
                    </button>
                    <div className="text-right lg:hidden">{totalText}</div>
                  </div>
                  {MEALS.map((ml) => (
                    <MealCell
                      key={ml.key}
                      meal={ml.key}
                      mealLabel={ml.label}
                      variants={plan.meals[ml.key]}
                      chosen={c[ml.key]}
                      color={accent.color}
                      soft={accent.soft}
                      onChoose={(v) => choose(day, ml.key, v)}
                      onShow={() => showDay(day)}
                      groupLabel={`${ml.label}, ${weekday(day)} ${shortDate(day)}`}
                    />
                  ))}
                  <div className="hidden text-right lg:block">{totalText}</div>
                </li>
              );
            })}
          </ul>
        </section>

        <aside
          aria-label="Ziua aleasă"
          className="sticky top-4 hidden max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl border border-border bg-card 2xl:block"
        >
          {detail}
        </aside>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[420px] max-w-[92vw] gap-0 overflow-y-auto p-0">
          <SheetTitle className="sr-only">
            {weekday(selected)} {shortDate(selected)}
          </SheetTitle>
          {detail}
        </SheetContent>
      </Sheet>

      <PlanDetails person={person} name={people[person].name} />
    </div>
  );
}

function MealCell({
  meal,
  mealLabel,
  variants,
  chosen,
  color,
  soft,
  onChoose,
  onShow,
  groupLabel,
}: {
  meal: MealKey;
  mealLabel: string;
  variants: Variant[];
  chosen?: string;
  color: string;
  soft: string;
  onChoose: (key: string) => void;
  /** Shows the day's meals; the chosen dish's name is the way in. */
  onShow: () => void;
  groupLabel: string;
}) {
  const v = chosen ? variants.find((x) => x.key === chosen) : undefined;
  const DishI = v ? DISH_ICON[v.icon] : null;
  return (
    <div className="flex items-start justify-between gap-3 lg:block">
      <div className="flex items-center gap-1.5 pt-1.5 lg:hidden">
        <Tile meal={meal} size="sm" />
        <span className="text-[12px] text-muted-foreground">{mealLabel}</span>
      </div>
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
                  "grid h-9 w-9 place-items-center rounded-md border text-[13px] font-medium tabular-nums transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-7 lg:w-7 lg:text-[12px]",
                  on ? "font-semibold text-foreground" : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
                style={on ? { borderColor: color, backgroundColor: soft, boxShadow: `inset 0 0 0 1px ${color}` } : undefined}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
        <div className="mt-1 text-[12px] leading-snug">
          {v && DishI ? (
            <button
              type="button"
              onClick={onShow}
              className="ml-auto flex max-w-full items-center gap-1.5 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:ml-0"
            >
              <DishI weight="duotone" className={cn("h-3.5 w-3.5 shrink-0", MEAL_STYLE[meal].fg)} />
              <span className="min-w-0 text-right lg:text-left">
                <span className="block truncate underline-offset-2 hover:underline">{v.title}</span>
                <span className="block tabular-nums text-[11px] text-muted-foreground">{kcal(variantMacros(v))} kcal</span>
              </span>
            </button>
          ) : (
            <div className="text-[11px] text-muted-foreground/60">nealeasă</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ day detail */

function DayDetail({
  day,
  isToday,
  plan,
  choices,
}: {
  day: string;
  isToday: boolean;
  plan: Plan;
  choices: Choices;
}) {
  const chosen = MEALS.flatMap(({ key }) => {
    const v = choices[key] ? plan.meals[key].find((x) => x.key === choices[key]) : undefined;
    return v ? [variantMacros(v)] : [];
  });
  const total = chosen.reduce<Macros>(
    (a, x) => ({
      kcal: a.kcal + x.kcal,
      protein: a.protein + x.protein,
      carbs: a.carbs + x.carbs,
      fat: a.fat + x.fat,
      fiber: a.fiber + x.fiber,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
  );
  const picked = chosen.length;
  return (
    <div>
      <div className="sticky top-0 border-b border-border bg-card px-4 py-3">
        <div className="flex items-baseline justify-between gap-3 pr-6 2xl:pr-0">
          <div className="text-[15px] font-medium">
            <span className="capitalize">{weekday(day)}</span>{" "}
            <span className="font-normal text-muted-foreground">{shortDate(day)}</span>
            {isToday && <span className="ml-1.5 text-[11px] font-medium text-accent">azi</span>}
          </div>
          {picked > 0 && <div className="shrink-0 text-[13px] font-medium tabular-nums">{kcal(total)} kcal</div>}
        </div>
        <div className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
          {picked === 0
            ? "Nicio masă aleasă pentru ziua asta."
            : `${g(total.protein)} g proteină · ${g(total.carbs)} g carbohidrați · ${g(total.fat)} g grăsimi${picked < 4 ? ` · ${picked} din 4 mese` : ""}`}
        </div>
      </div>
      <ul className="divide-y divide-border">
        {MEALS.map(({ key, label }) => {
          const v = choices[key] ? plan.meals[key].find((x) => x.key === choices[key]) : undefined;
          return (
            <li key={key} className="px-4 py-3">
              <div className="flex items-center gap-2">
                <Tile meal={key} icon={v ? DISH_ICON[v.icon] : undefined} />
                <div className="min-w-0 flex-1">
                  <div className="text-[10.5px] font-medium uppercase tracking-[0.07em] text-muted-foreground">{label}</div>
                  {v ? (
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[13px] font-medium">{v.title}</span>
                      <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">{kcal(variantMacros(v))} kcal</span>
                    </div>
                  ) : (
                    <div className="text-[12px] text-muted-foreground">Nealeasă</div>
                  )}
                </div>
              </div>
              {v && <VariantBody v={v} className="mt-2 pl-9" />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------- dish details */

function MacroLine({ x, className }: { x: Macros; className?: string }) {
  return (
    <div className={cn("tabular-nums text-muted-foreground", className)}>
      {g(x.protein)} g proteină · {g(x.carbs)} g carbohidrați · {g(x.fat)} g grăsimi · {g(x.fiber)} g fibre
    </div>
  );
}

/** A recipe in full: what goes in, how much, and the steps. */
function RecipeBody({ recipe, portions }: { recipe: RecipeKey; portions: number }) {
  const r = RECIPES[recipe];
  const x = recipeMacros(recipe);
  return (
    <div className="mb-1 mt-1 space-y-2 rounded-md bg-secondary/60 px-2.5 py-2 text-[11.5px] leading-snug">
      <div className="text-muted-foreground">
        {r.servings === 1
          ? "Cantitățile sunt pentru o porție."
          : `Cantitățile sunt pentru ${r.servings} porții; mănânci ${portions === 1 ? "una" : g(portions)}.`}{" "}
        <span className="tabular-nums">
          O porție: {kcal(x)} kcal, {g(x.protein)} g proteină.
        </span>
      </div>
      <ul className="space-y-0.5">
        {r.ingredients.map((ing, j) => (
          <li key={j} className="flex items-baseline justify-between gap-3">
            <span className="min-w-0">{itemLabel(ing)}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {"count" in ing || "label" in ing ? `${g(ingredientGrams(ing))} g · ` : ""}
              {kcal(ingredientMacros(ing))} kcal
            </span>
          </li>
        ))}
      </ul>
      <ol className="list-decimal space-y-0.5 pl-4">
        {r.steps.map((st) => (
          <li key={st}>{st}</li>
        ))}
      </ol>
    </div>
  );
}

function ItemRow({ item }: { item: Item }) {
  const [open, setOpen] = useState(false);
  const x = itemMacros(item);
  if (!("recipe" in item)) {
    return (
      <li className="flex items-baseline justify-between gap-3">
        <span className="min-w-0">{itemLabel(item)}</span>
        <span className="shrink-0 tabular-nums text-muted-foreground">{kcal(x)} kcal</span>
      </li>
    );
  }
  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="-mx-1 flex w-[calc(100%+0.5rem)] items-baseline justify-between gap-3 rounded-sm px-1 text-left hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {/* Inline, not flex: in a narrow column the label wraps like text instead of splitting into columns. */}
        <span className="min-w-0">
          <ChevronDown
            className={cn(
              "mr-1 inline h-3 w-3 align-[-1px] text-muted-foreground transition-transform duration-200 ease-out",
              !open && "-rotate-90",
            )}
          />
          {itemLabel(item)}
          <span className="ml-1.5 whitespace-nowrap text-[11px] text-accent-text dark:text-accent">
            {open ? "ascunde rețeta" : "vezi rețeta"}
          </span>
        </span>
        <span className="shrink-0 tabular-nums text-muted-foreground">{kcal(x)} kcal</span>
      </button>
      {open && <RecipeBody recipe={item.recipe} portions={item.portions} />}
    </li>
  );
}

/** Ingredients with grams, recipes inline, tips. The title row is drawn by the caller. */
function VariantBody({ v, className }: { v: Variant; className?: string }) {
  return (
    <div className={className}>
      <MacroLine x={variantMacros(v)} className="text-[11px]" />
      <ul className="mt-1.5 space-y-0.5 text-[12px]">
        {v.items.map((it, j) => (
          <ItemRow key={j} item={it} />
        ))}
        {v.extras?.map((e) => (
          <li key={e} className="text-muted-foreground">
            {e}
          </li>
        ))}
      </ul>
      {v.tip && <p className="mt-1.5 text-[11.5px] leading-snug text-muted-foreground">{v.tip}</p>}
    </div>
  );
}

function PlanDetails({ person, name }: { person: PersonKey; name: string }) {
  const plan = PLANS[person];
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
          <h3 className="flex items-center gap-2 text-[13px] font-medium">
            <Tile meal={key} size="sm" />
            {label}
          </h3>
          <div className="grid items-start gap-2 md:grid-cols-2 2xl:grid-cols-3">
            {plan.meals[key].map((v, i) => (
              <div key={v.key} className="rounded-lg border border-border bg-card px-3.5 py-3">
                <div className="flex items-center gap-2">
                  <Tile meal={key} icon={DISH_ICON[v.icon]} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[10.5px] font-medium tabular-nums text-muted-foreground">Varianta {i + 1}</div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[13px] font-medium">{v.title}</span>
                      <span className="shrink-0 text-[12px] font-medium tabular-nums">{kcal(variantMacros(v))} kcal</span>
                    </div>
                  </div>
                </div>
                <VariantBody v={v} className="mt-2 pl-9" />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <h3 className="text-[13px] font-medium">De reținut</h3>
          <ul className="list-disc space-y-1 pl-4 text-[12px] leading-snug text-muted-foreground">
            {plan.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
        <div className="space-y-2">
          <h3 className="text-[13px] font-medium">Echivalențe</h3>
          <ul className="list-disc space-y-1 pl-4 text-[12px] leading-snug text-muted-foreground">
            {SWAPS.map((sw) => (
              <li key={sw}>{sw}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
