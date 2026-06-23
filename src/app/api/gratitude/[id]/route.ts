import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const Patch = z.object({ text: z.string().trim().min(1).max(500) });

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = Patch.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid text" }, { status: 400 });
  }
  const item = await db.gratitudeItem
    .update({ where: { id }, data: { text: parsed.data.text } })
    .catch(() => null);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, item });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  await db.gratitudeItem.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
