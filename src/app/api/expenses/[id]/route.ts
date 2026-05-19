import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const Update = z.object({
  excluded: z.boolean().optional(),
  category: z.string().min(1).optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = Update.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const expense = await db.expense.update({
    where: { id },
    data: parsed.data,
  });
  return NextResponse.json({ ok: true, expense });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  await db.expense.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
