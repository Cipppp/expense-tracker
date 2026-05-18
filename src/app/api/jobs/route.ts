import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const Create = z.object({
  name: z.string().min(1),
  rateUsd: z.coerce.number().nonnegative(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export async function GET() {
  const jobs = await db.job.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ jobs });
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Create.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const job = await db.job.create({
    data: { ...parsed.data, color: parsed.data.color ?? "#c65c2a" },
  });
  return NextResponse.json({ ok: true, job });
}
