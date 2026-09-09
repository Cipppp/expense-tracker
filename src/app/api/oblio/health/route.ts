import { getSettings, requireUserId } from "@/lib/queries";
import { NextResponse } from "next/server";
import { oblioConfigured, oblioPreflight } from "@/lib/oblio";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * Verificare read-only a legaturii cu Oblio. Nu emite si nu modifica nimic.
 *
 * Exista pentru ca singurul alt mod de a afla daca integrarea merge era sa
 * emiti o factura adevarata — iar o factura gresita in contabilitate se
 * repara doar cu o stornare. Ruta autentifica, citeste nomenclatoarele si
 * compara ce are contul cu ce trimite `createOblioInvoice`: seria, CIF-ul,
 * si numele cotelor de TVA. Alea trei sunt exact lucrurile care fac prima
 * factura reala sa fie respinsa.
 */
export async function GET(req: Request) {
  /*
   * Acelasi Bearer ca /api/timelog. Ruta e scoasa din sesiunea de browser ca
   * sa poata fi verificata si din afara (curl, cron), dar citeste date de
   * cont, deci nu e publica.
   */
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const s = await getSettings();
  if (!s?.timelogToken || token !== s.timelogToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!oblioConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        error: "OBLIO_EMAIL / OBLIO_SECRET are not set on this deployment.",
      },
      { status: 422 },
    );
  }

  const settings = await getSettings();
  try {
    const result = await oblioPreflight({
      series: settings.invoiceSeries,
      issuerCif: settings.issuerCif,
      issuerVatIntra: settings.issuerVatIntra,
    });
    return NextResponse.json({ ok: result.problems.length === 0, ...result });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        configured: true,
        error: err instanceof Error ? err.message : "Oblio call failed",
      },
      { status: 502 },
    );
  }
}
