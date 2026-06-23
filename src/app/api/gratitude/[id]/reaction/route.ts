import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const Body = z.object({
  person: z.enum(["cip", "axy"]),
  emoji: z.string().min(1).max(16),
});

// WhatsApp-style: one reaction per person per entry. Same emoji again toggles
// it off; a different emoji replaces it.
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { person, emoji } = parsed.data;

  const existing = await db.gratitudeReaction.findUnique({
    where: { itemId_person: { itemId: id, person } },
  });
  if (existing && existing.emoji === emoji) {
    await db.gratitudeReaction.delete({ where: { id: existing.id } });
  } else {
    await db.gratitudeReaction.upsert({
      where: { itemId_person: { itemId: id, person } },
      update: { emoji },
      create: { itemId: id, person, emoji },
    });
  }

  const reactions = await db.gratitudeReaction.findMany({
    where: { itemId: id },
    select: { person: true, emoji: true },
  });
  return NextResponse.json({ ok: true, reactions });
}
