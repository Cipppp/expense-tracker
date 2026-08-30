import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const Holding = z.object({
  kind: z.literal("holdings"),
  rows: z.array(
    z.object({
      id: z.string().optional(),
      symbol: z.string().trim().min(1).max(20),
      name: z.string().trim().max(80).optional().nullable(),
      quantity: z.coerce.number(),
      avgCost: z.coerce.number().nullable().optional(),
      currency: z.string().trim().length(3).default("USD"),
      source: z.string().trim().min(1).max(16).default("manual"),
    }),
  ),
});

const Savings = z.object({
  kind: z.literal("savings"),
  rows: z.array(
    z.object({
      id: z.string().optional(),
      label: z.string().trim().min(1).max(80),
      amount: z.coerce.number(),
      currency: z.string().trim().length(3).default("RON"),
    }),
  ),
});

const Body = z.discriminatedUnion("kind", [Holding, Savings]);

/**
 * Salvare completa a listei: randurile trimise sunt adevarul, restul se sterg.
 * Editorul din pagina lucreaza pe toata lista deodata, deci un diff partial
 * ar lasa in urma randuri sterse in interfata dar ramase in baza.
 */
export async function PUT(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const v = parsed.data;

  if (v.kind === "holdings") {
    const rows = v.rows.filter((r) => r.symbol.trim() && r.quantity);
    // Simbolul e normalizat: Yahoo cere majuscule, iar (symbol, source) e unic.
    const seen = new Set<string>();
    const clean = [];
    for (const r of rows) {
      const symbol = r.symbol.trim().toUpperCase();
      const key = `${symbol}|${r.source}`;
      if (seen.has(key)) continue;
      seen.add(key);
      clean.push({ ...r, symbol });
    }
    await db.$transaction([
      db.holding.deleteMany({}),
      db.holding.createMany({
        data: clean.map((r) => ({
          symbol: r.symbol,
          name: r.name?.trim() || null,
          quantity: r.quantity,
          avgCost: r.avgCost ?? null,
          currency: r.currency.toUpperCase(),
          source: r.source,
        })),
      }),
    ]);
    return NextResponse.json({ ok: true, count: clean.length });
  }

  const rows = v.rows.filter((r) => r.label.trim());
  await db.$transaction([
    db.savingsAccount.deleteMany({}),
    db.savingsAccount.createMany({
      data: rows.map((r, i) => ({
        label: r.label.trim(),
        amount: r.amount,
        amountRon: 0, // valoarea in RON se calculeaza la afisare, cu cursul zilei
        currency: r.currency.toUpperCase(),
        position: i,
      })),
    }),
  ]);
  return NextResponse.json({ ok: true, count: rows.length });
}
