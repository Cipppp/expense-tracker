/*
 * Ce aspect are PDF-ul unei facturi.
 *
 * O factura emisa nu se mai schimba: cand clientul sau contabila o descarca
 * peste un an, trebuie sa arate exact ca exemplarul trimis atunci. Asa ca
 * aspectul il decide data emiterii, nu momentul descarcarii. Tot ce s-a emis
 * inainte de 1 noiembrie 2026 ramane pe "classic" (cel copiat dupa SmartBill),
 * iar de atunci incolo se foloseste "mono", in JetBrains Mono.
 */

/** boxed*, clean si sheet* sunt variante in proba; data emiterii alege doar intre classic si mono. */
export type InvoiceTemplate = "classic" | "mono" | "boxed" | "boxed-lite" | "clean" | "sheet" | "sheet-open";

/** Prima zi (UTC) de la care facturile ies pe template-ul nou. */
export const MONO_TEMPLATE_FROM = "2026-11-01";

export function invoiceTemplate(issuedAt: Date): InvoiceTemplate {
  return issuedAt.toISOString().slice(0, 10) >= MONO_TEMPLATE_FROM ? "mono" : "classic";
}
