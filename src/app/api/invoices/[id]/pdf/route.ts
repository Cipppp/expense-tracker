import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { db } from "@/lib/db";
import { InvoicePdf } from "@/components/invoices/invoice-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const invoice = await db.invoice.findUnique({
    where: { id },
    include: { lines: { orderBy: { position: "asc" } } },
  });
  if (!invoice) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // A foreign-currency invoice without a BNR rate can't be rendered in RON —
  // refuse rather than silently print amounts at an implicit rate of 1.
  if (
    invoice.invoiceCurrency !== invoice.legalCurrency &&
    !(invoice.bnrRate && invoice.bnrRate > 0)
  ) {
    return NextResponse.json(
      {
        error: `Invoice ${invoice.series} ${invoice.number} is in ${invoice.invoiceCurrency} but has no BNR rate. Set the BNR rate before exporting the PDF.`,
      },
      { status: 422 },
    );
  }

  const settings = await db.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  const fmtDate = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

  const buffer = await renderToBuffer(
    InvoicePdf({
      issuer: {
        name: settings.issuerName,
        cif: settings.issuerCif,
        reg: settings.issuerReg,
        address: settings.issuerAddress,
        iban: settings.issuerIban,
        bank: settings.issuerBank,
        capital: settings.issuerCapital,
        signer: settings.issuerSigner,
      },
      invoice: {
        series: invoice.series,
        number: invoice.number,
        issuedAt: fmtDate(invoice.issuedAt),
        dueAt: invoice.dueAt ? fmtDate(invoice.dueAt) : null,
        clientName: invoice.clientName,
        clientCompany: invoice.clientCompany,
        clientCui: invoice.clientCui,
        clientReg: invoice.clientReg,
        clientAddress: invoice.clientAddress,
        clientCountry: invoice.clientCountry,
        invoiceCurrency: invoice.invoiceCurrency,
        legalCurrency: invoice.legalCurrency,
        bnrRate: invoice.bnrRate,
        vatRate: invoice.vatRate,
        footerNote: invoice.footerNote,
        lines: invoice.lines.map((l) => ({
          description: l.description,
          unit: l.unit,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          amount: l.amount,
        })),
      },
    }),
  );

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${settings.issuerName.replace(
        /\s+/g,
        "-",
      )}_${invoice.series}${invoice.number}.pdf"`,
    },
  });
}
