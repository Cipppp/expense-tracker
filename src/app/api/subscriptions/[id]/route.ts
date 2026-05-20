import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { baniFromRon, centsFromUsd, dateAtNoonUTC } from "@/lib/format";

const Update = z.object({
  name: z.string().min(1).optional(),
  category: z.string().optional(),
  amountRon: z.coerce.number().positive().optional(),
  fxRate: z.coerce.number().positive().optional(),
  frequency: z.enum(["monthly", "yearly"]).optional(),
  dayOfMonth: z.coerce.number().int().min(1).max(31).optional(),
  active: z.boolean().optional(),
  endsAt: z.string().optional().nullable(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = Update.safeParse(json);
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

  const data: Record<string, unknown> = {};
  if (v.name !== undefined) data.name = v.name;
  if (v.category !== undefined) data.category = v.category;
  if (v.amountRon !== undefined) {
    data.amountRon = baniFromRon(v.amountRon);
    data.amountUsd = centsFromUsd(v.amountRon * fxRate);
    data.fxRate = fxRate;
  }
  if (v.frequency !== undefined) data.frequency = v.frequency;
  if (v.dayOfMonth !== undefined) data.dayOfMonth = v.dayOfMonth;
  if (v.active !== undefined) data.active = v.active;
  if (v.endsAt !== undefined) {
    data.endsAt = v.endsAt ? dateAtNoonUTC(v.endsAt) : null;
  }

  const sub = await db.subscription.update({ where: { id }, data });
  return NextResponse.json({ ok: true, subscription: sub });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await db.subscription.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
