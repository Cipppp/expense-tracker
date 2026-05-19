import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getNextInvoiceNumber, sumLines } from "@/lib/invoice";

export const dynamic = "force-dynamic";

const LineInput = z.object({
  description: z.string().min(1),
  unit: z.string().default("buc"),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().nonnegative(),
});

const Body = z.object({
  jobId: z.string().optional().nullable(),
  clientName: z.string().min(1),
  clientCompany: z.string().min(1),
  clientCui: z.string().optional().nullable(),
  clientReg: z.string().optional().nullable(),
  clientAddress: z.string().optional().nullable(),
  clientCountry: z.string().optional().nullable(),
  issuedAt: z.string(),                       // yyyy-mm-dd
  dueAt: z.string().optional().nullable(),    // yyyy-mm-dd
  invoiceCurrency: z.enum(["RON", "USD", "EUR"]).default("RON"),
  bnrRate: z.coerce.number().positive().optional().nullable(),
  footerNote: z.string().optional().nullable(),
  lines: z.array(LineInput).min(1),
});

export async function GET() {
  const invoices = await db.invoice.findMany({
    orderBy: [{ issuedAt: "desc" }, { seriesNumber: "desc" }],
    include: { lines: { orderBy: { position: "asc" } }, job: true },
  });
  return NextResponse.json({ invoices });
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const v = parsed.data;
  const settings = await db.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
  const series = settings.invoiceSeries;
  const { number, seriesNumber } = await getNextInvoiceNumber(series);

  const linesWithAmount = v.lines.map((l, i) => ({
    ...l,
    position: i + 1,
    amount: Math.round(l.quantity * l.unitPrice * 100) / 100,
  }));

  const invoice = await db.invoice.create({
    data: {
      number,
      series,
      seriesNumber,
      issuedAt: new Date(`${v.issuedAt}T12:00:00`),
      dueAt: v.dueAt ? new Date(`${v.dueAt}T12:00:00`) : null,
      jobId: v.jobId ?? null,
      clientName: v.clientName,
      clientCompany: v.clientCompany,
      clientCui: v.clientCui ?? null,
      clientReg: v.clientReg ?? null,
      clientAddress: v.clientAddress ?? null,
      clientCountry: v.clientCountry ?? null,
      invoiceCurrency: v.invoiceCurrency,
      legalCurrency: "RON",
      bnrRate: v.bnrRate ?? null,
      footerNote: v.footerNote ?? null,
      status: "draft",
      lines: { create: linesWithAmount },
    },
    include: { lines: true },
  });

  return NextResponse.json({
    ok: true,
    invoice,
    total: sumLines(invoice.lines),
  });
}
