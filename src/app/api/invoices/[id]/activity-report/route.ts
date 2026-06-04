import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildActivityReport, type ActivityEntry } from "@/lib/activity-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Download a black-and-white .xlsx activity report (Clockify-style timesheet)
 * for an invoice. Entries come from the time entries linked to the invoice
 * (Income.invoiceId); if the invoice wasn't generated from logged hours, we
 * fall back to the client's entries in the invoice's issue month.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const invoice = await db.invoice.findUnique({
    where: { id },
    include: { lines: true, billedEntries: true, job: true },
  });
  if (!invoice) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const settings = await db.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  // 1. Prefer the entries explicitly linked to this invoice.
  let rows = invoice.billedEntries.filter(
    (e) => e.startMinutes != null && e.endMinutes != null,
  );

  // 2. Fallback: the client's hourly entries in the invoice's issue month.
  //    Dates are stored at noon UTC, so derive the month with UTC getters to
  //    match the UTC bounds (no off-by-one near month edges in any timezone).
  if (rows.length === 0 && invoice.jobId) {
    const y = invoice.issuedAt.getUTCFullYear();
    const m = invoice.issuedAt.getUTCMonth();
    const monthStart = new Date(Date.UTC(y, m, 1, 0, 0, 0));
    const monthEnd = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));
    rows = await db.income.findMany({
      where: {
        jobId: invoice.jobId,
        startMinutes: { not: null },
        endMinutes: { not: null },
        date: { gte: monthStart, lte: monthEnd },
      },
      orderBy: { date: "asc" },
    });
  }

  const entries: ActivityEntry[] = rows
    .slice()
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((e) => ({
      date: e.date,
      startMinutes: e.startMinutes,
      endMinutes: e.endMinutes,
      hours: e.hours ?? 0,
      description: e.description,
    }));

  // Period label: span of the entries, else the invoice month.
  let periodLabel: string;
  if (entries.length > 0) {
    const first = entries[0].date;
    const last = entries[entries.length - 1].date;
    const fmt = (d: Date) =>
      d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    periodLabel = first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear()
      ? first.toLocaleDateString("en-GB", { month: "long", year: "numeric" })
      : `${fmt(first)} – ${fmt(last)}`;
  } else {
    periodLabel = invoice.issuedAt.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  }

  // Use the rate snapshotted on the billed entries (hourlyRate at the time of
  // logging) and the invoice's own currency — NOT the client's current job
  // values, which can drift after the invoice is issued. Fall back to the
  // live job rate only when there are no entries with a stored rate.
  const snapshotRate = rows.find((r) => r.hourlyRate != null)?.hourlyRate;
  const rate = snapshotRate ?? invoice.job?.rateUsd ?? 0;
  const currency = invoice.invoiceCurrency || invoice.job?.defaultCurrency || "USD";

  const buffer = await buildActivityReport({
    supplier: settings.issuerName,
    client: invoice.clientCompany,
    invoiceLabel: `${invoice.series} ${invoice.number}`,
    periodLabel,
    generatedAt: new Date(),
    currency,
    rate,
    entries,
  });

  const filename = `Activity-report_${invoice.series}${invoice.number}_${invoice.clientCompany.replace(/[^A-Za-z0-9]+/g, "-")}.xlsx`;
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
