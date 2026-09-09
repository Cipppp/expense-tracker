import { NextResponse } from "next/server";
import { buildForInvoice } from "@/lib/anaf/build";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * XML-ul e-Factura al facturii, exact cel pe care l-ar trimite aplicatia la
 * ANAF. Blocajele (judet lipsa etc.) vin in header, ca fisierul sa se poata
 * totusi descarca si corecta de mana.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const built = await buildForInvoice(id);
  if (!built) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { invoice, doc } = built;

  return new NextResponse(doc.xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="eFactura_${invoice.series}${invoice.number}.xml"`,
      "X-EFactura-Blockers": String(doc.blockers.length),
      "X-EFactura-Extern": doc.extern ? "DA" : "NU",
    },
  });
}
