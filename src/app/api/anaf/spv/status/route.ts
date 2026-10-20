import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cand a terminat Mac-ul ultima sincronizare; butonul din pagina ANAF il asteapta. */
export async function GET() {
  const userId = await requireUserId();
  const s = await db.settings.findUnique({ where: { userId }, select: { spvSyncedAt: true } });
  const unread = await db.spvMessage.count({ where: { readAt: null } });
  return NextResponse.json({ syncedAt: s?.spvSyncedAt?.toISOString() ?? null, unread });
}
