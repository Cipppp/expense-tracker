import { requireUserId } from "@/lib/queries";
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
  companyCounty: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^RO-[A-Z]{1,2}$/, "County must be an ISO 3166-2:RO code like RO-B or RO-CJ")
    .optional()
    .nullable()
    .or(z.literal("")),
  email: z.string().email().optional().nullable().or(z.literal("")),
  invoiceDescription: z.string().optional().nullable(),
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
      userId: await requireUserId(),
      name: v.name,
      rateUsd: v.rateUsd,
      color: v.color ?? "#c65c2a",
      defaultCurrency: v.defaultCurrency ?? "USD",
      companyName: v.companyName ?? null,
      companyCui: v.companyCui ?? null,
      companyReg: v.companyReg ?? null,
      companyAddress: v.companyAddress ?? null,
      companyCountry: v.companyCountry ?? null,
      companyCounty: v.companyCounty || null,
      invoiceDescription: v.invoiceDescription ?? null,
      email: v.email || null,
    },
  });
  return NextResponse.json({ ok: true, job });
}
