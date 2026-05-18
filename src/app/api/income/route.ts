import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { centsFromUsd } from "@/lib/format";

const Body = z.object({
  date: z.string(),
  description: z.string().min(1),
  source: z.string().min(1),
  hours: z.coerce.number().nonnegative().optional().nullable(),
  hourlyRate: z.coerce.number().nonnegative().optional().nullable(),
  amountUsd: z.coerce.number().nonnegative(),
  notes: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const v = parsed.data;
  const row = await db.income.create({
    data: {
      date: new Date(`${v.date}T12:00:00`),
      description: v.description,
      source: v.source,
      hours: v.hours ?? null,
      hourlyRate: v.hourlyRate ?? null,
      amountUsd: centsFromUsd(v.amountUsd),
      notes: v.notes ?? null,
    },
  });
  return NextResponse.json({ ok: true, id: row.id });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await db.income.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
