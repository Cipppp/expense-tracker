import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sendPushToAll } from "@/lib/push";

export const runtime = "nodejs";
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

  // Notify the other person's device(s). Awaited (serverless freezes after the
  // response), but never allowed to fail the request.
  const who =
    parsed.data.author === "cip"
      ? "Cip"
      : parsed.data.author === "axy"
        ? "Axy"
        : null;
  await sendPushToAll(
    {
      title: who ? `${who} a adăugat un motiv` : "Un motiv nou pe listă",
      body: parsed.data.text,
      url: "/gratitude",
      tag: `gratitude-${item.id}`,
    },
    parsed.data.author ?? undefined,
  ).catch(() => {});

  return NextResponse.json({ ok: true, item });
}
