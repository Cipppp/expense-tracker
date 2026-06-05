import "server-only";
import { vatKindForInvoice } from "@/lib/vat";

/**
 * Romanian e-Factura (CIUS_RO 1.0.1, UBL 2.1 Invoice) generator.
 *
 * Produces the XML you upload to ANAF SPV → e-Factura (or send via the ANAF
 * API). This is the file SmartBill builds behind the scenes. It is NOT a PDF.
 *
 * IMPORTANT — validate before relying on it. Romanian e-Factura is strict and
 * this generator works from the data the app has. Run the first file through
 * ANAF's free validator ("Validare fișier XML" on anaf.ro, or the DUK
 * Integrator) and fill any gaps it flags — most commonly POSTAL CODES, which
 * the app doesn't store yet (emitted empty here). Cross-border (EU/non-EU)
 * invoices generally don't need SPV at all; this matters mainly for RO clients.
 */

type EfacturaInput = {
  issuer: {
    name: string;
    cif: string; // RO51711091
    reg: string; // J2025030670009
    address: string;
    iban: string;
    swift?: string; // BIC — emitted as FinancialInstitutionBranch (BT-86)
    postalZone?: string;
  };
  invoice: {
    series: string;
    number: string;
    issuedAtISO: string; // yyyy-mm-dd
    dueAtISO?: string | null;
    clientCompany: string;
    clientCui?: string | null; // VAT/CIF
    clientReg?: string | null;
    clientAddress?: string | null;
    clientCountry?: string | null; // ISO2
    clientPostalZone?: string;
    invoiceCurrency: string;
    bnrRate?: number | null;
    vatRate: number;
    lines: Array<{
      description: string;
      unit: string; // "buc" | "h"
      quantity: number;
      unitPrice: number; // invoiceCurrency
      amount: number; // invoiceCurrency
    }>;
  };
};

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const money = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
const qty = (n: number) => (Math.round(n * 100) / 100).toString();

// Bucharest addresses use CityName "SECTORn" + CountrySubentity "RO-B".
function roLocality(address: string): { city: string; subentity: string } {
  const m = address.match(/sector\s*(\d)/i);
  if (m) return { city: `SECTOR${m[1]}`, subentity: "RO-B" };
  return { city: "BUCURESTI", subentity: "RO-B" };
}

// UN/ECE unit code: hours → HUR, otherwise "piece" → C62.
function unitCode(unit: string): string {
  return unit.trim().toLowerCase() === "h" ? "HUR" : "C62";
}

function partyXml(
  tag: "AccountingSupplierParty" | "AccountingCustomerParty",
  p: {
    name: string;
    address: string;
    country: string; // ISO2
    postalZone?: string;
    vatId?: string | null; // with country prefix for the VAT scheme
    legalName: string;
    legalId?: string | null; // trade-register number
  },
): string {
  const isRo = p.country === "RO";
  const loc = isRo ? roLocality(p.address) : { city: cityFromAddress(p.address), subentity: "" };
  // The VAT scheme CompanyID needs a country-prefixed VAT id (RO…, PT…). The
  // address line is used verbatim as the street.
  const vat = (p.vatId ?? "").trim();
  return `  <cac:${tag}>
    <cac:Party>
      <cac:PostalAddress>
        <cbc:StreetName>${esc(p.address)}</cbc:StreetName>
        <cbc:CityName>${esc(loc.city)}</cbc:CityName>
        <cbc:PostalZone>${esc(p.postalZone ?? "")}</cbc:PostalZone>${
          isRo ? `\n        <cbc:CountrySubentity>${loc.subentity}</cbc:CountrySubentity>` : ""
        }
        <cac:Country>
          <cbc:IdentificationCode>${esc(p.country)}</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>${
        vat
          ? `\n      <cac:PartyTaxScheme>
        <cbc:CompanyID>${esc(vat)}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>`
          : ""
      }
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(p.legalName)}</cbc:RegistrationName>${
          p.legalId ? `\n        <cbc:CompanyID>${esc(p.legalId)}</cbc:CompanyID>` : ""
        }
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:${tag}>`;
}

function cityFromAddress(address: string): string {
  // Best effort for non-RO: take the token before the country, else the whole.
  const parts = address.split(",").map((s) => s.trim()).filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 2] : address;
}

