import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
  person: z.enum(["cip", "axy"]).nullable().optional(),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }
  const { endpoint, keys, person } = parsed.data;
  await db.pushSubscription.upsert({
    where: { endpoint },
    update: { p256dh: keys.p256dh, auth: keys.auth, person: person ?? null },
    create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, person: person ?? null },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const json = await req.json().catch(() => null);
  const endpoint = json?.endpoint;
  if (typeof endpoint === "string") {
    await db.pushSubscription.delete({ where: { endpoint } }).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}
