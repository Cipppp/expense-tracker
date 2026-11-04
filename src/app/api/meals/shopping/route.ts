import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/queries";
import { FOODS, isDay, mondayOf } from "@/lib/meal-plan";

export const dynamic = "force-dynamic";

const Body = z.object({
  week: z.string().refine((d) => isDay(d) && mondayOf(d) === d, "a Monday, yyyy-mm-dd"),
  checked: z.array(z.string().refine((k) => k in FOODS, "unknown food")).max(200),
});

// PUT { week, checked } — the whole ticked set for that week's shopping list.
export async function PUT(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { week, checked } = parsed.data;
  const userId = await requireUserId();
  await db.mealShoppingWeek.upsert({
    where: { userId_week: { userId, week } },
    update: { checked: [...new Set(checked)] },
    create: { userId, week, checked: [...new Set(checked)] },
  });
  return NextResponse.json({ ok: true });
}
