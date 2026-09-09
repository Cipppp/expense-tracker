import { NextResponse } from "next/server";
import { disconnect } from "@/lib/anaf/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sterge tokenurile. Urmatoarea trimitere cere iar certificatul. */
export async function POST() {
  await disconnect();
  return NextResponse.json({ ok: true });
}
