import { describe, expect, it } from "vitest";
import { isIngCsv, parseIngCsv } from "@/lib/ing-csv";

/*
 * Extrasul ING e singura sursă de adevăr pentru ce s-a plătit efectiv. Dacă
 * parserul ratează un rând sau citește greșit o sumă, nimic nu crapă — doar
 * estimarea de taxe iese mai mică, și n-ai de unde să știi.
 *
 * Rândurile de mai jos au forma exactă din export, cu tot cu coloanele goale.
 */

const HEADER =
  "Sold initial;Sold final;Numar cont;Data procesarii;Suma;Valuta;Tip tranzactie;" +
  "Nume beneficiar/ordonator;Cont beneficiar/ordonator;Banca beneficiar/ordonator;" +
  "Detaliile tranzactiei;Sold intermediar";

/** Un rând de extras, cu valorile pe pozițiile pe care le are ING. */
function row(o: {
  date?: string;
  amount?: string;
  currency?: string;
  type?: string;
  counterparty?: string;
  iban?: string;
  bank?: string;
  details?: string;
}) {
  return [
    "", // Sold initial
    "", // Sold final
    "RO39INGB0000999900000001",
    o.date ?? "06-08-26",
    o.amount ?? "-100,00",
    o.currency ?? "RON",
    o.type ?? "Transfer ING Business",
    o.counterparty ?? "Cineva SRL",
    o.iban ?? "",
    o.bank ?? "",
    o.details ?? "No details",
    "", // Sold intermediar
  ].join(";");
}

const csv = (...lines: string[]) => [HEADER, ...lines].join("\n");

describe("isIngCsv", () => {
  it("recunoaște extrasul ING după header", () => {
    expect(isIngCsv(csv())).toBe(true);
  });

  it("nu confundă un export Revolut cu unul ING", () => {
    const revolut =
      "Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance";
    expect(isIngCsv(revolut)).toBe(false);
  });

  it("cere toți markerii, nu doar unul", () => {
    expect(isIngCsv("Sold initial;altceva;si altceva")).toBe(false);
  });
});

describe("parseIngCsv — sume", () => {
  it("citește formatul cu punct pentru mii și virgulă zecimală", () => {
    const [r] = parseIngCsv(csv(row({ amount: "-1.400,00" })));
    expect(r.amount).toBe(-1400);
  });

  it("citește și formatul cu punct zecimal", () => {
    const [r] = parseIngCsv(csv(row({ amount: "-1400.00" })));
    expect(r.amount).toBe(-1400);
  });

  it("nu confundă separatorul de mii cu cel zecimal", () => {
    // "1.400" fără zecimale e o mie patru sute, nu 1,4.
    const [r] = parseIngCsv(csv(row({ amount: "-1,400" })));
    expect(r.amount).toBe(-1400);
  });

  it("păstrează bănuții", () => {
    const [r] = parseIngCsv(csv(row({ amount: "-1.234,56" })));
    expect(r.amount).toBeCloseTo(-1234.56, 2);
  });

  it("păstrează semnul: încasările sunt pozitive", () => {
    const [r] = parseIngCsv(csv(row({ amount: "2.500,00" })));
    expect(r.amount).toBe(2500);
  });

  it("sare peste rândurile de sold, care n-au sumă", () => {
    expect(parseIngCsv(csv(row({ amount: "" })))).toHaveLength(0);
  });

  it("sare peste sumele zero", () => {
    expect(parseIngCsv(csv(row({ amount: "0,00" })))).toHaveLength(0);
  });
});

describe("parseIngCsv — date", () => {
  it("citește dd-mm-yy și fixează ora la prânz UTC", () => {
    const [r] = parseIngCsv(csv(row({ date: "06-08-26" })));
    expect(r.date.toISOString()).toBe("2026-08-06T12:00:00.000Z");
  });

  it("acceptă și anul pe patru cifre", () => {
    const [r] = parseIngCsv(csv(row({ date: "06-08-2026" })));
    expect(r.date.getUTCFullYear()).toBe(2026);
  });

  it("prânzul ține data pe loc indiferent de fus", () => {
    // La miezul nopții UTC, o zonă cu -3 ar citi ziua dinainte.
    const [r] = parseIngCsv(csv(row({ date: "01-09-26" })));
    expect(r.date.getUTCDate()).toBe(1);
    expect(r.date.getUTCHours()).toBe(12);
  });

  it("respinge luni imposibile", () => {
    expect(parseIngCsv(csv(row({ date: "06-13-26" })))).toHaveLength(0);
  });

  it("respinge datele care nu au forma așteptată", () => {
    expect(parseIngCsv(csv(row({ date: "2026-08-06" })))).toHaveLength(0);
  });
});

describe("parseIngCsv — câmpuri", () => {
  it("nu taie un câmp citat care conține punct și virgulă", () => {
    const line = row({ details: '"Plata factura; nr 12"' });
    const [r] = parseIngCsv(csv(line));
    expect(r.details).toBe("Plata factura; nr 12");
  });

  it('citește ghilimelele dublate ca un ghilimel literal', () => {
    const [r] = parseIngCsv(csv(row({ details: '"zis ""urgent"" de client"' })));
    expect(r.details).toBe('zis "urgent" de client');
  });

  it('golește placeholder-ul "No details"', () => {
    const [r] = parseIngCsv(csv(row({ details: "No details" })));
    expect(r.details).toBe("");
  });

  it("normalizează valuta la majuscule", () => {
    const [r] = parseIngCsv(csv(row({ currency: "eur" })));
    expect(r.currency).toBe("EUR");
  });

  it("sare peste fragmentele lipite greșit în export", () => {
    // Exporturile ING mai produc linii scurte, rupte din mijlocul unui rând.
    const out = parseIngCsv(csv("28", row({}), ";;;;"));
    expect(out).toHaveLength(1);
  });

  it("ignoră liniile goale", () => {
    expect(parseIngCsv(csv("", row({}), "   ", ""))).toHaveLength(1);
  });

  it("nu tratează header-ul ca tranzacție", () => {
    expect(parseIngCsv(csv())).toHaveLength(0);
  });

  it("păstrează contrapartida și IBAN-ul pentru clasificare", () => {
    const [r] = parseIngCsv(
      csv(row({ counterparty: "Bugetul de stat", iban: "RO12TREZ00000000" })),
    );
    expect(r.counterparty).toBe("Bugetul de stat");
    expect(r.counterpartyIban).toBe("RO12TREZ00000000");
  });
});
