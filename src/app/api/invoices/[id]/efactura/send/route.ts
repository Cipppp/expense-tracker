import { NextResponse } from "next/server";
import { sendInvoice } from "@/lib/anaf/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// validare + upload + trei sondaje inline: ~30 s in cazul lent.
export const maxDuration = 60;

/**
 * POST { force?: boolean }
 * `force` trimite si o factura din afara scopului legal (client strain), cu
 * extern=DA, si fixeaza politica facturii pe "send".
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { force?: boolean };
  const out = await sendInvoice(id, { force: Boolean(body?.force) });
  if (out.ok) return NextResponse.json(out);
  return NextResponse.json(out, { status: out.status });
}
