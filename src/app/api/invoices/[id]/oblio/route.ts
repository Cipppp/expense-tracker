import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createOblioInvoice, oblioConfigured } from "@/lib/oblio";
import { getSettings } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * Impinge o factura deja emisa in aplicatie si catre Oblio.
 *
 * Doua sisteme de numerotare care nu se cunosc ar produce serii divergente,
 * asa ca numarul primit inapoi de la Oblio se salveaza pe factura. Daca
 * factura a fost deja trimisa, ruta nu o mai trimite a doua oara — un duplicat
 * in contabilitate e mai greu de reparat decat un buton apasat degeaba.
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  // Autentificarea e facuta de middleware pentru tot /api in afara listei
  // publice; ruta asta nu e in ea.
  if (!oblioConfigured()) {
    return NextResponse.json(
      {
        error:
          "Oblio is not configured. Set OBLIO_EMAIL and OBLIO_SECRET, then redeploy.",
      },
      { status: 422 },
    );
  }

  const { id } = await ctx.params;
  const invoice = await db.invoice.findUnique({
    where: { id },
    include: { lines: { orderBy: { position: "asc" } }, job: true },
  });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (invoice.oblioNumber) {
    return NextResponse.json({
      already: true,
      oblioNumber: invoice.oblioNumber,
      oblioLink: invoice.oblioLink,
    });
  }

  if (
    invoice.invoiceCurrency !== invoice.legalCurrency &&
    !(invoice.bnrRate && invoice.bnrRate > 0)
  ) {
    return NextResponse.json(
      {
        error: `Invoice is in ${invoice.invoiceCurrency} but has no BNR rate. Set the rate first.`,
      },
      { status: 422 },
    );
  }

  const settings = await getSettings();

  /*
   * Pe facturile catre UE merge codul art. 317, nu CIF-ul firmei. Aceeasi
   * regula ca in PDF si in XML-ul de e-Factura.
   */
  const country = (invoice.clientCountry ?? "").trim().toUpperCase();
  const euReverse =
    invoice.vatRate === 0 && country !== "" && country !== "RO";
  const issuerCif =
    euReverse && settings.issuerVatIntra
      ? settings.issuerVatIntra
      : settings.issuerCif;

  try {
    const result = await createOblioInvoice({
      issuerCif,
      seriesName: invoice.series,
      issuedAt: invoice.issuedAt,
      dueAt: invoice.dueAt,
      currency: invoice.invoiceCurrency,
      exchangeRate: invoice.bnrRate,
      vatRate: invoice.vatRate,
      mentions: invoice.footerNote,
      client: {
        name: invoice.clientCompany || invoice.clientName,
        cif: invoice.clientCui,
        rc: invoice.clientReg,
        address: invoice.clientAddress,
        country: invoice.clientCountry,
        email: invoice.job?.email ?? null,
      },
      lines: invoice.lines.map((l) => ({
        description: l.description,
        unit: l.unit,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
      })),
    });

    const saved = await db.invoice.update({
      where: { id },
      data: { oblioNumber: `${result.seriesName} ${result.number}`.trim(), oblioLink: result.link },
      select: { oblioNumber: true, oblioLink: true },
    });
    return NextResponse.json({ ...saved, already: false });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Oblio call failed" },
      { status: 502 },
    );
  }
}
