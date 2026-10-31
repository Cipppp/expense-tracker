import type { InvoicePdfProps } from "@/components/invoices/invoice-pdf";

/*
 * Sumele de pe factura, pentru template-urile noi. Aceeasi regula ca in
 * invoice-pdf.tsx (copiata, nu mutata, ca facturile vechi sa se randeze cu
 * codul lor neatins): clientii romani vad lei, ceilalti moneda contractului,
 * cu echivalentul in cealalta moneda la cursul BNR. Fiecare linie se
 * rotunjeste la doua zecimale si totalul aduna liniile rotunjite, ca TVA-ul
 * sa se potriveasca mereu cu totalul.
 */
export function invoiceAmounts(invoice: InvoicePdfProps["invoice"]) {
  const rate = invoice.bnrRate ?? 1;
  const present = invoice.clientCountry === "RO" ? "RON" : invoice.invoiceCurrency;
  const factor = present === invoice.invoiceCurrency ? 1 : rate;
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const lines = invoice.lines.map((l) => {
    const net = round2(l.amount * factor);
    return { ...l, unitPrice: round2(l.unitPrice * factor), net, vat: round2(net * invoice.vatRate) };
  });
  const totalNet = round2(lines.reduce((a, l) => a + l.net, 0));
  const totalVat = round2(lines.reduce((a, l) => a + l.vat, 0));
  const totalGross = round2(totalNet + totalVat);
  const showEquivalent = !(present === "RON" && invoice.invoiceCurrency === "RON");
  const foreignCur = present === "RON" ? invoice.invoiceCurrency : present;
  return {
    rate,
    present,
    lines,
    totalNet,
    totalVat,
    totalGross,
    showEquivalent,
    foreignCur,
    /** Totalul in cealalta moneda: lei pentru o factura in valuta, si invers. */
    equivAmount: present === "RON" ? totalGross / (rate || 1) : totalGross * rate,
    equivCur: present === "RON" ? foreignCur : "RON",
  };
}

export function fmtQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
