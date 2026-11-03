import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/queries";
import { findVariant, isDay, type MealKey } from "@/lib/meal-plan";

export const dynamic = "force-dynamic";

const Day = z.string().refine(isDay, "yyyy-mm-dd");
const Person = z.enum(["cip", "axy"]);
const Meal = z.enum(["breakfast", "lunch", "snack", "dinner"]);

// GET ?from=yyyy-mm-dd&to=yyyy-mm-dd → every choice in the range, both people.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? from;
  if (!isDay(from) || !isDay(to)) {
    return NextResponse.json({ error: "from/to required (yyyy-mm-dd)" }, { status: 400 });
  }
  const choices = await db.mealChoice.findMany({
    where: { day: { gte: from, lte: to } },
    select: { day: true, person: true, meal: true, variant: true },
  });
  return NextResponse.json({ choices }, { headers: { "Cache-Control": "no-store" } });
}

const Choice = z.object({
  day: Day,
  person: Person,
  meal: Meal,
  /** null clears the meal. */
  variant: z.string().min(1).max(8).nullable(),
});

const Body = z.object({ choices: z.array(Choice).min(1).max(7 * 4) });

/*
 * PUT { choices: [...] } — one tap sends one choice, "fill the week" sends up
 * to 28. The variant is checked against the plan in code: a key the plan
 * doesn't have would save fine and then show as an empty meal forever.
 */
export async function PUT(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const unknown = parsed.data.choices.find(
    (c) => c.variant !== null && !findVariant(c.person, c.meal as MealKey, c.variant),
  );
  if (unknown) {
    return NextResponse.json({ error: `Varianta ${unknown.variant} nu există la ${unknown.meal}` }, { status: 400 });
  }

  const userId = await requireUserId();
  await db.$transaction(
    parsed.data.choices.map(({ day, person, meal, variant }) =>
      variant === null
        ? db.mealChoice.deleteMany({ where: { day, person, meal } })
        : db.mealChoice.upsert({
            where: { userId_day_person_meal: { userId, day, person, meal } },
            update: { variant },
            create: { userId, day, person, meal, variant },
          }),
    ),
  );
  return NextResponse.json({ ok: true });
}
