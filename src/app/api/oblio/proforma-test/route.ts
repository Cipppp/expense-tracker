import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createOblioInvoice, oblioConfigured, oblioSeries } from "@/lib/oblio";
import { getSettings } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/*
 * Proba lantului Oblio, fara sa emiti o factura.
 *
 * Ia o factura existenta doar ca SURSA DE FORMA si trimite exact acelasi
 * payload catre /docs/proforma in loc de /docs/invoice. Trece prin aceeasi
 * autentificare, acelasi selector de firma, aceeasi fisa de client si
 * aceleasi nume de cote. Daca proforma e acceptata, payload-ul e valid si ca
 * factura.
 *
 * Diferenta care conteaza: proforma nu e document fiscal, nu consuma numar
 * din seria de facturi, nu intra in SPV si se sterge din interfata Oblio.
 * Costul unui esec e zero — spre deosebire de o factura gresita, care se
 * repara doar cu stornare.
 *
 * Nu scrie nimic in baza locala: `oblioNumber` ramane neatins, pentru ca
 * factura sursa NU a fost emisa la Oblio.
 */
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const s = await getSettings();
  if (!s?.timelogToken || bearer !== s.timelogToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!oblioConfigured()) {
    return NextResponse.json({ error: "Oblio is not configured" }, { status: 422 });
  }

  const body = await req.json().catch(() => ({}));
  const number = typeof body?.number === "string" ? body.number : null;
  if (!number) {
    return NextResponse.json(
      { error: "Pass { number: \"0014\" } — the invoice to copy the shape from." },
      { status: 400 },
    );
  }

  const invoice = await db.invoice.findFirst({
    where: { number },
    include: { lines: { orderBy: { position: "asc" } }, job: true },
  });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const settings = await getSettings();

  /*
   * Proforma are seria ei. Contul poate sa n-aiba niciuna — atunci nu e o
   * problema de payload, ci de configurare, si merita spus asa ca sa nu para
   * ca integrarea e stricata.
   */
  const all = await oblioSeries(settings.issuerCif);
  const proforma = all.find((x) => /proform/i.test(x.type));
  if (!proforma) {
    return NextResponse.json(
      {
        ok: false,
        inconclusive: true,
        error:
          "The Oblio account has no Proforma series, so the payload could not be tested. Add one in Oblio: Setari > Serii documente > Proforma. Nothing is wrong with the integration.",
        seriesInAccount: all,
      },
      { status: 409 },
    );
  }

  try {
    const result = await createOblioInvoice({
      docType: "proforma",
      issuerCif: settings.issuerCif,
      seriesName: proforma.name,
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
    return NextResponse.json({
      ok: true,
      shapeFrom: `${invoice.series} ${invoice.number}`,
      proformaSeries: proforma.name,
      client: invoice.clientCompany,
      country: invoice.clientCountry,
      currency: invoice.invoiceCurrency,
      vatRate: invoice.vatRate,
      proforma: result,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        shapeFrom: `${invoice.series} ${invoice.number}`,
        client: invoice.clientCompany,
        country: invoice.clientCountry,
        error: err instanceof Error ? err.message : "Oblio call failed",
      },
      { status: 502 },
    );
  }
}
