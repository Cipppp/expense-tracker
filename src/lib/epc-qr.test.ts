import { describe, expect, it } from "vitest";
import { epcMatrix, epcPayload } from "@/lib/epc-qr";

/*
 * Un rand gresit in payload si banca clientului nu mai recunoaste codul, sau
 * mai rau, completeaza alta suma. Ordinea si formatul campurilor sunt cele
 * din EPC069-12.
 */
const pay = { bic: "INGBROBU", name: "PROJECT CIP S.R.L.", iban: "RO53 INGB 0000 9999 1982 2780", amount: 4400, remittance: "Invoice CP 0035" };

describe("epcPayload", () => {
  it("pune campurile in ordinea din standard", () => {
    expect(epcPayload(pay).split("\n")).toEqual([
      "BCD",
      "002",
      "1",
      "SCT",
      "INGBROBU",
      "PROJECT CIP S.R.L.",
      "RO53INGB0000999919822780",
      "EUR4400.00",
      "",
      "",
      "Invoice CP 0035",
    ]);
  });

  it("scrie suma cu doua zecimale si punct", () => {
    expect(epcPayload({ ...pay, amount: 1369.5 })).toContain("\nEUR1369.50\n");
  });

  it("refuza o suma pe care banca n-ar accepta-o", () => {
    expect(() => epcPayload({ ...pay, amount: 0 })).toThrow();
  });
});

describe("epcMatrix", () => {
  it("da un cod patrat", () => {
    const m = epcMatrix(pay);
    expect(m.length).toBeGreaterThan(20);
    expect(m.every((row) => row.length === m.length)).toBe(true);
  });
});
