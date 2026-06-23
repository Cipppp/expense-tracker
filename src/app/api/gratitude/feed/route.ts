import { NextResponse } from "next/server";
import { buildGratitudeFeed } from "@/lib/gratitude";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Polled by the gratitude page for near-real-time updates (new entries, photos,
// reactions, pins) without a full page refresh.
export async function GET() {
  const feed = await buildGratitudeFeed();
  return NextResponse.json(feed, {
    headers: { "Cache-Control": "no-store" },
  });
}
