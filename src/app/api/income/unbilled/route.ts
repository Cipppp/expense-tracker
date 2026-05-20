import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Time entries for a client that haven't been linked to an invoice yet.
 * Used by the invoice form to "pull from time tracker" — the response is
 * grouped by month so the user picks whole billable periods rather than
 * individual entries (cleaner one-line-per-month invoices).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const jobId = url.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  const rows = await db.income.findMany({
    where: {
      jobId,
      invoiceId: null,
      hours: { not: null },
      startMinutes: { not: null },
    },
    orderBy: { date: "asc" },
    select: {
      id: true,
      date: true,
      hours: true,
      hourlyRate: true,
      amountUsd: true,
      description: true,
    },
  });

  // Group by yyyy-mm for the UI.
  const groups = new Map<
    string,
    { month: string; entries: typeof rows; hours: number; amount: number }
  >();
  for (const r of rows) {
    const ym = r.date.toISOString().slice(0, 7);
    const g = groups.get(ym) ?? { month: ym, entries: [], hours: 0, amount: 0 };
    g.entries.push(r);
    g.hours += r.hours ?? 0;
    g.amount += r.amountUsd;
    groups.set(ym, g);
  }

  return NextResponse.json({
    groups: Array.from(groups.values()),
    totalHours: rows.reduce((a, r) => a + (r.hours ?? 0), 0),
    totalAmount: rows.reduce((a, r) => a + r.amountUsd, 0),
  });
}
