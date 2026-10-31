import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import { vatKindForInvoice } from "@/lib/vat";
import { roCountyName } from "@/lib/anaf/scope";
import { legalMentions } from "@/lib/legal-mentions";
import { INVOICE_LABELS, invoiceLabels, invoiceLanguage } from "@/lib/invoice-labels";
import { INVOICE_FONT, groupIban, noHyphens } from "@/lib/invoice-fonts";
import { fmtQty, invoiceAmounts } from "@/lib/invoice-amounts";
import type { InvoicePdfProps } from "@/components/invoices/invoice-pdf";

/*
 * Varianta "clean": doar ce trebuie pe o factura, cu mult aer intre
 * blocuri. Ierarhia o fac marimea si greutatea textului, nu chenarele:
 * titlul mare, suma de plata cel mai vizibil numar, restul gri si mic.
 * TVA-ul apare o data, la totaluri (factura are o singura cota), iar
 * mentiunile legale stau jos, ca nota de subsol.
 */

const INK = "#1d1d1f";
const MUTED = "#6e6e73";
const FAINT = "#86868b";
const HAIR = "#e5e5ea";
const PANEL = "#f5f5f7";

const s = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingHorizontal: 56,
    paddingBottom: 132,
    fontFamily: INVOICE_FONT,
    fontSize: 8,
    lineHeight: 1.5,
    color: INK,
  },
  issuer: { fontSize: 8, fontWeight: 700 },
  title: { fontSize: 26, fontWeight: 700, letterSpacing: -0.8, marginTop: 34, lineHeight: 1.1 },
  sub: { fontSize: 9, color: MUTED, marginTop: 6 },
  cols: { flexDirection: "row", marginTop: 34 },
  col: { flex: 1, paddingRight: 16 },
  colLast: { width: 150 },
  label: { fontSize: 6.6, color: FAINT, marginBottom: 6 },
  strong: { fontWeight: 500 },
  muted: { color: MUTED },
  pair: { flexDirection: "row", justifyContent: "space-between" },
  items: { marginTop: 40 },
  itemsHead: { flexDirection: "row", justifyContent: "space-between", paddingBottom: 7, borderBottomWidth: 0.6, borderColor: HAIR },
  item: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 11, borderBottomWidth: 0.6, borderColor: HAIR },
  itemDesc: { width: "72%", fontSize: 8.6 },
  itemCalc: { color: MUTED, marginTop: 3 },
  itemAmount: { fontSize: 8.6, textAlign: "right" },
  totals: { marginLeft: "auto", width: 230, marginTop: 14 },
  totRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  due: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 10, paddingTop: 10, borderTopWidth: 0.6, borderColor: HAIR },
  dueLabel: { fontSize: 9, fontWeight: 700, lineHeight: 1, marginBottom: 1.5 },
  dueAmount: { fontSize: 15, fontWeight: 700, letterSpacing: -0.3, lineHeight: 1 },
  equiv: { fontSize: 6.8, color: MUTED, textAlign: "right", marginTop: 7 },
  bottom: { position: "absolute", left: 56, right: 56, bottom: 40 },
  pay: { flexDirection: "row", backgroundColor: PANEL, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 14 },
  payCol: { marginRight: 34 },
  fine: { fontSize: 6.2, color: FAINT, marginTop: 12, lineHeight: 1.5 },
});

/*
 * Textele noi ale variantei. Restul (registru, CIF, adresa) vin din
 * lib/invoice-labels, ca factura sa vorbeasca la fel ca previzualizarea.
 */
const CLEAN_LABELS = {
  ro: {
    title: "Factura",
    billedTo: "Client",
    from: "Furnizor",
    details: "Detalii",
    issued: "Emisa",
    due: "Scadenta",
    description: "Descriere",
    amount: "Suma",
    subtotal: "Subtotal",
    vat: "TVA",
    totalDue: "Total de plata",
    payTo: "Plata prin transfer bancar",
    reference: "Referinta",
    vatId: "CIF",
    reg: "Reg. com.",
    capital: "Capital social",
  },
  en: {
    title: "Invoice",
    billedTo: "Billed to",
    from: "From",
    details: "Details",
    issued: "Issued",
    due: "Due",
    description: "Description",
    amount: "Amount",
    subtotal: "Subtotal",
    vat: "VAT",
    totalDue: "Total due",
    payTo: "Pay by bank transfer",
    reference: "Reference",
    vatId: "VAT",
    reg: "Reg.",
    capital: "Share capital",
  },
} as const;

function T({ style, children }: { style?: Style | Style[]; children?: React.ReactNode }) {
  return (
    <Text style={style} hyphenationCallback={noHyphens}>
      {children}
    </Text>
  );
}

function Pair({ k, v }: { k: string; v: string }) {
  return (
    <View style={s.pair}>
      <T style={s.muted}>{k}</T>
      <T>{v}</T>
    </View>
  );
}

