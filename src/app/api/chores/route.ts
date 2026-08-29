import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const SwapBody = z.object({ swap: z.literal(true) });
const CheckBody = z.object({
  isoWeek: z.string().regex(/^\d{4}-W\d{2}$/),
  key: z.string().regex(/^[12]-[0-6]-\d+$/), // set-day-chore
  done: z.boolean(),
});

export async function PATCH(req: Request) {
  const json = await req.json().catch(() => null);

  // 1) Flip the rotation phase (who's on Rândul 1 vs 2).
  const swap = SwapBody.safeParse(json);
  if (swap.success) {
    const s = await db.settings.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1 },
      select: { choresFlip: true },
    });
    const updated = await db.settings.update({
      where: { id: 1 },
      data: { choresFlip: !s.choresFlip },
      select: { choresFlip: true },
    });
    return NextResponse.json({ ok: true, choresFlip: updated.choresFlip });
  }

  // 2) Tick / untick a chore for a given week.
  const check = CheckBody.safeParse(json);
  if (check.success) {
    const { isoWeek, key, done } = check.data;
    /*
     * Citit-modificat-scris pe tot array-ul: doi oameni care bifeaza in
     * acelasi timp isi pierdeau bifa unul altuia, ultimul scriitor castiga.
     * Postgres poate face operatia atomic pe array, deci upsert-ul doar
     * asigura existenta randului, iar modificarea o face baza.
     */
    await db.choreWeek.upsert({
      where: { isoWeek },
      update: {},
      create: { isoWeek, done: [] },
    });
    if (done) {
      await db.$executeRaw`
        UPDATE "ChoreWeek"
        SET done = ARRAY(SELECT DISTINCT unnest(done || ARRAY[${key}]))
        WHERE "isoWeek" = ${isoWeek}`;
    } else {
      await db.$executeRaw`
        UPDATE "ChoreWeek"
        SET done = array_remove(done, ${key})
        WHERE "isoWeek" = ${isoWeek}`;
    }
    const updatedRow = await db.choreWeek.findUnique({
      where: { isoWeek },
    });
    return NextResponse.json({ ok: true, done: updatedRow?.done ?? [] });
  }

  return NextResponse.json({ error: "Invalid body" }, { status: 400 });
}
