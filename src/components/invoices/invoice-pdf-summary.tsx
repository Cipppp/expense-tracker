import { Document, Page, StyleSheet, View } from "@react-pdf/renderer";
import { vatKindForInvoice } from "@/lib/vat";
import { legalMentions } from "@/lib/legal-mentions";
import { invoiceLabels, invoiceLanguage } from "@/lib/invoice-labels";
import { INVOICE_FONT, groupIban } from "@/lib/invoice-fonts";
import { fmtQty, invoiceAmounts } from "@/lib/invoice-amounts";
import { KV, T, clientPlace } from "@/components/invoices/pdf-parts";
import type { InvoicePdfProps } from "@/components/invoices/invoice-pdf";

/*
 * Varianta "summary": ca facturile AWS si Google Cloud. Sus in dreapta o
 * caseta cu sumarul (numar, date, total de plata), ca cine plateste sa nu
 * citeasca restul paginii; dedesubt detaliul, pe benzi gri cu titlu. Datele
 * legale ale firmei stau o singura data, centrate in subsol.
 */

const MUTED = "#5f6368";
const BAND = "#eceff3";
const LINE = "#c9ced6";

const s = StyleSheet.create({
  page: { paddingTop: 44, paddingHorizontal: 44, paddingBottom: 86, fontFamily: INVOICE_FONT, fontSize: 8.4, lineHeight: 1.45, color: "#111" },
  top: { flexDirection: "row", justifyContent: "space-between" },
  left: { width: "48%" },
  issuer: { fontSize: 11, fontWeight: 700 },
  title: { fontSize: 22, fontWeight: 700, marginTop: 10, lineHeight: 1.2 },
  number: { fontSize: 11, color: MUTED, marginTop: 4, lineHeight: 1.2 },
  box: { width: "46%", borderWidth: 0.8, borderColor: LINE },
  boxHead: { backgroundColor: BAND, paddingHorizontal: 9, paddingVertical: 5, fontWeight: 700 },
  boxRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 9, paddingVertical: 4, borderTopWidth: 0.5, borderColor: LINE },
  boxTotal: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 9, paddingVertical: 7, borderTopWidth: 0.8, borderColor: "#111" },
  boxTotalText: { fontWeight: 700, fontSize: 10.5 },
  equiv: { paddingHorizontal: 9, paddingBottom: 6, fontSize: 7, color: MUTED, textAlign: "right" },
  parties: { flexDirection: "row", marginTop: 26 },
  party: { flex: 1, paddingRight: 18 },
  label: { fontWeight: 700, marginBottom: 3 },
  muted: { color: MUTED },
  band: { backgroundColor: BAND, paddingHorizontal: 9, paddingVertical: 5, fontWeight: 700, marginTop: 26, flexDirection: "row", justifyContent: "space-between" },
  line: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 9, paddingVertical: 6, borderBottomWidth: 0.5, borderColor: LINE },
  sub: { flexDirection: "row", justifyContent: "space-between", paddingLeft: 22, paddingRight: 9, paddingVertical: 4, borderBottomWidth: 0.5, borderColor: LINE, color: MUTED },
  payBody: { paddingHorizontal: 9, paddingTop: 7 },
  note: { fontSize: 7.2, color: MUTED, marginTop: 4, paddingHorizontal: 9 },
  foot: { position: "absolute", left: 44, right: 44, bottom: 30, textAlign: "center", fontSize: 6.8, color: MUTED },
});

const X = {
  ro: {
    title: "Factura",
    summary: "Sumar factura",
    number: "Numar factura",
    issued: "Data emiterii",
    due: "Scadenta",
    net: "Total fara TVA",
    vat: "TVA",
    totalDue: "TOTAL DE PLATA",
    billTo: "Facturat catre",
    from: "Furnizor",
    detail: "Detaliu",
    payment: "Plata prin transfer bancar",
    holder: "Titular",
    bank: "Banca",
    reference: "Referinta",
    notes: "Mentiuni",
    vatId: "CIF",
    reg: "Reg. com.",
    capital: "Capital social",
  },
  en: {
    title: "Invoice",
    summary: "Invoice summary",
    number: "Invoice number",
    issued: "Issue date",
    due: "Due date",
    net: "Total excl. VAT",
    vat: "VAT",
    totalDue: "TOTAL DUE",
    billTo: "Bill to",
    from: "From",
    detail: "Detail",
    payment: "Payment by bank transfer",
    holder: "Account holder",
    bank: "Bank",
    reference: "Reference",
    notes: "Notes",
    vatId: "VAT ID",
    reg: "Reg. no.",
    capital: "Share capital",
  },
} as const;

