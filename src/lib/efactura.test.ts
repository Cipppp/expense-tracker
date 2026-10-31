import { describe, expect, it } from "vitest";
import { buildEfacturaDocument, type EfacturaInput } from "@/lib/efactura";

const issuer: EfacturaInput["issuer"] = {
  name: "PROJECT CIP S.R.L.",
  cif: "51711091",
  vatId: "RO55415170",
  vatRegistered: false,
  reg: "J2025030670009",
  address: "Bld Dacia, Nr.133, Et.d, Sector 2, Jud. Bucuresti",
  county: "RO-B",
  iban: "RO53INGB0000999919822780",
  swift: "INGBROBU",
};

const invoice = (over: Partial<EfacturaInput["invoice"]> = {}): EfacturaInput["invoice"] => ({
  series: "CP",
  number: "0037",
  issuedAtISO: "2026-11-02",
  dueAtISO: "2026-11-07",
  clientCompany: "Aethra, S.A.",
  clientCui: "PT514422793",
  clientAddress: "Rua Pedro Nunes, Bloco C, 3030-199 Coimbra, Portugal",
  clientCountry: "PT",
  invoiceCurrency: "EUR",
  bnrRate: 5.3426,
  vatRate: 0,
  lines: [{ description: "IT consulting services", unit: "h", quantity: 49, unitPrice: 33, amount: 1617 }],
  ...over,
});

const supplierOf = (xml: string) => xml.match(/<cac:AccountingSupplierParty>[\s\S]*?<\/cac:AccountingSupplierParty>/)![0];

describe("buildEfacturaDocument, EU reverse charge", () => {
  /*
   * ANAF reads the issuer from BT-31 when it is there. With the art. 317 code
   * in BT-31 the upload under CUI 51711091 was rejected on TEST (31.10.2026).
   */
  it("identifies the seller by CUI, not by the art. 317 code", () => {
    const doc = buildEfacturaDocument({ issuer, invoice: invoice() });
    const supplier = supplierOf(doc.xml);

    expect(doc.category).toBe("AE");
    expect(doc.blockers).toEqual([]);
    expect(supplier).not.toContain("RO55415170");
    expect(supplier).not.toMatch(/<cbc:ID>VAT<\/cbc:ID>/);
    expect(supplier).toMatch(/<cac:PartyTaxScheme>\s*<cbc:CompanyID>51711091<\/cbc:CompanyID>\s*<cac:TaxScheme\/>/);
  });

  it("keeps the art. 317 code and the reverse-charge mention in the note", () => {
    const { xml } = buildEfacturaDocument({ issuer, invoice: invoice() });
    const note = xml.match(/<cbc:Note>([^<]*)<\/cbc:Note>/)?.[1] ?? "";

    expect(note).toContain("RO55415170");
    expect(note).toContain("art. 196");
  });

  it("keeps the buyer's VAT number under the VAT scheme", () => {
    const { xml } = buildEfacturaDocument({ issuer, invoice: invoice() });
    expect(xml).toMatch(/<cbc:CompanyID>PT514422793<\/cbc:CompanyID>\s*<cac:TaxScheme><cbc:ID>VAT<\/cbc:ID>/);
  });

  it("blocks the invoice when the art. 317 code is missing", () => {
    const doc = buildEfacturaDocument({ issuer: { ...issuer, vatId: null }, invoice: invoice() });
    expect(doc.blockers.join(" ")).toMatch(/art\. 317/);
  });
});

describe("buildEfacturaDocument, outside the EU", () => {
  it("has no tax scheme on either party", () => {
    const doc = buildEfacturaDocument({
      issuer,
      invoice: invoice({ clientCompany: "strat.excellence AG", clientCui: "CHE-366.375.107", clientCountry: "CH" }),
    });
    expect(doc.category).toBe("O");
    expect(doc.xml).not.toContain("<cac:PartyTaxScheme>");
    expect(doc.xml).not.toContain("<cbc:Note>");
  });
});

describe("buildEfacturaDocument, item name", () => {
  it("cuts a long name at a word and keeps the full text in the description", () => {
    const description =
      "IT consulting services - curiaself.ch platform - 10 August to 31 October 2026, as per Services Agreement v2.1";
    const { xml } = buildEfacturaDocument({
      issuer,
      invoice: invoice({ lines: [{ description, unit: "h", quantity: 1, unitPrice: 25, amount: 25 }] }),
    });
    const name = xml.match(/<cbc:Name>([^<]*)<\/cbc:Name>/)![1];

    expect(name.length).toBeLessThanOrEqual(100);
    expect(name.endsWith("as per Services")).toBe(true);
    expect(xml).toContain(`<cbc:Description>${description}</cbc:Description>`);
  });
});
