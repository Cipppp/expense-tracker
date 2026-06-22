import { NextResponse } from "next/server";
import { sendPushToAll } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Fires a test notification to every subscribed device. Used by the "trimite
// un test" button so you can confirm notifications actually arrive.
export async function POST() {
  await sendPushToAll({
    title: "❤️ Test",
    body: "Notificările merg! Aici vor apărea motivele noi.",
    url: "/gratitude",
    tag: "test",
  });
  return NextResponse.json({ ok: true });
}
