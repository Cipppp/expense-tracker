import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendPushToAll } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TZ = "Europe/Bucharest";
const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });

export async function GET(req: Request) {
  // Vercel attaches `Authorization: Bearer <CRON_SECRET>` to cron requests.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Skip if a reason was already added today (Bucharest time).
  const today = dayKey(new Date());
  const since = new Date(Date.now() - 36 * 3600 * 1000); // small window, cheap
  const recent = await db.gratitudeItem.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true },
  });
  const hasToday = recent.some((r) => dayKey(r.createdAt) === today);
  if (hasToday) {
    return NextResponse.json({ ok: true, skipped: "already added today" });
  }

  await sendPushToAll({
    title: "Un motiv pentru azi?",
    body: "Nu uitați să adăugați ceva frumos pe listă.",
    url: "/gratitude",
    tag: "daily-reminder",
  });
  return NextResponse.json({ ok: true, sent: true });
}
