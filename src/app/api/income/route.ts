import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { centsFromUsd, dateAtNoonUTC } from "@/lib/format";

/**
 * Time entry shape:
 *   - jobId required, source filled in from job.name
 *   - startMinutes/endMinutes in 0-1440 (15-min step recommended)
 *   - hours derived from (end - start) / 60
 *   - amountUsd derived from hours * job.rateUsd
 *
 * Lump-sum shape:
 *   - source = client name (free text)
 *   - amountUsd given directly, no time range, no hours
 */
const TimeEntry = z.object({
  kind: z.literal("time"),
  date: z.string(),
  jobId: z.string().min(1),
  startMinutes: z.number().int().min(0).max(1440),
  // Up to 24h past the start of the day, so a shift that crosses midnight
  // can end at e.g. 30:00 (06:00 next day).
  endMinutes: z.number().int().min(0).max(2880),
  description: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const LumpSum = z.object({
  kind: z.literal("lumpsum"),
  date: z.string(),
  description: z.string().min(1),
  source: z.string().min(1),
  amountUsd: z.coerce.number().nonnegative(),
  notes: z.string().optional().nullable(),
});

const Body = z.discriminatedUnion("kind", [TimeEntry, LumpSum]);

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const v = parsed.data;

  if (v.kind === "time") {
    if (v.endMinutes <= v.startMinutes) {
      return NextResponse.json(
        { error: "End time must be after start time" },
        { status: 400 },
      );
    }
    const job = await db.job.findUnique({ where: { id: v.jobId } });
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const hours = (v.endMinutes - v.startMinutes) / 60;
    const amountUsd = centsFromUsd(hours * job.rateUsd);
    const row = await db.income.create({
      data: {
        date: dateAtNoonUTC(v.date),
        description: v.description?.trim() || `${hours.toFixed(2)}h · ${job.name}`,
        source: job.name,
        jobId: job.id,
        startMinutes: v.startMinutes,
        endMinutes: v.endMinutes,
        hours,
        hourlyRate: job.rateUsd,
        // job.rateUsd e tariful in moneda clientului, nu in USD (numele e
        // istoric). Fara linia asta randul ramane pe "USD" din schema si
        // 8h x 100 RON/h intra in Earned YTD ca $800.
        currency: job.defaultCurrency,
        amountUsd,
        notes: v.notes ?? null,
      },
    });
    return NextResponse.json({ ok: true, id: row.id });
  }

  const row = await db.income.create({
    data: {
      date: dateAtNoonUTC(v.date),
      description: v.description,
      source: v.source,
      amountUsd: centsFromUsd(v.amountUsd),
      notes: v.notes ?? null,
    },
  });
  return NextResponse.json({ ok: true, id: row.id });
}
