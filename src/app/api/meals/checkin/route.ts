import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/queries";
import { isDay } from "@/lib/meal-plan";
import { MEASUREMENTS, type MeasurementKey } from "@/lib/body";

export const dynamic = "force-dynamic";

const Person = z.enum(["cip", "axy"]);

const cm = z.number().min(10).max(250).nullable().default(null);
const measures = Object.fromEntries(MEASUREMENTS.map((m) => [m.key, cm])) as Record<MeasurementKey, typeof cm>;

const Body = z
  .object({
    person: Person,
    day: z.string().refine(isDay, "yyyy-mm-dd"),
    weightKg: z.number().min(30).max(250).nullable(),
    ...measures,
    note: z.string().trim().max(500).default(""),
  })
  .refine(
    (b) => b.weightKg !== null || MEASUREMENTS.some((m) => b[m.key] !== null) || b.note !== "",
    "Nimic de salvat",
  );

const SELECT = {
  person: true,
  day: true,
  weightKg: true,
  note: true,
  ...Object.fromEntries(MEASUREMENTS.map((m) => [m.key, true])),
} as Record<"person" | "day" | "weightKg" | "note" | MeasurementKey, true>;

// PUT { person, day, weightKg, waistCm, hipsCm, chestCm, thighCm, armCm, note } — one weigh-in per person per day; saving again replaces it.
export async function PUT(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { person, day, ...values } = parsed.data;
  const userId = await requireUserId();
  const row = await db.mealCheckIn.upsert({
    where: { userId_person_day: { userId, person, day } },
    update: values,
    create: { userId, person, day, ...values },
    select: SELECT,
  });
  return NextResponse.json({ ok: true, checkIn: row });
}

// DELETE ?person=cip&day=yyyy-mm-dd
export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const person = Person.safeParse(url.searchParams.get("person"));
  const day = url.searchParams.get("day") ?? "";
  if (!person.success || !isDay(day)) {
    return NextResponse.json({ error: "person and day required" }, { status: 400 });
  }
  await db.mealCheckIn.deleteMany({ where: { person: person.data, day } });
  return NextResponse.json({ ok: true });
}
