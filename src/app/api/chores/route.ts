import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const SwapBody = z.object({ swap: z.literal(true) });
const CheckBody = z.object({
  isoWeek: z.string().regex(/^\d{4}-W\d{2}$/),
  key: z.string().min(1), // ID-ul sarcinii; era "set-zi-index" inainte
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


const EditBody = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add"),
    setId: z.union([z.literal(1), z.literal(2)]),
    day: z.coerce.number().int().min(0).max(6),
    label: z.string().trim().min(1).max(80),
  }),
  z.object({ action: z.literal("remove"), id: z.string().min(1) }),
]);

/** Adauga sau sterge o sarcina din lista saptamanala. */
export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = EditBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const v = parsed.data;

  if (v.action === "add") {
    const last = await db.chore.findFirst({
      where: { setId: v.setId, day: v.day },
      orderBy: { position: "desc" },
    });
    const chore = await db.chore.create({
      data: {
        setId: v.setId,
        day: v.day,
        label: v.label.trim(),
        // Cumparaturile se marcau manual in tabelul vechi; le recunoastem
        // dupa text ca sa pastreze aceeasi evidentiere.
        shopping: /bringo|cump[aă]r/i.test(v.label),
        position: (last?.position ?? -1) + 1,
      },
    });
    return NextResponse.json({ ok: true, chore });
  }

  /*
   * Stergerea scoate si bifele care trimit la sarcina. Altfel raman ID-uri
   * orfane in ChoreWeek.done, iar progresul ar arata mai multe bifate decat
   * sarcini existente.
   */
  await db.chore.delete({ where: { id: v.id } });
  const weeks = await db.choreWeek.findMany();
  for (const w of weeks) {
    if (w.done.includes(v.id)) {
      await db.choreWeek.update({
        where: { isoWeek: w.isoWeek },
        data: { done: w.done.filter((d) => d !== v.id) },
      });
    }
  }
  return NextResponse.json({ ok: true });
}
