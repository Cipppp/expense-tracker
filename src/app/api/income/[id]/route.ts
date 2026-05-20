import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { centsFromUsd, dateAtNoonUTC } from "@/lib/format";

const Update = z.object({
  date: z.string().optional(),
  jobId: z.string().optional().nullable(),
  startMinutes: z.number().int().min(0).max(1440).optional(),
  endMinutes: z.number().int().min(0).max(2880).optional(),
  description: z.string().optional(),
  notes: z.string().optional().nullable(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = Update.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const v = parsed.data;

  const existing = await db.income.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const jobId = v.jobId === undefined ? existing.jobId : v.jobId;
  const job = jobId ? await db.job.findUnique({ where: { id: jobId } }) : null;

  const startMinutes = v.startMinutes ?? existing.startMinutes;
  const endMinutes = v.endMinutes ?? existing.endMinutes;

  let hours = existing.hours;
  let amountUsd = existing.amountUsd;
  if (startMinutes != null && endMinutes != null && job) {
    if (endMinutes <= startMinutes) {
      return NextResponse.json(
        { error: "End time must be after start time" },
        { status: 400 },
      );
    }
    hours = (endMinutes - startMinutes) / 60;
    amountUsd = centsFromUsd(hours * job.rateUsd);
  }

  const row = await db.income.update({
    where: { id },
    data: {
      date: v.date ? dateAtNoonUTC(v.date) : undefined,
      jobId,
      source: job ? job.name : existing.source,
      startMinutes,
      endMinutes,
      hours,
      hourlyRate: job ? job.rateUsd : existing.hourlyRate,
      amountUsd,
      description: v.description ?? existing.description,
      notes: v.notes === undefined ? existing.notes : v.notes,
    },
  });
  return NextResponse.json({ ok: true, row });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await db.income.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
