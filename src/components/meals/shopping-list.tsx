"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check } from "@/lib/icons";
import type { People, PersonKey } from "@/lib/chores";
import { cn } from "@/lib/utils";
import { shoppingList, type FoodKey, type MealKey, type ShoppingItem } from "@/lib/meal-plan";

export type Pick = { day: string; person: PersonKey; meal: MealKey; variant: string };

function amount(it: ShoppingItem): string {
  const g = Math.round(it.grams / 5) * 5 || Math.round(it.grams);
  const weight = g >= 1000 ? `${(g / 1000).toLocaleString("ro-RO", { maximumFractionDigits: 2 })} kg` : `${g} g`;
  if (!it.pieces) return weight;
  const { count, one, many } = it.pieces;
  return `${count} ${count === 1 ? one : many} · ${weight}`;
}

export function ShoppingList({
  week,
  picks,
  people,
  initialChecked,
}: {
  week: string;
  picks: Pick[];
  people: People;
  initialChecked: string[];
}) {
  const [who, setWho] = useState<Set<PersonKey>>(() => new Set(["cip", "axy"]));
  const [checked, setChecked] = useState<Set<string>>(() => new Set(initialChecked));

  const chosen = useMemo(() => picks.filter((p) => who.has(p.person)), [picks, who]);
  const groups = useMemo(() => shoppingList(chosen), [chosen]);
  const total = groups.reduce((a, gr) => a + gr.items.length, 0);
  const done = groups.reduce((a, gr) => a + gr.items.filter((i) => checked.has(i.food)).length, 0);

  async function save(next: Set<string>, prev: Set<string>) {
    setChecked(next);
    try {
      const res = await fetch("/api/meals/shopping", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week, checked: [...next] }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setChecked(prev);
      toast.error("N-am putut salva lista. Încearcă din nou.");
    }
  }

  const toggle = (food: FoodKey) => {
    const next = new Set(checked);
    if (next.has(food)) next.delete(food);
    else next.add(food);
    void save(next, checked);
  };

  const toggleWho = (pk: PersonKey) =>
    setWho((prev) => {
      const n = new Set(prev);
      if (n.has(pk) && n.size > 1) n.delete(pk);
      else n.add(pk);
      return n;
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] leading-relaxed">
          {total ? (
            <>
              <span className="font-medium tabular-nums">
                {done} din {total}
              </span>{" "}
              <span className="text-muted-foreground">
                luate, din {chosen.length} {chosen.length === 1 ? "masă aleasă" : "mese alese"} săptămâna asta. Rețetele cu mai
                multe porții sunt socotite doar pe porțiile alese.
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">
              Nicio masă aleasă săptămâna asta. Alege mesele în tabul Săptămâna și lista se face singură.
            </span>
          )}
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="text-[12px] text-muted-foreground">Pentru</span>
          {(["cip", "axy"] as PersonKey[]).map((pk) => {
            const on = who.has(pk);
            return (
              <button
                key={pk}
                type="button"
                onClick={() => toggleWho(pk)}
                aria-pressed={on}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  on ? "text-foreground" : "text-muted-foreground hover:bg-secondary",
                )}
                style={on ? { borderColor: people[pk].color, backgroundColor: people[pk].soft } : undefined}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: people[pk].color }} />
                {people[pk].name}
              </button>
            );
          })}
          {done > 0 && (
            <button
              type="button"
              onClick={() => void save(new Set(), checked)}
              className="ml-1 rounded-md px-2 py-1 text-[12px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Debifează tot
            </button>
          )}
        </div>
      </div>

      {/*
       * Columns, not a grid: aisles differ a lot in length (3 items vs 15), and
       * grid rows sized to the tallest card left large holes under the short ones.
       */}
      <div className="gap-3 md:columns-2 2xl:columns-3">
        {groups.map((gr) => (
          <section key={gr.aisle} className="mb-3 break-inside-avoid rounded-xl border border-border bg-card">
            <h3 className="border-b border-border px-4 py-2 text-[11px] font-medium uppercase tracking-[0.07em] text-muted-foreground">
              {gr.aisle}
            </h3>
            <ul className="divide-y divide-border">
              {gr.items.map((it) => {
                const on = checked.has(it.food);
                return (
                  <li key={it.food}>
                    <button
                      type="button"
                      onClick={() => toggle(it.food)}
                      aria-pressed={on}
                      className="flex w-full items-start gap-3 px-4 py-2 text-left transition-colors hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <span
                        className={cn(
                          "mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors duration-150",
                          on ? "border-success bg-success text-white" : "border-border text-transparent",
                        )}
                      >
                        <Check weight="bold" className="h-3 w-3" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-[13px]", on && "text-muted-foreground line-through decoration-success/60")}>
                          {it.name}
                        </span>
                        {it.buy && <span className="block text-[11.5px] leading-snug text-muted-foreground">{it.buy}</span>}
                      </span>
                      <span className="shrink-0 pt-px text-[12px] tabular-nums text-muted-foreground">{amount(it)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
