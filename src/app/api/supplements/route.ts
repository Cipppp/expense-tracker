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
