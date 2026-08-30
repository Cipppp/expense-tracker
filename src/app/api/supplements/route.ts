import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { SUPP_BY_KEY } from "@/lib/supplements";

export const dynamic = "force-dynamic";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

// GET ?from=yyyy-mm-dd&to=yyyy-mm-dd → all logs in the range (both persons),
// used for the day board and the 7-day metrics strip.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? from;
  if (!DAY.test(from) || !DAY.test(to)) {
    return NextResponse.json({ error: "from/to required (yyyy-mm-dd)" }, { status: 400 });
  }
  const logs = await db.supplementLog.findMany({
    where: { day: { gte: from, lte: to } },
    select: { day: true, person: true, key: true, count: true, updatedAt: true },
  });
  return NextResponse.json({ logs }, { headers: { "Cache-Control": "no-store" } });
}

const Patch = z.object({
  day: z.string().regex(DAY),
  person: z.enum(["cip", "axy"]),
  key: z.string(),
  count: z.coerce.number().int().min(0).max(20),
});

// PATCH { day, person, key, count } — absolute count (client computes the next
// value: tap increments, tap at target resets to 0).
export async function PATCH(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Patch.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { day, person, key, count } = parsed.data;
  if (!SUPP_BY_KEY[key]) {
    return NextResponse.json({ error: "Unknown supplement" }, { status: 400 });
  }
  await db.supplementLog.upsert({
    where: { day_person_key: { day, person, key } },
    update: { count },
    create: { day, person, key, count },
  });
  return NextResponse.json({ ok: true });
}

const CatalogBody = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add"),
    name: z.string().trim().min(1).max(80),
    short: z.string().trim().max(120).optional().default(""),
    unit: z.string().trim().min(1).max(24).optional().default("capsulă"),
    target: z.coerce.number().int().min(1).max(20).optional().default(1),
    timing: z.enum(["morning", "noon", "evening", "preworkout"]),
    suggestedFor: z.enum(["cip", "axy"]).nullable().optional(),
  }),
  z.object({ action: z.literal("remove"), key: z.string().min(1) }),
]);

/** Adauga sau scoate un supliment din catalog. */
export async function PUT(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = CatalogBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const v = parsed.data;

  if (v.action === "add") {
    /*
     * Cheia se deriva din nume si trebuie sa fie stabila: bifele din
     * SupplementLog trimit la ea, deci nu se schimba niciodata dupa creare.
     * Un sufix numeric rezolva coliziunile ("Magneziu" de doua ori).
     */
    const base =
      v.name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "supliment";
    let key = base;
    for (let i = 2; await db.supplement.findUnique({ where: { key } }); i++) {
      key = `${base}-${i}`;
    }
    const last = await db.supplement.findFirst({ orderBy: { position: "desc" } });
    const row = await db.supplement.create({
      data: {
        key,
        name: v.name.trim(),
        short: v.short ?? "",
        unit: v.unit ?? "capsulă",
        target: v.target ?? 1,
        timing: v.timing,
        suggestedFor: v.suggestedFor ?? null,
        benefits: [],
        interactions: [],
        cautions: [],
        daily: true,
        position: (last?.position ?? -1) + 1,
      },
    });
    return NextResponse.json({ ok: true, supplement: row });
  }

  // Bifele raman: sunt un fapt istoric ("am luat asta pe 12 august"), iar
  // stergerea produsului din catalog nu il face neluat.
  await db.supplement.delete({ where: { key: v.key } });
  return NextResponse.json({ ok: true });
}
