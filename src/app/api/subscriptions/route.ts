import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { baniFromRon, centsFromUsd, dateAtNoonUTC } from "@/lib/format";

export const dynamic = "force-dynamic";

const Create = z.object({
  name: z.string().min(1),
  category: z.string().default("Subscriptions"),
  // Amount in MAJOR units (RON). Plus optional fxRate; if absent we use settings.
  amountRon: z.coerce.number().positive(),
  fxRate: z.coerce.number().positive().optional(),
  frequency: z.enum(["monthly", "yearly"]).default("monthly"),
  dayOfMonth: z.coerce.number().int().min(1).max(31).default(1),
  startsAt: z.string().optional(),
  notes: z.string().optional().nullable(),
});

export async function GET() {
  const subs = await db.subscription.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  return NextResponse.json({ subscriptions: subs });
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Create.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const v = parsed.data;
  const settings = await db.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
  const fxRate = v.fxRate ?? settings.fxRonToUsd;
  const sub = await db.subscription.create({
    data: {
      name: v.name,
      category: v.category,
      amountRon: baniFromRon(v.amountRon),
      amountUsd: centsFromUsd(v.amountRon * fxRate),
      fxRate,
      frequency: v.frequency,
      dayOfMonth: v.dayOfMonth,
      startsAt: v.startsAt ? dateAtNoonUTC(v.startsAt) : new Date(),
      notes: v.notes ?? null,
    },
  });
  return NextResponse.json({ ok: true, subscription: sub });
}
