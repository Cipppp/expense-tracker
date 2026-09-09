import "server-only";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/queries";
import { pickIssuerIban } from "@/lib/invoice";
import { EU_MEMBER_STATES } from "@/lib/vat";
import { buildEfacturaDocument, type EfacturaDocument } from "@/lib/efactura";

/*
 * Un singur loc care stie sa transforme o factura din baza in XML e-Factura,
 * folosit si de descarcarea XML-ului, si de transmiterea la ANAF — ca ce vezi
 * sa fie ce se trimite.
 */

const iso = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

export type InvoiceForXml = NonNullable<Awaited<ReturnType<typeof loadInvoice>>>;

function loadInvoice(id: string) {
  return db.invoice.findUnique({
    where: { id },
    include: {
      lines: { orderBy: { position: "asc" } },
      job: true,
      efacturaCurrent: true,
    },
  });
}

export async function buildForInvoice(invoiceId: string): Promise<{
  invoice: InvoiceForXml;
  settings: Awaited<ReturnType<typeof getSettings>>;
  doc: EfacturaDocument;
} | null> {
  const [invoice, settings] = await Promise.all([loadInvoice(invoiceId), getSettings()]);
  if (!invoice) return null;

  const country = (invoice.clientCountry ?? "RO").toUpperCase();
  const isEu = country !== "RO" && EU_MEMBER_STATES.has(country);

  const doc = buildEfacturaDocument({
    issuer: {
      name: settings.issuerName,
      cif: settings.issuerCif,
      /*
       * BT-31. Pe facturile intracomunitare merge codul special art. 317
       * (RO55415170) — el e cel din VIES pe care se sprijina taxarea inversa.
       * Pe cele interne cu TVA (istorice) merge CIF-ul cu prefix RO. Sub
       * categoria O generatorul nu-l foloseste deloc.
       */
      vatId: isEu ? settings.issuerVatIntra || null : `RO${settings.issuerCif.replace(/^RO/i, "")}`,
      vatRegistered: settings.vatRegistered,
      reg: settings.issuerReg,
      address: settings.issuerAddress,
      county: "RO-B",
      iban: pickIssuerIban(settings, invoice.clientCountry, invoice.invoiceCurrency),
      swift: settings.issuerSwift,
    },
    invoice: {
      series: invoice.series,
      number: invoice.number,
      issuedAtISO: iso(invoice.issuedAt),
      dueAtISO: invoice.dueAt ? iso(invoice.dueAt) : null,
      clientCompany: invoice.clientCompany,
      clientCui: invoice.clientCui,
      clientReg: invoice.clientReg,
      clientAddress: invoice.clientAddress,
      clientCountry: invoice.clientCountry,
      clientCounty: invoice.clientCounty ?? invoice.job?.companyCounty ?? null,
      invoiceCurrency: invoice.invoiceCurrency,
      bnrRate: invoice.bnrRate,
      vatRate: invoice.vatRate,
      lines: invoice.lines.map((l) => ({
        description: l.description,
        unit: l.unit,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        amount: l.amount,
      })),
    },
  });

  return { invoice, settings, doc };
}
