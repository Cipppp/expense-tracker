import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session.isAuthed) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const { id } = await ctx.params;
  await db.passkey.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
