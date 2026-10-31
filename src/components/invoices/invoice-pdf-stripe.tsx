import { Document, Page, StyleSheet, View } from "@react-pdf/renderer";
import { vatKindForInvoice } from "@/lib/vat";
import { legalMentions } from "@/lib/legal-mentions";
import { invoiceLabels, invoiceLanguage } from "@/lib/invoice-labels";
import { INVOICE_FONT, groupIban } from "@/lib/invoice-fonts";
import { fmtQty, invoiceAmounts } from "@/lib/invoice-amounts";
import { KV, T, clientPlace } from "@/components/invoices/pdf-parts";
import type { InvoicePdfProps } from "@/components/invoices/invoice-pdf";

/*
 * Varianta "stripe": asezarea facturilor Stripe, cele pe care clientii le
 * primesc zilnic de la Anthropic, Cloudflare si restul SaaS-urilor. Titlul,
 * numarul si datele sus, apoi cine-cui, apoi o propozitie cu suma si
 * scadenta, tabelul, totalurile si cum se plateste. Tot ce cauta cine
 * plateste e unde se asteapta sa fie.
 */

const MUTED = "#5f6368";
const RULE = "#d0d0d0";

const s = StyleSheet.create({
  page: { paddingTop: 46, paddingHorizontal: 48, paddingBottom: 66, fontFamily: INVOICE_FONT, fontSize: 8.4, lineHeight: 1.45, color: "#111", flexDirection: "column" },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  title: { fontSize: 18, fontWeight: 700 },
  mark: { fontSize: 9.5, fontWeight: 700, textAlign: "right" },
  meta: { marginTop: 14 },
  metaKey: { fontWeight: 700 },
  parties: { flexDirection: "row", marginTop: 26 },
  party: { flex: 1, paddingRight: 20 },
  partyTitle: { fontWeight: 700, marginBottom: 2 },
  headline: { fontSize: 14, fontWeight: 700, marginTop: 30 },
  thead: { flexDirection: "row", marginTop: 26, paddingBottom: 5, borderBottomWidth: 0.8, borderColor: "#111", color: MUTED, fontSize: 7.6 },
  tr: { flexDirection: "row", paddingVertical: 8 },
  cDesc: { width: "52%", paddingRight: 10 },
  cQty: { width: "10%", textAlign: "right" },
  cPrice: { width: "14%", textAlign: "right" },
  cTax: { width: "9%", textAlign: "right" },
  cAmount: { width: "15%", textAlign: "right" },
  totals: { marginLeft: "auto", width: "50%", marginTop: 6 },
  tot: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderTopWidth: 0.5, borderColor: RULE },
  bold: { fontWeight: 700 },
  equiv: { textAlign: "right", fontSize: 7.2, color: MUTED, marginTop: 4 },
  section: { marginTop: 28 },
  sectionTitle: { fontWeight: 700, marginBottom: 4 },
  notes: { marginTop: 28, paddingBottom: 6 },
  note: { fontSize: 7.2, color: MUTED, marginBottom: 3 },
  foot: { position: "absolute", left: 48, right: 48, bottom: 34, borderTopWidth: 0.5, borderColor: RULE, paddingTop: 6, fontSize: 7, color: MUTED },
});

const X = {
  ro: {
    title: "Factura",
    number: "Numar factura",
    issued: "Data emiterii",
    due: "Scadenta",
    vatId: "Cod TVA furnizor",
    billTo: "Facturat catre",
    headline: (amt: string, due: string | null) => (due ? `${amt} de plata pana la ${due}` : `${amt} de plata`),
    desc: "Descriere",
    qty: "Cant.",
    price: "Pret unitar",
    tax: "TVA",
    amount: "Valoare",
    subtotal: "Subtotal",
    exTax: "Total fara TVA",
    total: "Total",
    amountDue: "De plata",
    pay: (amt: string) => `Plata ${amt} prin transfer bancar`,
    holder: "Titular",
    bank: "Banca",
    reference: "Referinta",
    notes: "Mentiuni",
    reg: "Reg. com.",
    capital: "Capital social",
  },
  en: {
    title: "Invoice",
    number: "Invoice number",
    issued: "Date of issue",
    due: "Date due",
    vatId: "VAT registration",
    billTo: "Bill to",
    headline: (amt: string, due: string | null) => (due ? `${amt} due ${due}` : `${amt} due`),
    desc: "Description",
    qty: "Qty",
    price: "Unit price",
    tax: "Tax",
    amount: "Amount",
    subtotal: "Subtotal",
    exTax: "Total excluding tax",
    total: "Total",
    amountDue: "Amount due",
    pay: (amt: string) => `Pay ${amt} by bank transfer`,
    holder: "Account holder",
    bank: "Bank",
    reference: "Reference",
    notes: "Notes",
    reg: "Reg. no.",
    capital: "Share capital",
  },
} as const;

