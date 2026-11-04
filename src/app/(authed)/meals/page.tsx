import { resolvePeople } from "@/lib/chores";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/queries";
import { bucharestDay } from "@/lib/supplements";
import { isDay, mondayOf, weekOf } from "@/lib/meal-plan";
import { MealsBoard, type ChoiceRow } from "@/components/meals/meals-board";

export const dynamic = "force-dynamic";

export default async function MealsPage(props: { searchParams: Promise<{ w?: string }> }) {
  const { w } = await props.searchParams;
  const today = bucharestDay(new Date());
  const days = weekOf(w && isDay(w) ? w : today);

  const [rows, settings] = await Promise.all([
    db.mealChoice.findMany({
      where: { day: { gte: days[0], lte: days[6] } },
      select: { day: true, person: true, meal: true, variant: true },
    }),
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
    />
  );
}
