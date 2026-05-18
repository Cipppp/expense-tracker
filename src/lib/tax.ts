/**
 * Romanian micro-enterprise tax math for a single-shareholder SRL.
 *
 *   1. SRL collects revenue (RON).
 *   2. Pays REQUIRED monthly contributions: BS+BAS and CAM.
 *   3. Pays impozit micro (1% of revenue) — assumed quarterly, summed YTD here.
 *   4. The remainder sits in the SRL account.
 *   5. The owner chooses how much to withdraw as DIVIDENDS.
 *   6. 16% impozit dividende is withheld on that amount.
 *   7. The net goes to the owner's personal account.
 *
 * All inputs/outputs are in MAJOR units (RON).
 */

export type TaxInputs = {
  revenueRon: number;
  bsBasRon: number;          // monthly cost in RON
  camRon: number;            // monthly cost in RON
  microPct: number;          // e.g. 0.01
  dividendePct: number;      // e.g. 0.16
  months: number;            // months active in the period
  dividendsToExtractRon: number;
};

export type TaxBreakdown = {
  bsBasTotal: number;
  camTotal: number;
  impozitMicro: number;
  srlRequiredTax: number;       // sum of BS+BAS + CAM + impozit micro
  moneyInSrlBefore: number;     // revenue − required taxes (before any extraction)
  dividendsToExtract: number;
  impozitDividende: number;
  netToOwner: number;           // dividends − impozit dividende
  moneyInSrlAfter: number;      // moneyInSrlBefore − dividendsToExtract
  extractionExceedsCash: boolean; // user tried to extract more than what's left
};

export function computeRomanianMicroTax(input: TaxInputs): TaxBreakdown {
  const months = Math.max(1, input.months);
  const bsBasTotal = input.bsBasRon * months;
  const camTotal = input.camRon * months;
  const impozitMicro = input.revenueRon * input.microPct;
  const srlRequiredTax = bsBasTotal + camTotal + impozitMicro;
  const moneyInSrlBefore = input.revenueRon - srlRequiredTax;

  const dividendsToExtract = Math.max(0, input.dividendsToExtractRon);
  const impozitDividende = dividendsToExtract * input.dividendePct;
  const netToOwner = dividendsToExtract - impozitDividende;
  const moneyInSrlAfter = moneyInSrlBefore - dividendsToExtract;

  return {
    bsBasTotal,
    camTotal,
    impozitMicro,
    srlRequiredTax,
    moneyInSrlBefore,
    dividendsToExtract,
    impozitDividende,
    netToOwner,
    moneyInSrlAfter,
    extractionExceedsCash: dividendsToExtract > 0 && dividendsToExtract > moneyInSrlBefore,
  };
}
