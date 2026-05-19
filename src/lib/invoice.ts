import "server-only";
import { db } from "@/lib/db";

/**
 * Compute the next invoice number for a series. Numbers are 4-digit
 * zero-padded (e.g. "0012"). Returns both the formatted `number` and the
 * underlying `seriesNumber` int.
 */
export async function getNextInvoiceNumber(series: string) {
  const latest = await db.invoice.findFirst({
    where: { series },
    orderBy: { seriesNumber: "desc" },
    select: { seriesNumber: true },
  });
  const seriesNumber = (latest?.seriesNumber ?? 0) + 1;
  return {
    seriesNumber,
    number: String(seriesNumber).padStart(4, "0"),
  };
}

/**
 * Sum invoice line amounts. Always returns the total in `invoiceCurrency`.
 */
export function sumLines(lines: Array<{ amount: number }>): number {
  return lines.reduce((a, b) => a + b.amount, 0);
}
