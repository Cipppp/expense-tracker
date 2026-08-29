import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { db } from "@/lib/db";
import { InvoicePdf } from "@/components/invoices/invoice-pdf";
import { pickIssuerIban } from "@/lib/invoice";
import { buildActivityReport, type ActivityEntry } from "@/lib/activity-report";

const fmtDate = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

type Rendered = { buffer: Buffer; filename: string };

/**
 * Render an invoice to a PDF buffer. Shared by the /pdf download route and the
 * email-send route so both produce identical files. Returns an error object
 * for the foreign-without-rate case rather than a misstated invoice.
 */
export async function renderInvoicePdf(
  invoiceId: string,
): Promise<Rendered | { error: string; status: number }> {
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: { lines: { orderBy: { position: "asc" } } },
  });
  if (!invoice) return { error: "Not found", status: 404 };

  if (
    invoice.invoiceCurrency !== invoice.legalCurrency &&
    !(invoice.bnrRate && invoice.bnrRate > 0)
  ) {
    return {
      error: `Invoice ${invoice.series} ${invoice.number} is in ${invoice.invoiceCurrency} but has no BNR rate. Set the BNR rate first.`,
      status: 422,
    };
  }

  const settings = await db.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  const buffer = await renderToBuffer(
    InvoicePdf({
      issuer: {
        name: settings.issuerName,
        cif: settings.issuerCif,
        vatIntra: settings.issuerVatIntra,
        reg: settings.issuerReg,
        address: settings.issuerAddress,
        iban: pickIssuerIban(settings, invoice.clientCountry, invoice.invoiceCurrency),
        swift: settings.issuerSwift,
        bank: settings.issuerBank,
        capital: settings.issuerCapital,
        signer: settings.issuerSigner,
      },
      invoice: {
        series: invoice.series,
        number: invoice.number,
        issuedAt: fmtDate(invoice.issuedAt),
        dueAt: invoice.dueAt ? fmtDate(invoice.dueAt) : null,
        clientName: invoice.clientName,
        clientCompany: invoice.clientCompany,
        clientCui: invoice.clientCui,
        clientReg: invoice.clientReg,
        clientAddress: invoice.clientAddress,
        clientCountry: invoice.clientCountry,
        invoiceCurrency: invoice.invoiceCurrency,
        legalCurrency: invoice.legalCurrency,
        bnrRate: invoice.bnrRate,
        vatRate: invoice.vatRate,
        footerNote: invoice.footerNote,
        lines: invoice.lines.map((l) => ({
          description: l.description,
          unit: l.unit,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          amount: l.amount,
        })),
      },
    }),
  );

  return {
    buffer: Buffer.from(buffer),
    filename: `${settings.issuerName.replace(/\s+/g, "-")}_${invoice.series}${invoice.number}.pdf`,
  };
}

/**
 * Render the Clockify-style activity-report .xlsx for an invoice. Entries come
 * from those linked to the invoice, falling back to the client's hours in the
 * issue month. Returns null only when the invoice doesn't exist.
 */
export async function renderActivityReport(
  invoiceId: string,
): Promise<Rendered | null> {
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: { lines: true, billedEntries: true, job: true },
  });
  if (!invoice) return null;

  const settings = await db.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  let rows = invoice.billedEntries.filter(
    (e) => e.startMinutes != null && e.endMinutes != null,
  );
  if (rows.length === 0 && invoice.jobId) {
    const y = invoice.issuedAt.getUTCFullYear();
    const m = invoice.issuedAt.getUTCMonth();
    const monthStart = new Date(Date.UTC(y, m, 1, 0, 0, 0));
    const monthEnd = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));
    rows = await db.income.findMany({
      where: {
        jobId: invoice.jobId,
        startMinutes: { not: null },
        endMinutes: { not: null },
        date: { gte: monthStart, lte: monthEnd },
      },
      orderBy: { date: "asc" },
    });
  }

  const entries: ActivityEntry[] = rows
    .slice()
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((e) => ({
      date: e.date,
      startMinutes: e.startMinutes,
      endMinutes: e.endMinutes,
      hours: e.hours ?? 0,
      description: e.description,
    }));

  let periodLabel: string;
  if (entries.length > 0) {
    const first = entries[0].date;
    const last = entries[entries.length - 1].date;
    const fmt = (d: Date) =>
      d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    periodLabel =
      first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear()
        ? first.toLocaleDateString("en-GB", { month: "long", year: "numeric" })
        : `${fmt(first)} – ${fmt(last)}`;
  } else {
    periodLabel = invoice.issuedAt.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  }

  const snapshotRate = rows.find((r) => r.hourlyRate != null)?.hourlyRate;
  const rate = snapshotRate ?? invoice.job?.rateUsd ?? 0;
  const currency = invoice.invoiceCurrency || invoice.job?.defaultCurrency || "USD";

  const buffer = await buildActivityReport({
    supplier: settings.issuerName,
    client: invoice.clientCompany,
    invoiceLabel: `${invoice.series} ${invoice.number}`,
    periodLabel,
    generatedAt: new Date(),
    currency,
    rate,
    entries,
  });

  return {
    buffer,
    filename: `Activity-report_${invoice.series}${invoice.number}_${invoice.clientCompany.replace(/[^A-Za-z0-9]+/g, "-")}.xlsx`,
  };
}
