import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { centsFromUsd, dateAtNoonUTC } from "@/lib/format";

const Update = z.object({
  status: z.enum(["draft", "issued", "paid", "void"]).optional(),
  paidAt: z.string().optional().nullable(),
  footerNote: z.string().optional().nullable(),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const inv = await db.invoice.findUnique({
    where: { id },
    include: { lines: { orderBy: { position: "asc" } }, job: true },
  });
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ invoice: inv });
}

/**
 * Marking an invoice as paid also creates an Income entry mirroring it, so
 * the dashboard reflects revenue. Currency conversion: USD invoices land as
 * USD directly; EUR/RON convert via the invoice's bnrRate + the current
 * settings FX (RON↔USD).
 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = Update.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const existing = await db.invoice.findUnique({
    where: { id },
    include: { lines: true, billedEntries: { select: { id: true } } },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const v = parsed.data;
  const data: {
    status?: string;
    paidAt?: Date | null;
    footerNote?: string | null;
    paidIncomeId?: string | null;
  } = {};

  if (v.status) data.status = v.status;
  if (v.footerNote !== undefined) data.footerNote = v.footerNote;
  if (v.paidAt !== undefined) {
    data.paidAt = v.paidAt ? dateAtNoonUTC(v.paidAt) : null;
  }

  /*
   * Transition to paid: mirror the invoice into Income — but ONLY for an
   * invoice that has no logged hours behind it.
   *
   * Invoices built from the time tracker already tagged their source rows
   * with invoiceId, and those rows stay in Income. Minting a second row for
   * the same money made Earned YTD, the monthly chart and the tax projection
   * count that invoice twice. The mirror row exists for lump-sum invoices
   * typed by hand, which have no Income behind them.
   */
  if (
    v.status === "paid" &&
    !existing.paidIncomeId &&
    existing.billedEntries.length === 0
  ) {
    const total = existing.lines.reduce((a, l) => a + l.amount, 0);
    const settings = await db.settings.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1 },
    });

    let amountUsdCents = 0;
    if (existing.invoiceCurrency === "USD") {
      amountUsdCents = centsFromUsd(total);
    } else if (existing.invoiceCurrency === "EUR") {
      // EUR → RON via bnrRate, RON → USD via settings.fxRonToUsd.
      const ron = total * (existing.bnrRate ?? 5);
      amountUsdCents = centsFromUsd(ron * settings.fxRonToUsd);
    } else {
      // RON
      amountUsdCents = centsFromUsd(total * settings.fxRonToUsd);
    }

    const income = await db.income.create({
      data: {
        date: data.paidAt ?? new Date(),
        description: `Invoice ${existing.series} ${existing.number} — ${existing.clientCompany}`,
        source: existing.clientCompany,
        jobId: existing.jobId,
        amountUsd: amountUsdCents,
      },
    });
    data.paidIncomeId = income.id;
  }

  // Transition away from paid: detach the income. Clearing the pointer too,
  // otherwise marking the invoice paid again finds paidIncomeId still set and
  // silently records no revenue at all.
  if (existing.paidIncomeId && v.status && v.status !== "paid") {
    await db.income.deleteMany({ where: { id: existing.paidIncomeId } });
    data.paidIncomeId = null;
  }

  // Voiding an invoice releases the billed entries back to "unbilled" so
  // they can be picked up by a replacement invoice. Non-void status changes
  // leave the linked entries alone.
  if (v.status === "void") {
    await db.income.updateMany({
      where: { invoiceId: id },
      data: { invoiceId: null },
    });
  }

  const updated = await db.invoice.update({
    where: { id },
    data,
    include: { lines: { orderBy: { position: "asc" } } },
  });
  return NextResponse.json({ ok: true, invoice: updated });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const existing = await db.invoice.findUnique({ where: { id } });
  if (existing?.paidIncomeId) {
    await db.income.deleteMany({ where: { id: existing.paidIncomeId } });
  }
  await db.invoice.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
