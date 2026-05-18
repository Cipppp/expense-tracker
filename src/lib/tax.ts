/**
 * Romanian micro-enterprise tax math.
 *
 * Inputs (all in MAJOR units — RON, not bani):
 *   - revenue          : total invoiced revenue for the period (RON)
 *   - bsBas            : monthly health + pension contribution (RON, default 1415)
 *   - cam              : monthly work accident insurance (RON, default 84)
 *   - microPct         : impozit micro (default 0.01 = 1%)
 *   - dividendePct     : impozit dividende (default 0.16 = 16%)
 *   - months           : number of months this period spans
 *
 * Output:
 *   {
 *     bsBasTotal, camTotal, impozitMicro, impozitDividende,
 *     totalTax, net
 *   }
 *
 * Mirrors the Dashboard L3:N7 + L9:U20 logic in the spreadsheet.
 */

export type TaxInputs = {
  revenueRon: number;
  bsBasRon: number;
  camRon: number;
  microPct: number;
  dividendePct: number;
  months: number;
};

export type TaxBreakdown = {
  bsBasTotal: number;
  camTotal: number;
  impozitMicro: number;
  preDividendNet: number;
  impozitDividende: number;
  totalTax: number;
  netRon: number;
};

export function computeRomanianMicroTax(input: TaxInputs): TaxBreakdown {
  const months = Math.max(1, input.months);
  const bsBasTotal = input.bsBasRon * months;
  const camTotal = input.camRon * months;
  const impozitMicro = input.revenueRon * input.microPct;

  // Approximation: dividende is taxed on (revenue − fixed taxes − contributions).
  const preDividendNet =
    input.revenueRon - bsBasTotal - camTotal - impozitMicro;
  const impozitDividende = Math.max(0, preDividendNet) * input.dividendePct;

  const totalTax = bsBasTotal + camTotal + impozitMicro + impozitDividende;
  const netRon = input.revenueRon - totalTax;

  return {
    bsBasTotal,
    camTotal,
    impozitMicro,
    preDividendNet,
    impozitDividende,
    totalTax,
    netRon,
  };
}
