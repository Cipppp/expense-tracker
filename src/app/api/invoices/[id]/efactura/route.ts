import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { EU_MEMBER_STATES } from "@/lib/vat";
import { buildEfacturaXml } from "@/lib/efactura";
import { pickIssuerIban } from "@/lib/invoice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const iso = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const invoice = await db.invoice.findUnique({
    where: { id },
    include: { lines: { orderBy: { position: "asc" } } },
  });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Foreign-currency invoices need a BNR rate for the RON tax figures.
  if (
    invoice.invoiceCurrency !== "RON" &&
    invoice.clientCountry === "RO" &&
    !(invoice.bnrRate && invoice.bnrRate > 0)
  ) {
    return NextResponse.json(
      { error: "Set the BNR rate before exporting e-Factura XML." },
      { status: 422 },
    );
  }

  const settings = await db.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  const xml = buildEfacturaXml({
    issuer: {
      name: settings.issuerName,
      /*
       * BT-31, identificatorul de TVA al furnizorului. Pentru clientii din UE
       * se pune codul special art. 317 (RO55415170) — el e cel din VIES pe
       * care se sprijina taxarea inversa; CIF-ul firmei nu mai e valabil in
       * scopuri de TVA de la decizia F700 din 03.08.2026.
       */
      cif:
        settings.issuerVatIntra &&
        invoice.clientCountry &&
        invoice.clientCountry.toUpperCase() !== "RO" &&
        EU_MEMBER_STATES.has(invoice.clientCountry.toUpperCase())
          ? settings.issuerVatIntra
          : settings.issuerCif,
      reg: settings.issuerReg,
      address: settings.issuerAddress,
      iban: pickIssuerIban(settings, invoice.clientCountry, invoice.invoiceCurrency),
      swift: settings.issuerSwift,
    },
    invoice: {
      series: invoice.series,
      number: invoice.number,
      issuedAtISO: iso(invoice.issuedAt),
      dueAtISO: invoice.dueAt ? iso(invoice.dueAt) : null,
      clientCompany: invoice.clientCompany,
      clientCui: invoice.clientCui,
      clientReg: invoice.clientReg,
      clientAddress: invoice.clientAddress,
      clientCountry: invoice.clientCountry,
      invoiceCurrency: invoice.invoiceCurrency,
      bnrRate: invoice.bnrRate,
      vatRate: invoice.vatRate,
      lines: invoice.lines.map((l) => ({
        description: l.description,
        unit: l.unit,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        amount: l.amount,
      })),
    },
  });

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="eFactura_${invoice.series}${invoice.number}.xml"`,
    },
  });
}