export function InvoicePdfSummary({ issuer, invoice }: InvoicePdfProps) {
  const L = invoiceLabels(invoice.clientCountry);
  const C = X[invoiceLanguage(invoice.clientCountry)];
  const fmt = (n: number) => n.toLocaleString(L.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtRate = (n: number) => n.toLocaleString(L.locale, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  const kind = vatKindForInvoice(invoice.clientCountry, invoice.vatRate, issuer.vatRegistered ?? true);
  const a = invoiceAmounts(invoice);
  const number = `${invoice.series} ${invoice.number}`;
  const vatLabel = L.vatKind[kind] || `${Math.round(invoice.vatRate * 100)}%`;
  const mention = legalMentions(kind, { issuerVatIntra: issuer.vatIntra });
  const issuerVat = kind === "eu_reverse" && issuer.vatIntra ? issuer.vatIntra : issuer.cif;
  const place = clientPlace(invoice);

  return (
    <Document title={`${C.title} ${invoice.series} ${invoice.number}`} author={issuer.name} creator={issuer.name} producer={issuer.name}>
      <Page size="A4" style={s.page}>
        <View style={s.top}>
          <View style={s.left}>
            <T style={s.issuer}>{issuer.name}</T>
            <T style={s.title}>{C.title}</T>
            <T style={s.number}>{number}</T>
          </View>
          <View style={s.box} wrap={false}>
            <T style={s.boxHead}>{C.summary}</T>
            {[
              [C.number, number],
              [C.issued, invoice.issuedAt],
              ...(invoice.dueAt ? [[C.due, invoice.dueAt]] : []),
              [C.net, `${fmt(a.totalNet)} ${a.present}`],
              [`${C.vat} (${vatLabel})`, `${fmt(a.totalVat)} ${a.present}`],
            ].map(([k, v]) => (
              <View key={k} style={s.boxRow}>
                <T style={s.muted}>{k}</T>
                <T>{v}</T>
              </View>
            ))}
            <View style={s.boxTotal}>
              <T style={s.boxTotalText}>{C.totalDue}</T>
              <T style={s.boxTotalText}>
                {fmt(a.totalGross)} {a.present}
              </T>
            </View>
            {a.showEquivalent ? (
              <T style={s.equiv}>
                {fmt(a.equivAmount)} {a.equivCur} · BNR 1 {a.foreignCur} = {fmtRate(a.rate)} RON
              </T>
            ) : null}
          </View>
        </View>

        <View style={s.parties}>
          <View style={s.party}>
            <T style={s.label}>{C.billTo}</T>
            <T>{invoice.clientCompany}</T>
            {invoice.clientAddress ? <T style={s.muted}>{invoice.clientAddress}</T> : null}
            {place ? <T style={s.muted}>{place}</T> : null}
            {invoice.clientCui ? (
              <T style={s.muted}>
                {C.vatId} {invoice.clientCui}
              </T>
            ) : null}
          </View>
          <View style={s.party}>
            <T style={s.label}>{C.from}</T>
            <T>{issuer.name}</T>
            <T style={s.muted}>{issuer.address}</T>
            <T style={s.muted}>
              {C.vatId} {issuerVat}
            </T>
          </View>
        </View>

        <View style={s.band}>
          <T>{C.detail}</T>
          <T>{a.present}</T>
        </View>
        {a.lines.map((l, i) => (
          <View key={i} wrap={false}>
            <View style={s.line}>
              <T style={{ width: "78%", fontWeight: 500 }}>{l.description}</T>
              <T style={{ fontWeight: 500 }}>{fmt(l.net)}</T>
            </View>
            <View style={s.sub}>
              <T>
                {fmtQty(l.quantity)} {l.unit} × {fmt(l.unitPrice)}
              </T>
              <T>{fmt(l.net)}</T>
            </View>
            <View style={s.sub}>
              <T>
                {C.vat} ({vatLabel})
              </T>
              <T>{fmt(l.vat)}</T>
            </View>
          </View>
        ))}

        <View wrap={false}>
          <View style={s.band}>
            <T>{C.payment}</T>
          </View>
          <View style={s.payBody}>
            <KV width={110} k={C.holder} v={issuer.name} />
            <KV width={110} k="IBAN" v={groupIban(issuer.iban)} />
            {issuer.swift ? <KV width={110} k="SWIFT/BIC" v={issuer.swift} /> : null}
            <KV width={110} k={C.bank} v={issuer.bank} />
            <KV width={110} k={C.reference} v={number} />
          </View>
        </View>

        {mention || invoice.footerNote ? (
          <View wrap={false}>
            <View style={s.band}>
              <T>{C.notes}</T>
            </View>
            {mention ? <T style={s.note}>{mention.ro}</T> : null}
            {mention ? <T style={s.note}>{mention.en}</T> : null}
            {invoice.footerNote ? <T style={s.note}>{invoice.footerNote}</T> : null}
          </View>
        ) : null}

        <View style={s.foot} fixed>
          <T>
            {issuer.name} · {issuer.address}
          </T>
          <T>
            {C.reg} {issuer.reg} · {C.vatId} {issuerVat} · {C.capital} {issuer.capital}
          </T>
          <T>{L.validWithoutSignature}</T>
        </View>
      </Page>
    </Document>
  );
}