export function buildEfacturaXml(input: EfacturaInput): string {
  const { issuer, invoice: inv } = input;
  const rate = inv.bnrRate ?? 1;
  const kind = vatKindForInvoice(inv.clientCountry, inv.vatRate);

  // Presentation/document currency mirrors the PDF: RON for RO clients, the
  // contract currency otherwise.
  const docCur = inv.clientCountry === "RO" ? "RON" : inv.invoiceCurrency;
  const factor = docCur === inv.invoiceCurrency ? 1 : rate;
  const foreign = docCur !== "RON";

  const lines = inv.lines.map((l) => {
    const net = Math.round(l.amount * factor * 100) / 100;
    return {
      ...l,
      docUnitPrice: Math.round(l.unitPrice * factor * 100) / 100,
      docNet: net,
    };
  });
  const net = Math.round(lines.reduce((a, l) => a + l.docNet, 0) * 100) / 100;
  const vat = Math.round(net * inv.vatRate * 100) / 100;
  const gross = Math.round((net + vat) * 100) / 100;
  const ronVat = foreign ? Math.round(vat * rate * 100) / 100 : vat;

  // Tax category per treatment.
  const cat =
    kind === "domestic"
      ? { id: "S", percent: inv.vatRate * 100 as number | null, reasonCode: "", reason: "" }
      : kind === "eu_reverse"
        ? { id: "AE", percent: 0 as number | null, reasonCode: "VATEX-EU-AE", reason: "Reverse charge" }
        // Category O ("Not subject to VAT", services outside the EU): the VAT
        // rate is PROHIBITED by EN16931 BR-O-05 — emit no cbc:Percent.
        : { id: "O", percent: null as number | null, reasonCode: "VATEX-EU-O", reason: "Not subject to VAT - services supplied outside the EU" };

  const percentLine = (indent: string) =>
    cat.percent != null ? `\n${indent}<cbc:Percent>${cat.percent.toFixed(2)}</cbc:Percent>` : "";

  const taxCategoryXml = (indent: string) =>
    `${indent}<cac:TaxCategory>
${indent}  <cbc:ID>${cat.id}</cbc:ID>${percentLine(`${indent}  `)}${
      cat.reasonCode
        ? `\n${indent}  <cbc:TaxExemptionReasonCode>${cat.reasonCode}</cbc:TaxExemptionReasonCode>\n${indent}  <cbc:TaxExemptionReason>${esc(cat.reason)}</cbc:TaxExemptionReason>`
        : ""
    }
${indent}  <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
${indent}</cac:TaxCategory>`;

  // TaxTotal in the document currency (with subtotal). When the document
  // currency isn't RON, a second TaxTotal carries the VAT in RON only.
  const taxTotalDoc = `  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${docCur}">${money(vat)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${docCur}">${money(net)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${docCur}">${money(vat)}</cbc:TaxAmount>
${taxCategoryXml("      ")}
    </cac:TaxSubtotal>
  </cac:TaxTotal>`;
  const taxTotalRon = foreign
    ? `\n  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="RON">${money(ronVat)}</cbc:TaxAmount>
  </cac:TaxTotal>`
    : "";

  const linesXml = lines
    .map(
      (l, i) => `  <cac:InvoiceLine>
    <cbc:ID>${i + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="${unitCode(l.unit)}">${qty(l.quantity)}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${docCur}">${money(l.docNet)}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>${esc(l.description.slice(0, 200))}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>${cat.id}</cbc:ID>${cat.percent != null ? `\n        <cbc:Percent>${cat.percent.toFixed(2)}</cbc:Percent>` : ""}
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="${docCur}">${money(l.docUnitPrice)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`,
    )
    .join("\n");

  const supplier = partyXml("AccountingSupplierParty", {
    name: issuer.name,
    address: issuer.address,
    country: "RO",
    postalZone: issuer.postalZone,
    vatId: issuer.cif, // already RO-prefixed
    legalName: issuer.name,
    legalId: issuer.reg,
  });
  const customer = partyXml("AccountingCustomerParty", {
    name: inv.clientCompany,
    address: inv.clientAddress ?? "",
    country: inv.clientCountry ?? "RO",
    postalZone: inv.clientPostalZone,
    vatId: inv.clientCui ?? null,
    legalName: inv.clientCompany,
    legalId: inv.clientReg ?? null,
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:efactura.mfinante.ro:CIUS-RO:1.0.1</cbc:CustomizationID>
  <cbc:ID>${esc(inv.series + inv.number)}</cbc:ID>
  <cbc:IssueDate>${inv.issuedAtISO}</cbc:IssueDate>${
    inv.dueAtISO ? `\n  <cbc:DueDate>${inv.dueAtISO}</cbc:DueDate>` : ""
  }
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${docCur}</cbc:DocumentCurrencyCode>${
    foreign ? `\n  <cbc:TaxCurrencyCode>RON</cbc:TaxCurrencyCode>` : ""
  }
${supplier}
${customer}
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>42</cbc:PaymentMeansCode>
    <cac:PayeeFinancialAccount>
      <cbc:ID>${esc(issuer.iban)}</cbc:ID>${
        issuer.swift?.trim()
          ? `\n      <cac:FinancialInstitutionBranch>
        <cbc:ID>${esc(issuer.swift.trim())}</cbc:ID>
      </cac:FinancialInstitutionBranch>`
          : ""
      }
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>
${taxTotalDoc}${taxTotalRon}
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${docCur}">${money(net)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${docCur}">${money(net)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${docCur}">${money(gross)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${docCur}">${money(gross)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${linesXml}
</Invoice>
`;
}
