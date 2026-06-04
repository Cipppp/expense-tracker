/**
 * VAT treatment for a Romanian VAT-registered SRL issuing B2B invoices.
 *
 * Three cases that must be distinguished on the invoice — the legal wording
 * differs and getting it wrong is an audit problem:
 *   - domestic (RO, or country unknown): charge the standard rate (21%).
 *   - EU member state (non-RO): 0%, intra-community reverse charge,
 *     art. 196 Directive 2006/112/EC.
 *   - non-EU (US, UK, etc.): 0%, export of services, non-taxable in Romania
 *     under the place-of-supply rules (art. 278 Cod fiscal) — NOT art. 196.
 *
 * Country codes are normalised (trimmed + upper-cased) so casing never
 * changes the treatment.
 */

// ISO 3166-1 alpha-2 of EU member states (post-Brexit: GB excluded).
export const EU_MEMBER_STATES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
  "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
  "SI", "ES", "SE",
]);

export type VatKind = "domestic" | "eu_reverse" | "export" | "none";

function norm(country: string | null | undefined): string {
  return (country ?? "").trim().toUpperCase();
}

/**
 * Derive the VAT rate + treatment for a new invoice from the client country.
 * `roRate` is the configured Romanian standard rate (e.g. 0.21). When the
 * country is unknown we default to DOMESTIC (charge VAT) — over-charging is
 * recoverable; silently zero-rating a domestic invoice is a compliance risk.
 */
export function deriveVat(
  country: string | null | undefined,
  roRate: number,
): { vatRate: number; kind: VatKind } {
  const c = norm(country);
  if (c === "" || c === "RO") return { vatRate: roRate, kind: "domestic" };
  if (EU_MEMBER_STATES.has(c)) return { vatRate: 0, kind: "eu_reverse" };
  return { vatRate: 0, kind: "export" };
}

/**
 * Classify an already-issued invoice for display, from its snapshotted
 * country + vatRate. Used by the PDF and the detail page so the wording is
 * always consistent.
 */
export function vatKindForInvoice(
  country: string | null | undefined,
  vatRate: number,
): VatKind {
  if (vatRate > 0) return "domestic";
  const c = norm(country);
  if (c === "" || c === "RO") return "none";
  if (EU_MEMBER_STATES.has(c)) return "eu_reverse";
  return "export";
}
