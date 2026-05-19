import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Lightweight expense list for the Cmd+K palette — recent rows, minimal
 * payload, filtered to non-excluded.
 */
export async function GET() {
  const expenses = await db.expense.findMany({
    where: { excluded: false },
    orderBy: { date: "desc" },
    take: 30,
    select: {
      id: true,
      description: true,
      category: true,
      amountRon: true,
    },
  });
  return NextResponse.json({ expenses });
}
