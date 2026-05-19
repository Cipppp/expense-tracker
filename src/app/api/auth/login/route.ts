import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, getSessionRemember } from "@/lib/session";

const Body = z.object({
  password: z.string(),
  remember: z.boolean().optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const expected = process.env.ACCESS_PASSWORD;
  if (!expected) {
    return NextResponse.json({ error: "Auth misconfigured" }, { status: 500 });
  }
  if (parsed.data.password !== expected) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }
  const session = parsed.data.remember
    ? await getSessionRemember()
    : await getSession();
  session.isAuthed = true;
  session.loginAt = Date.now();
  await session.save();
  return NextResponse.json({ ok: true });
}
