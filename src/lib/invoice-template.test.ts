import { describe, expect, it } from "vitest";
import { invoiceTemplate } from "@/lib/invoice-template";

/*
 * Facturile se salveaza la pranz UTC (dateAtNoonUTC), deci granita e ziua,
 * nu ora. O factura veche care ar iesi pe template-ul nou n-ar mai semana cu
 * exemplarul pe care l-a primit clientul.
 */
describe("invoiceTemplate", () => {
  it("lasa facturile emise pana pe 31 octombrie pe aspectul vechi", () => {
    expect(invoiceTemplate(new Date("2026-10-02T12:00:00Z"))).toBe("classic");
    expect(invoiceTemplate(new Date("2026-10-31T23:59:59Z"))).toBe("classic");
  });

  it("pune facturile din 1 noiembrie incolo pe template-ul nou", () => {
    expect(invoiceTemplate(new Date("2026-11-01T00:00:00Z"))).toBe("mono");
    expect(invoiceTemplate(new Date("2026-11-02T12:00:00Z"))).toBe("mono");
  });
});
