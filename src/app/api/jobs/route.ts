import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const Create = z.object({
  name: z.string().min(1),
  rateUsd: z.coerce.number().nonnegative(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  defaultCurrency: z.enum(["USD", "EUR", "RON"]).optional(),
  companyName: z.string().optional().nullable(),
  companyCui: z.string().optional().nullable(),
  companyReg: z.string().optional().nullable(),
  companyAddress: z.string().optional().nullable(),
  companyCountry: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
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
  const v = parsed.data;
  const job = await db.job.create({
    data: {
      name: v.name,
      rateUsd: v.rateUsd,
      color: v.color ?? "#c65c2a",
      defaultCurrency: v.defaultCurrency ?? "USD",
      companyName: v.companyName ?? null,
      companyCui: v.companyCui ?? null,
      companyReg: v.companyReg ?? null,
      companyAddress: v.companyAddress ?? null,
      companyCountry: v.companyCountry ?? null,
      email: v.email || null,
    },
  });
  return NextResponse.json({ ok: true, job });
}
