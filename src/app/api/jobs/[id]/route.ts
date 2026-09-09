import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const Update = z.object({
  name: z.string().min(1).optional(),
  rateUsd: z.coerce.number().nonnegative().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  active: z.boolean().optional(),
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

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = Update.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = { ...parsed.data };
  if (data.email === "") data.email = null; // normalize blank → cleared
  if (data.companyCounty === "") data.companyCounty = null;
  const job = await db.job.update({ where: { id }, data });
  return NextResponse.json({ ok: true, job });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await db.job.update({ where: { id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
