import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  await db.gratitudeItem.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
