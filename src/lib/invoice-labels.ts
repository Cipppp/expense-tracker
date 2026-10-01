import type { VatKind } from "@/lib/vat";

/*
 * Limba facturii si textele ei.
 *
 * Clientii romani primesc factura in romana; cei straini (BLNG, netop,
 * SPOTLITE, curiaself) in engleza, ca s-o poata citi cine o plateste. Legea
 * permite orice limba: ANAF poate cere doar o traducere, iar pentru el
 * conteaza oricum XML-ul din SPV, nu textul de pe PDF.
 *
 * Aceleasi texte ajung in PDF, in previzualizarea din pagina si, prin codul
 * de limba, in Oblio, ca cele trei exemplare ale facturii sa nu vorbeasca
 * limbi diferite. Mentiunea legala de TVA ramane in ambele limbi indiferent
 * de limba facturii (vezi lib/legal-mentions).
 */

export type InvoiceLang = "ro" | "en";

/**
 * Romana pentru Romania si pentru o tara necompletata: un client romanesc
 * caruia i-a scapat tara nu trebuie sa primeasca dintr-odata factura in
 * engleza.
 */
export function invoiceLanguage(country: string | null | undefined): InvoiceLang {
  const c = (country ?? "").trim().toUpperCase();
  return c === "" || c === "RO" ? "ro" : "en";
}

/** Codul de limba pe care il asteapta API-ul Oblio (`language`). */
export function oblioLanguage(lang: InvoiceLang): "RO" | "EN" {
  return lang === "ro" ? "RO" : "EN";
}

type Labels = {
  locale: string;
  invoice: string;
  supplier: string;
  client: string;
  regCom: string;
  taxId: string;
  euVatId: string;
  address: string;
  iban: string;
  swift: string;
  bank: string;
  capital: string;
  seriesNo: (series: string, number: string) => string;
  dateLong: string;
  date: string;
  vatRate: string;
  vatKind: Record<VatKind, string>;
  county: string;
  country: string;
  colNr: string;
  colDesc: string;
  colDescShort: string;
  colUnit: string;
  colQty: string;
  colUnitPrice: string;
  colUnitPriceShort: string;
  colAmount: string;
  colVat: string;
  total: string;
  totalDue: string;
  dueDate: string;
  preparedBy: string;
  ronLabel: string;
  ronEquivalent: string;
  equivalent: (amount: string, currency: string, date: string, foreign: string, rate: string) => string;
  validWithoutSignature: string;
  countryNames: Record<string, string>;
};

export const INVOICE_LABELS: Record<InvoiceLang, Labels> = {
  ro: {
    locale: "ro-RO",
    invoice: "FACTURA",
    supplier: "Furnizor",
    client: "Client",
    regCom: "Reg. com.",
    taxId: "CIF",
    euVatId: "Cod TVA intracomunitar",
    address: "Adresa",
    iban: "IBAN",
    swift: "SWIFT/BIC",
    bank: "Banca",
    capital: "Capital social",
    seriesNo: (s, n) => `Seria ${s} nr. ${n}`,
    dateLong: "Data (zi/luna/an)",
    date: "Data",
    vatRate: "Cota TVA",
    vatKind: {
      eu_reverse: "taxare inversa",
      export: "neimpozabil",
      exempt_310: "scutit art. 310",
      domestic: "",
      none: "",
    },
    county: "Judet",
    country: "Tara",
    colNr: "Nr. crt",
    colDesc: "Denumirea produselor sau a serviciilor",
    colDescShort: "Denumirea serviciilor",
    colUnit: "U.M.",
    colQty: "Cant.",
    colUnitPrice: "Pret unitar\n(fara TVA)",
    colUnitPriceShort: "Pret unitar",
    colAmount: "Valoarea",
    colVat: "Valoarea TVA",
    total: "Total",
    totalDue: "Total plata",
    dueDate: "Termen plata",
    preparedBy: "Intocmit de",
    ronLabel: "Lei",
    ronEquivalent: "Echivalent RON",
    equivalent: (a, cur, d, f, r) =>
      `Echivalent ${a} ${cur} la cursul BNR din ${d}, 1 ${f} = ${r} RON.`,
    validWithoutSignature:
      "Factura este valabila fara semnatura si stampila, conform art. 319 alin. 29 din legea 227/2015.",
    countryNames: {
      RO: "Romania",
      DK: "Danemarca",
      PT: "Portugalia",
      US: "Statele Unite",
      GB: "Marea Britanie",
      DE: "Germania",
      ES: "Spania",
      FR: "Franta",
      NL: "Olanda",
      CH: "Elvetia",
    },
  },
  en: {
    locale: "en-US",
    invoice: "INVOICE",
    supplier: "Supplier",
    client: "Bill to",
    regCom: "Trade register no.",
    taxId: "Tax ID",
    euVatId: "EU VAT ID",
    address: "Address",
    iban: "IBAN",
    swift: "SWIFT/BIC",
    bank: "Bank",
    capital: "Share capital",
    seriesNo: (s, n) => `Invoice no. ${s} ${n}`,
    dateLong: "Date (dd/mm/yyyy)",
    date: "Date",
    vatRate: "VAT",
    vatKind: {
      eu_reverse: "reverse charge",
      export: "not subject to Romanian VAT",
      exempt_310: "exempt (art. 310)",
      domestic: "",
      none: "",
    },
    county: "County",
    country: "Country",
    colNr: "No.",
    colDesc: "Description of services",
    colDescShort: "Description",
    colUnit: "Unit",
    colQty: "Qty",
    colUnitPrice: "Unit price\n(excl. VAT)",
    colUnitPriceShort: "Unit price",
    colAmount: "Amount",
    colVat: "VAT amount",
    total: "Total",
    totalDue: "Total due",
    dueDate: "Due date",
    preparedBy: "Issued by",
    ronLabel: "RON",
    ronEquivalent: "RON equivalent",
    equivalent: (a, cur, d, f, r) =>
      `Equivalent to ${a} ${cur} at the National Bank of Romania rate of ${d}, 1 ${f} = ${r} RON.`,
    validWithoutSignature:
      "This invoice is valid without signature or stamp, under art. 319(29) of Romanian Law 227/2015.",
    countryNames: {
      RO: "Romania",
      DK: "Denmark",
      PT: "Portugal",
      US: "United States",
      GB: "United Kingdom",
      DE: "Germany",
      ES: "Spain",
      FR: "France",
      NL: "Netherlands",
      CH: "Switzerland",
    },
  },
};

export function invoiceLabels(country: string | null | undefined): Labels {
  return INVOICE_LABELS[invoiceLanguage(country)];
}