export function InvoicePdfStripe({ issuer, invoice }: InvoicePdfProps) {
  const L = invoiceLabels(invoice.clientCountry);
  const C = X[invoiceLanguage(invoice.clientCountry)];
  const fmt = (n: number) => n.toLocaleString(L.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtRate = (n: number) => n.toLocaleString(L.locale, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  const kind = vatKindForInvoice(invoice.clientCountry, invoice.vatRate, issuer.vatRegistered ?? true);
  const a = invoiceAmounts(invoice);
  const number = `${invoice.series} ${invoice.number}`;
  const vatLabel = L.vatKind[kind] || `${Math.round(invoice.vatRate * 100)}%`;
  const taxCol = kind === "eu_reverse" || kind === "export" ? "0%" : `${Math.round(invoice.vatRate * 100)}%`;
  const mention = legalMentions(kind, { issuerVatIntra: issuer.vatIntra });
  const issuerVat = kind === "eu_reverse" && issuer.vatIntra ? issuer.vatIntra : issuer.cif;
  const due = `${fmt(a.totalGross)} ${a.present}`;
  const place = clientPlace(invoice);
  const KEY = 128;

  return (
    <Document title={`${C.title} ${invoice.series} ${invoice.number}`} author={issuer.name} creator={issuer.name} producer={issuer.name}>
      <Page size="A4" style={s.page}>
        <View style={s.top}>
          <T style={s.title}>{C.title}</T>
          <T style={s.mark}>{issuer.name}</T>
        </View>

        <View style={s.meta}>
          <KV width={KEY} keyStyle={s.metaKey} k={C.number} v={number} />
          <KV width={KEY} keyStyle={s.metaKey} k={C.issued} v={invoice.issuedAt} />
          {invoice.dueAt ? <KV width={KEY} keyStyle={s.metaKey} k={C.due} v={invoice.dueAt} /> : null}
          <KV width={KEY} keyStyle={s.metaKey} k={C.vatId} v={issuerVat} />
        </View>

        <View style={s.parties}>
          <View style={s.party}>
            <T style={s.partyTitle}>{issuer.name}</T>
            <T>{issuer.address}</T>
            <T>
              {C.reg} {issuer.reg}
            </T>
            <T>
              {C.capital} {issuer.capital}
            </T>
          </View>
          <View style={s.party}>
            <T style={s.partyTitle}>{C.billTo}</T>
            <T>{invoice.clientCompany}</T>
            {invoice.clientAddress ? <T>{invoice.clientAddress}</T> : null}
            {place ? <T>{place}</T> : null}
            {invoice.clientCui ? <T>{invoice.clientCui}</T> : null}
          </View>
        </View>

        <T style={s.headline}>{C.headline(due, invoice.dueAt ?? null)}</T>

        <View style={s.thead}>
          <T style={s.cDesc}>{C.desc}</T>
          <T style={s.cQty}>{C.qty}</T>
          <T style={s.cPrice}>{C.price}</T>
          <T style={s.cTax}>{C.tax}</T>
          <T style={s.cAmount}>{C.amount}</T>
        </View>
        {a.lines.map((l, i) => (
          <View key={i} style={s.tr} wrap={false}>
            <T style={s.cDesc}>{l.description}</T>
            <T style={s.cQty}>
              {fmtQty(l.quantity)} {l.unit}
            </T>
            <T style={s.cPrice}>{fmt(l.unitPrice)}</T>
            <T style={s.cTax}>{taxCol}</T>
            <T style={s.cAmount}>{fmt(l.net)}</T>
          </View>
        ))}

        <View style={s.totals} wrap={false}>
          <View style={s.tot}>
            <T>{C.subtotal}</T>
            <T>{fmt(a.totalNet)}</T>
          </View>
          <View style={s.tot}>
            <T>{C.exTax}</T>
            <T>{fmt(a.totalNet)}</T>
          </View>
          <View style={s.tot}>
            <T>
              {L.vatRate} ({vatLabel})
            </T>
            <T>{fmt(a.totalVat)}</T>
          </View>
          <View style={s.tot}>
            <T>{C.total}</T>
            <T>{fmt(a.totalGross)}</T>
          </View>
          <View style={s.tot}>
            <T style={s.bold}>{C.amountDue}</T>
            <T style={s.bold}>{due}</T>
          </View>
          {a.showEquivalent ? (
            <T style={s.equiv}>
              {fmt(a.equivAmount)} {a.equivCur} · BNR {invoice.issuedAt.replace(/\//g, ".")}: 1 {a.foreignCur} = {fmtRate(a.rate)} RON
            </T>
          ) : null}
        </View>

        <View style={s.section} wrap={false}>
          <T style={s.sectionTitle}>{C.pay(due)}</T>
          <KV width={KEY} k={C.holder} v={issuer.name} />
          <KV width={KEY} k="IBAN" v={groupIban(issuer.iban)} />
          {issuer.swift ? <KV width={KEY} k="SWIFT/BIC" v={issuer.swift} /> : null}
          <KV width={KEY} k={C.bank} v={issuer.bank} />
          <KV width={KEY} k={C.reference} v={number} />
        </View>

        {/* Mentiunile legale coboara la baza paginii, chiar deasupra subsolului:
            sunt pentru contabilitate, nu pentru cine plateste. */}
        <View style={{ flexGrow: 1 }} />
        {mention || invoice.footerNote ? (
          <View style={s.notes} wrap={false}>
            {mention ? <T style={s.note}>{mention.ro}</T> : null}
            {mention ? <T style={s.note}>{mention.en}</T> : null}
            {invoice.footerNote ? <T style={s.note}>{invoice.footerNote}</T> : null}
          </View>
        ) : null}

        <View style={s.foot} fixed>
          <T>
            {number} · {C.headline(due, invoice.dueAt ?? null)}
          </T>
          <T>{L.validWithoutSignature}</T>
        </View>
      </Page>
    </Document>
  );
}
