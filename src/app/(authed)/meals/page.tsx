import { resolvePeople } from "@/lib/chores";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/queries";
import { bucharestDay } from "@/lib/supplements";
import { isDay, mondayOf, weekOf } from "@/lib/meal-plan";
import { MealsBoard, type ChoiceRow } from "@/components/meals/meals-board";
import type { CheckIn } from "@/components/meals/check-ins";
import { MEASUREMENTS } from "@/lib/body";

export const dynamic = "force-dynamic";

export default async function MealsPage(props: { searchParams: Promise<{ w?: string }> }) {
  const { w } = await props.searchParams;
  const today = bucharestDay(new Date());
  const days = weekOf(w && isDay(w) ? w : today);

  const [rows, checkIns, shopping, settings] = await Promise.all([
    db.mealChoice.findMany({
      where: { day: { gte: days[0], lte: days[6] } },
      select: { day: true, person: true, meal: true, variant: true, eaten: true },
    }),
    db.mealCheckIn.findMany({
      orderBy: { day: "asc" },
      select: {
        person: true,
        day: true,
        weightKg: true,
        note: true,
        ...Object.fromEntries(MEASUREMENTS.map((m) => [m.key, true])),
      },
    }),
    db.mealShoppingWeek.findFirst({ where: { week: days[0] }, select: { checked: true } }),
    getSettings(),
  ]);

  return (
    <MealsBoard
      key={days[0]}
      people={resolvePeople(settings)}
      days={days}
      today={today}
      thisWeek={mondayOf(today)}
      initialChoices={rows as ChoiceRow[]}
      initialCheckIns={checkIns as CheckIn[]}
      initialShopping={shopping?.checked ?? []}
    />
  );
}
