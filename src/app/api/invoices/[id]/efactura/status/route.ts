import { NextResponse } from "next/server";
import { efacturaStatus } from "@/lib/anaf/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// stareMesaj (25s) + descarcare (25s) + arhivare trebuie sa incapa.
export const maxDuration = 60;

/**
 * Starea e-Factura a facturii, cu un pas de urmarire la ANAF daca e pe drum
 * (stareMesaj, apoi descarcare + arhivare pe stare finala). Panoul o cheama
 * la deschidere si la "Refresh".
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const status = await efacturaStatus(id, { refresh: true });
  if (!status) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(status);
}
