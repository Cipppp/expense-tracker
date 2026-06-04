import "server-only";
import { db } from "@/lib/db";

/**
 * Compute the next invoice number for a series. Numbers are 4-digit
 * zero-padded (e.g. "0012"). Returns both the formatted `number` and the
 * underlying `seriesNumber` int.
 */
export async function getNextInvoiceNumber(series: string) {
  const [latest, settings] = await Promise.all([
    db.invoice.findFirst({
      where: { series },
      orderBy: { seriesNumber: "desc" },
      select: { seriesNumber: true },
    }),
    db.settings.findUnique({ where: { id: 1 }, select: { invoiceStartNumber: true } }),
  ]);
  // Continue from whichever is higher: the last number in the DB, or the
  // configured floor (so the series can pick up after an external tool).
  const floor = (settings?.invoiceStartNumber ?? 1) - 1;
  const seriesNumber = Math.max(latest?.seriesNumber ?? 0, floor) + 1;
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
