import { Text, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import { roCountyName } from "@/lib/anaf/scope";
import { INVOICE_LABELS, invoiceLabels } from "@/lib/invoice-labels";
import { noHyphens } from "@/lib/invoice-fonts";
import type { InvoicePdfProps } from "@/components/invoices/invoice-pdf";

/* Bucati comune ale template-urilor noi de factura. */

/** Text fara despartire in silabe. */
export function T({ style, children }: { style?: Style | Style[]; children?: React.ReactNode }) {
  return (
    <Text style={style} hyphenationCallback={noHyphens}>
      {children}
    </Text>
  );
}

/** Eticheta si valoare pe acelasi rand, cu eticheta pe o latime fixa. */
export function KV({ k, v, width, keyStyle }: { k: string; v: string; width: number; keyStyle?: Style }) {
  return (
    <View style={{ flexDirection: "row" }}>
      <T style={[{ width }, keyStyle ?? {}]}>{k}</T>
      <T style={{ flex: 1 }}>{v}</T>
    </View>
  );
}

/**
 * Randul de tara/judet al clientului, doar cand adresa nu-l contine deja:
 * "…, 2100 Copenhagen, Denmark" nu mai are nevoie de inca un "Denmark".
 */
export function clientPlace(invoice: InvoicePdfProps["invoice"]): string | null {
  const code = invoice.clientCountry ?? "";
  if (code === "RO") return roCountyName(invoice.clientCounty) ?? null;
  if (!code) return null;
  const names = [invoiceLabels(code).countryNames[code], INVOICE_LABELS.en.countryNames[code]].filter(Boolean) as string[];
  const addr = (invoice.clientAddress ?? "").toLowerCase();
  return names.some((c) => addr.includes(c.toLowerCase())) ? null : names[0] ?? code;
}
