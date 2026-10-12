import { describe, expect, it } from "vitest";
import { INVOICE_LABELS, invoiceLabels, invoiceLanguage, oblioLanguage } from "@/lib/invoice-labels";

/*
 * Limba gresita pe o factura nu crapa nimic: o factura in engleza ajunge la
 * un client roman, sau Oblio emite in romana ce PDF-ul arata in engleza, si
 * nimeni nu observa pana nu intreaba clientul.
 */

describe("invoiceLanguage", () => {
  it("clientii romani primesc romana", () => {
    expect(invoiceLanguage("RO")).toBe("ro");
    expect(invoiceLanguage(" ro ")).toBe("ro");
  });

  it("clientii straini primesc engleza", () => {
    for (const c of ["US", "PT", "DK", "CH", "de"]) expect(invoiceLanguage(c)).toBe("en");
  });

  /*
   * Un client romanesc caruia i-a scapat tara nu trebuie sa primeasca
   * dintr-odata factura in engleza.
   */
  it("fara tara ramane romana", () => {
    expect(invoiceLanguage("")).toBe("ro");
    expect(invoiceLanguage(null)).toBe("ro");
    expect(invoiceLanguage(undefined)).toBe("ro");
  });
});

describe("oblioLanguage", () => {
  it("trimite la Oblio aceeasi limba ca PDF-ul", () => {
    expect(oblioLanguage(invoiceLanguage("US"))).toBe("EN");
    expect(oblioLanguage(invoiceLanguage("RO"))).toBe("RO");
  });
});

describe("textele", () => {
  it("BLNG primeste factura in engleza", () => {
    const L = invoiceLabels("US");
    expect(L.invoice).toBe("INVOICE");
    expect(L.vatKind.export).toBe("not subject to Romanian VAT");
    expect(L.countryNames.US).toBe("United States");
  });

  it("un client roman primeste factura de pana acum", () => {
    const L = invoiceLabels("RO");
    expect(L.invoice).toBe("FACTURA");
    expect(L.seriesNo("CP", "0033")).toBe("Seria CP nr. 0033");
    expect(L.ronLabel).toBe("Lei");
  });

  it("formatul sumelor urmeaza limba", () => {
    const fmt = (lang: "ro" | "en") =>
      (5280).toLocaleString(INVOICE_LABELS[lang].locale, { minimumFractionDigits: 2 });
    expect(fmt("ro")).toBe("5.280,00");
    expect(fmt("en")).toBe("5,280.00");
  });

  it("nicio eticheta nu ramane goala in vreo limba", () => {
    for (const L of Object.values(INVOICE_LABELS)) {
      for (const [k, v] of Object.entries(L)) {
        if (typeof v === "string") expect(v, k).not.toBe("");
      }
    }
  });

  it("aceleasi tari au nume in ambele limbi", () => {
    expect(Object.keys(INVOICE_LABELS.en.countryNames).sort()).toEqual(
      Object.keys(INVOICE_LABELS.ro.countryNames).sort(),
    );
  });
});
