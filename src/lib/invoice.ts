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

/**
 * Currency the client actually pays in: Romanian clients are always billed in
 * RON (legal requirement); everyone else in the contract currency. Mirrors the
 * `present`/`docCur` logic in the PDF and e-Factura builders.
 */
export function presentationCurrency(
  clientCountry: string | null | undefined,
  invoiceCurrency: string,
): string {
  return clientCountry === "RO" ? "RON" : invoiceCurrency;
}

/**
 * Pick the issuer IBAN that matches the currency the client pays in: the EUR
 * account for EUR invoices (when one is configured), otherwise the default RON
 * account. Keeps a netop EUR invoice from quoting the RON IBAN (which would
 * force an FX conversion on arrival).
 */
export function pickIssuerIban(
  settings: { issuerIban: string; issuerIbanEur: string },
  clientCountry: string | null | undefined,
  invoiceCurrency: string,
): string {
  const present = presentationCurrency(clientCountry, invoiceCurrency);
  if (present === "EUR" && settings.issuerIbanEur.trim()) {
    return settings.issuerIbanEur.trim();
  }
  return settings.issuerIban;
}
