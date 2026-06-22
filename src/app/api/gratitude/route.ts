import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const Body = z.object({
  text: z.string().trim().min(1).max(500),
  author: z.enum(["cip", "axy"]).nullable().optional(),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const item = await db.gratitudeItem.create({
    data: { text: parsed.data.text, author: parsed.data.author ?? null },
  });
  return NextResponse.json({ ok: true, item });
}