export function InvoicePdfClean({ issuer, invoice }: InvoicePdfProps) {
  const L = invoiceLabels(invoice.clientCountry);
  const C = CLEAN_LABELS[invoiceLanguage(invoice.clientCountry)];
  const fmt = (n: number) => n.toLocaleString(L.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtRate = (n: number) => n.toLocaleString(L.locale, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  const kind = vatKindForInvoice(invoice.clientCountry, invoice.vatRate, issuer.vatRegistered ?? true);
  const a = invoiceAmounts(invoice);
  const number = `${invoice.series} ${invoice.number}`;
  const vatLabel = L.vatKind[kind] || `${Math.round(invoice.vatRate * 100)}%`;
  const mention = legalMentions(kind, { issuerVatIntra: issuer.vatIntra });
  const issuerVat = kind === "eu_reverse" && issuer.vatIntra ? issuer.vatIntra : issuer.cif;

  // Tara se adauga doar cand adresa n-o spune deja, ca sa nu apara de doua ori.
  const countryName = invoice.clientCountry && invoice.clientCountry !== "RO" ? L.countryNames[invoice.clientCountry] ?? invoice.clientCountry : null;
  const english = invoice.clientCountry ? INVOICE_LABELS.en.countryNames[invoice.clientCountry] : undefined;
  const addressHasCountry = (addr: string) =>
    [countryName, english].some((c) => c && addr.toLowerCase().includes(c.toLowerCase()));
  const clientPlace =
    invoice.clientCountry === "RO"
      ? roCountyName(invoice.clientCounty)
      : countryName && !(invoice.clientAddress && addressHasCountry(invoice.clientAddress))
        ? countryName
        : null;

  return (
    <Document title={`${C.title} ${number}`} author={issuer.name} creator={issuer.name} producer={issuer.name}>
      <Page size="A4" style={s.page}>
        <T style={s.issuer}>{issuer.name}</T>
        <T style={s.title}>{C.title}</T>
        <T style={s.sub}>
          {number} · {invoice.issuedAt}
        </T>

        <View style={s.cols}>
          <View style={s.col}>
            <T style={s.label}>{C.billedTo}</T>
            <T style={s.strong}>{invoice.clientCompany}</T>
            {invoice.clientAddress ? <T style={s.muted}>{invoice.clientAddress}</T> : null}
            {clientPlace ? <T style={s.muted}>{clientPlace}</T> : null}
            {invoice.clientCui ? <T style={s.muted}>{C.vatId} {invoice.clientCui}</T> : null}
            {invoice.clientReg ? <T style={s.muted}>{C.reg} {invoice.clientReg}</T> : null}
          </View>
          <View style={s.col}>
            <T style={s.label}>{C.from}</T>
            <T style={s.strong}>{issuer.name}</T>
            <T style={s.muted}>{issuer.address}</T>
            <T style={s.muted}>{C.vatId} {issuerVat}</T>
            <T style={s.muted}>{C.reg} {issuer.reg}</T>
            <T style={s.muted}>{C.capital} {issuer.capital}</T>
          </View>
          <View style={s.colLast}>
            <T style={s.label}>{C.details}</T>
            <Pair k={C.issued} v={invoice.issuedAt} />
            {invoice.dueAt ? <Pair k={C.due} v={invoice.dueAt} /> : null}
            <Pair k={C.reference} v={number} />
          </View>
        </View>

        <View style={s.items}>
          <View style={s.itemsHead}>
            <T style={[s.label, { marginBottom: 0 }]}>{C.description}</T>
            <T style={[s.label, { marginBottom: 0 }]}>
              {C.amount} ({a.present})
            </T>
          </View>
          {a.lines.map((l, i) => (
            <View key={i} style={s.item} wrap={false}>
              <View style={s.itemDesc}>
                <T>{l.description}</T>
                <T style={s.itemCalc}>
                  {fmtQty(l.quantity)} {l.unit} × {fmt(l.unitPrice)} {a.present}
                </T>
              </View>
              <T style={s.itemAmount}>{fmt(l.net)}</T>
            </View>
          ))}
        </View>

        <View style={s.totals} wrap={false}>
          <View style={s.totRow}>
            <T style={s.muted}>{C.subtotal}</T>
            <T>{fmt(a.totalNet)}</T>
          </View>
          <View style={s.totRow}>
            <T style={s.muted}>
              {C.vat} ({vatLabel})
            </T>
            <T>{fmt(a.totalVat)}</T>
          </View>
          <View style={s.due}>
            <T style={s.dueLabel}>{C.totalDue}</T>
            <T style={s.dueAmount}>
              {fmt(a.totalGross)} {a.present}
            </T>
          </View>
          {a.showEquivalent ? (
            <T style={s.equiv}>
              {fmt(a.equivAmount)} {a.equivCur} · BNR {invoice.issuedAt.replace(/\//g, ".")}, 1 {a.foreignCur} = {fmtRate(a.rate)} RON
            </T>
          ) : null}
        </View>

        <View style={s.bottom} fixed>
          <View style={s.pay}>
            <View style={s.payCol}>
              <T style={s.label}>{C.payTo}</T>
              <T style={s.strong}>{groupIban(issuer.iban)}</T>
            </View>
            {issuer.swift ? (
              <View style={s.payCol}>
                <T style={s.label}>SWIFT/BIC</T>
                <T>{issuer.swift}</T>
              </View>
            ) : null}
            <View style={s.payCol}>
              <T style={s.label}>{L.bank}</T>
              <T>{issuer.bank}</T>
            </View>
            <View>
              <T style={s.label}>{C.reference}</T>
              <T>{number}</T>
            </View>
          </View>
          <T style={s.fine}>
            {[mention?.ro, mention?.en, invoice.footerNote, L.validWithoutSignature].filter(Boolean).join("\n")}
          </T>
        </View>
      </Page>
    </Document>
  );
}

