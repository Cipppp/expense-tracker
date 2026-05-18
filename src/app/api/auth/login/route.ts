import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { password?: string };
  const expected = process.env.ACCESS_PASSWORD;
  if (!expected) {
    return NextResponse.json({ error: "Auth misconfigured" }, { status: 500 });
  }
  if (body.password !== expected) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }
  const session = await getSession();
  session.isAuthed = true;
  session.loginAt = Date.now();
  await session.save();
  return NextResponse.json({ ok: true });
}
