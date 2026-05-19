import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { centsFromUsd } from "@/lib/format";

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
    include: { lines: true },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const v = parsed.data;
  const data: {
    status?: string;
    paidAt?: Date | null;
    footerNote?: string | null;
    paidIncomeId?: string;
  } = {};

  if (v.status) data.status = v.status;
  if (v.footerNote !== undefined) data.footerNote = v.footerNote;
  if (v.paidAt !== undefined) {
    data.paidAt = v.paidAt ? new Date(`${v.paidAt}T12:00:00`) : null;
  }

  // Transition to paid: create the linked Income entry if not already there.
  if (v.status === "paid" && !existing.paidIncomeId) {
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

  // Transition away from paid: detach the income.
  if (existing.paidIncomeId && v.status && v.status !== "paid") {
    await db.income.deleteMany({ where: { id: existing.paidIncomeId } });
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
