import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session.isAuthed) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const passkeys = await db.passkey.findMany({
    select: {
      id: true,
      label: true,
      deviceType: true,
      backedUp: true,
      createdAt: true,
      lastUsedAt: true,
      transports: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ passkeys });
}
