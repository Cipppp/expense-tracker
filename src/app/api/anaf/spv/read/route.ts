import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/** Marcheaza citite mesajele date, sau pe toate cand lista lipseste. */
const Body = z.object({ ids: z.array(z.string()).max(1000).optional() });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const ids = parsed.data.ids;
  const r = await db.spvMessage.updateMany({
    where: { readAt: null, ...(ids ? { id: { in: ids } } : {}) },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ updated: r.count });
}
