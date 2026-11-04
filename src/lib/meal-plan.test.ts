import { describe, expect, it } from "vitest";
import {
  FOODS,
  MEALS,
  PLANS,
  RECIPES,
  addDays,
  dayMacros,
  ingredientGrams,
  itemLabel,
  mondayOf,
  planRange,
  recipeMacros,
  shoppingList,
  variantMacros,
  weekOf,
  type Ingredient,
} from "@/lib/meal-plan";

const people = ["cip", "axy"] as const;

describe("meal plan data", () => {
  it("gives every food counted by the piece a piece weight", () => {
    const counted: Ingredient[] = [];
    for (const p of people)
      for (const { key } of MEALS)
        for (const v of PLANS[p].meals[key])
          for (const i of v.items) if ("count" in i) counted.push(i);
    for (const r of Object.values(RECIPES)) for (const i of r.ingredients) if ("count" in i) counted.push(i);

    expect(counted.length).toBeGreaterThan(0);
    for (const i of counted) expect(ingredientGrams(i), i.food).toBeGreaterThan(0);
  });

  it("keeps variant keys unique within a meal", () => {
    for (const p of people)
      for (const { key } of MEALS) {
        const keys = PLANS[p].meals[key].map((v) => v.key);
        expect(new Set(keys).size, `${p} ${key}`).toBe(keys.length);
      }
  });

  it("keeps per-100 g values physically possible", () => {
    for (const [k, f] of Object.entries(FOODS)) {
      // USDA counts baking powder's mineral salts as carbohydrate "by difference".
      if (k === "bakingPowder") continue;
      const { kcal, protein, carbs, fat } = f.per100;
      // Macros can't weigh more than the food, and kcal can't be far below 4/4/9.
      expect(protein + carbs + fat, k).toBeLessThanOrEqual(100.5);
      expect(kcal, k).toBeGreaterThanOrEqual((protein * 4 + carbs * 4 + fat * 9) * 0.85 - 5);
    }
  });
});

describe("nutrition math", () => {
  it("splits a recipe across its portions", () => {
    // 1 kg potato + 100 g butter + 100 ml milk, in six portions.
    const mash = recipeMacros("mash");
    expect(mash.kcal).toBeCloseTo((770 + 740 + 46) / 6, 0);
  });

  it("matches the nutritionist's plan at 1,400–1,700 kcal a day", () => {
    const { min, max } = planRange("axy");
    expect(min.kcal).toBeGreaterThan(1350);
    expect(max.kcal).toBeLessThan(1750);
  });

  it("lands every combination of Cip's plan near his 2,000 kcal / 170 g target", () => {
    const { min, max } = planRange("cip");
    expect(min.kcal).toBeGreaterThan(1800);
    expect(max.kcal).toBeLessThan(2200);
    for (const { key } of MEALS)
      for (const v of PLANS.cip.meals[key]) expect(variantMacros(v).protein, v.title).toBeGreaterThan(15);
    expect(min.protein).toBeGreaterThanOrEqual(165);
  });

  it("counts only the meals that were picked", () => {
    const full = dayMacros("cip", { breakfast: "v1", lunch: "v1", snack: "v1", dinner: "v1" });
    const half = dayMacros("cip", { breakfast: "v1", lunch: "v1" });
    expect(half.kcal).toBeLessThan(full.kcal);
    expect(dayMacros("cip", {}).kcal).toBe(0);
    expect(dayMacros("cip", { breakfast: "v9" }).kcal).toBe(0);
  });

  it("writes amounts the way the plan does", () => {
    expect(itemLabel({ food: "egg", count: 2 })).toBe("2 ouă");
    expect(itemLabel({ food: "apple", grams: 100 })).toBe("100 g măr");
    expect(itemLabel({ recipe: "bananaBread", portions: 1 })).toBe("1 porție de banana bread");
  });
});

describe("week dates", () => {
  it("starts the week on Monday", () => {
    expect(mondayOf("2026-11-04")).toBe("2026-11-02"); // Wednesday
    expect(mondayOf("2026-11-08")).toBe("2026-11-02"); // Sunday
    expect(mondayOf("2026-11-02")).toBe("2026-11-02");
  });

  it("crosses months and the DST change without drifting", () => {
    expect(weekOf("2026-10-29")).toEqual([
      "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01",
    ]);
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
  });
});

describe("shopping list", () => {
  const lunch = (person: "cip" | "axy", variant = "v1") => ({ person, meal: "lunch" as const, variant });

  it("adds the same food across people and counts recipe portions only", () => {
    const groups = shoppingList([lunch("cip"), lunch("axy")]);
    const items = Object.fromEntries(groups.flatMap((gr) => gr.items.map((i) => [i.food, i])));

    expect(items.chickenBreast.grams).toBe(350); // 200 g for Cip + 150 g for Axy
    expect(items.potato.grams).toBeCloseTo(2000 / 6, 5); // two portions of a six-portion mash
    expect(items.kinderCard.pieces).toMatchObject({ count: 2 });
    expect(groups[0].aisle).toBe("Carne și pește");
  });

  it("ignores picks the plan doesn't have", () => {
    expect(shoppingList([{ person: "cip", meal: "lunch", variant: "v9" }])).toEqual([]);
  });
});
