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
 * Varianta "boxed-lite": casetele SmartBill, dar doar cu ce conteaza pe o
 * factura de servicii. Fara etichete bilingve, fara randul 0-6, fara
 * rubrica de expeditie si semnaturi, fara coloana de TVA pe linie (TVA-ul
 * apare o data, la totaluri). Datele de plata stau jos, langa total, unde
 * le cauta cine plateste.
 */

const B = "#000";
const MUTED = "#555555";

const s = StyleSheet.create({
  page: { padding: 32, fontFamily: INVOICE_FONT, fontSize: 7.8, lineHeight: 1.42, color: "#111" },
  head: { flexDirection: "row", borderWidth: 1, borderColor: B },
  party: { width: "37%", padding: 8 },
  center: { width: "26%", padding: 8, borderLeftWidth: 0.8, borderRightWidth: 0.8, borderColor: B, alignItems: "center" },
  name: { fontWeight: 700, fontSize: 8.4, marginBottom: 4 },
  title: { fontSize: 12, fontWeight: 700, marginBottom: 6 },
  meta: { width: "100%", borderWidth: 0.8, borderColor: B, paddingVertical: 4, paddingHorizontal: 6 },
  metaRow: { flexDirection: "row", justifyContent: "space-between" },
  muted: { color: MUTED },
  table: { marginTop: 10, borderWidth: 1, borderColor: B },
  tr: { flexDirection: "row" },
  th: { fontWeight: 700, borderBottomWidth: 0.8, borderColor: B },
  cell: { borderRightWidth: 0.8, borderColor: B, paddingHorizontal: 5, paddingVertical: 5 },
  last: { paddingHorizontal: 5, paddingVertical: 5 },
  cNo: { width: "6%", textAlign: "center" },
  cDesc: { width: "50%" },
  cUnit: { width: "8%", textAlign: "center" },
  cQty: { width: "9%", textAlign: "right" },
  cPrice: { width: "12%", textAlign: "right" },
  cAmount: { width: "15%", textAlign: "right" },
  body: { minHeight: 230 },
  foot: { flexDirection: "row", borderWidth: 1, borderTopWidth: 0, borderColor: B },
  pay: { width: "55%", padding: 8, borderRightWidth: 0.8, borderColor: B },
  totals: { width: "45%" },
  totRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 8, paddingVertical: 4, borderBottomWidth: 0.8, borderColor: B },
  grand: { fontWeight: 700, fontSize: 9.6 },
  kv: { flexDirection: "row" },
  kvKey: { width: 62, color: MUTED },
  band: { borderWidth: 1, borderTopWidth: 0, borderColor: B, paddingHorizontal: 8, paddingVertical: 5 },
  small: { fontSize: 6.5 },
  valid: { marginTop: 6, fontSize: 6.4, color: MUTED },
});

const LITE_LABELS = {
  ro: {
    title: "FACTURA",
    no: "Nr.",
    date: "Data",
    due: "Scadenta",
    vat: "TVA",
    reg: "Reg. com.",
    vatId: "CIF",
    address: "Adresa",
    capital: "Capital",
    county: "Judet",
    noCol: "Nr.",
    desc: "Descriere",
    unit: "U.M.",
    qty: "Cant.",
    price: "Pret unitar",
    amount: "Valoare",
    payment: "Plata",
    bank: "Banca",
    subtotal: "Subtotal",
    totalDue: "Total de plata",
  },
  en: {
    title: "INVOICE",
    no: "No.",
    date: "Date",
    due: "Due",
    vat: "VAT",
    reg: "Reg. no.",
    vatId: "VAT ID",
    address: "Address",
    capital: "Capital",
    county: "County",
    noCol: "No.",
    desc: "Description",
    unit: "Unit",
    qty: "Qty",
    price: "Unit price",
    amount: "Amount",
    payment: "Payment",
    bank: "Bank",
    subtotal: "Subtotal",
    totalDue: "Total due",
  },
} as const;

function T({ style, children }: { style?: Style | Style[]; children?: React.ReactNode }) {
  return (
    <Text style={style} hyphenationCallback={noHyphens}>
      {children}
    </Text>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <View style={s.kv}>
      <T style={s.kvKey}>{k}</T>
      <T style={{ flex: 1 }}>{v}</T>
    </View>
  );
}

export function InvoicePdfBoxedLite({ issuer, invoice }: InvoicePdfProps) {
  const L = invoiceLabels(invoice.clientCountry);
  const X = LITE_LABELS[invoiceLanguage(invoice.clientCountry)];
  const fmt = (n: number) => n.toLocaleString(L.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtRate = (n: number) => n.toLocaleString(L.locale, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  const kind = vatKindForInvoice(invoice.clientCountry, invoice.vatRate, issuer.vatRegistered ?? true);
  const a = invoiceAmounts(invoice);
  const number = `${invoice.series} ${invoice.number}`;
  const vatLabel = L.vatKind[kind] || `${Math.round(invoice.vatRate * 100)}%`;
  const mention = legalMentions(kind, { issuerVatIntra: issuer.vatIntra });
  const issuerVat = kind === "eu_reverse" && issuer.vatIntra ? issuer.vatIntra : issuer.cif;

  // Tara doar cand adresa n-o spune deja.
  const code = invoice.clientCountry ?? "";
  const names = [L.countryNames[code], INVOICE_LABELS.en.countryNames[code]].filter(Boolean) as string[];
  const addr = (invoice.clientAddress ?? "").toLowerCase();
  const country = code && code !== "RO" && !names.some((c) => addr.includes(c.toLowerCase())) ? names[0] ?? code : null;
  const county = code === "RO" ? roCountyName(invoice.clientCounty) : null;
  const cols = [s.cNo, s.cDesc, s.cUnit, s.cQty, s.cPrice];

  return (
    <Document title={`${X.title} ${invoice.series} ${invoice.number}`} author={issuer.name} creator={issuer.name} producer={issuer.name}>
      <Page size="A4" style={s.page}>
        <View style={s.head}>
          <View style={s.party}>
            <T style={s.name}>{issuer.name}</T>
            <KV k={X.vatId} v={issuerVat} />
            <KV k={X.reg} v={issuer.reg} />
            <KV k={X.address} v={issuer.address} />
            <KV k={X.capital} v={issuer.capital} />
          </View>
          <View style={s.center}>
            <T style={s.title}>{X.title}</T>
            <View style={s.meta}>
              {[
                [X.no, number],
                [X.date, invoice.issuedAt],
                ...(invoice.dueAt ? [[X.due, invoice.dueAt]] : []),
                [X.vat, vatLabel],
              ].map(([k, v]) => (
                <View key={k} style={s.metaRow}>
                  <T style={s.muted}>{k}</T>
                  <T>{v}</T>
                </View>
              ))}
            </View>
          </View>
          <View style={s.party}>
            <T style={s.name}>{invoice.clientCompany}</T>
            {invoice.clientCui ? <KV k={X.vatId} v={invoice.clientCui} /> : null}
            {invoice.clientAddress ? <KV k={X.address} v={invoice.clientAddress} /> : null}
            {country ? <KV k="" v={country} /> : null}
            {county ? <KV k={X.county} v={county} /> : null}
          </View>
        </View>

        <View style={s.table}>
          <View style={s.tr}>
            <T style={[s.cell, s.th, s.cNo]}>{X.noCol}</T>
            <T style={[s.cell, s.th, s.cDesc]}>{X.desc}</T>
            <T style={[s.cell, s.th, s.cUnit]}>{X.unit}</T>
            <T style={[s.cell, s.th, s.cQty]}>{X.qty}</T>
            <T style={[s.cell, s.th, s.cPrice]}>{X.price}</T>
            <T style={[s.last, s.th, s.cAmount]}>
              {X.amount} {a.present}
            </T>
          </View>
          <View style={[s.tr, s.body]}>
            {cols.map((col, ci) => (
              <View key={ci} style={[s.cell, col, { paddingVertical: 7 }]}>
                {a.lines.map((l, i) => (
                  <T key={i} style={{ marginBottom: 7 }}>
                    {[String(i + 1), l.description, l.unit, fmtQty(l.quantity), fmt(l.unitPrice)][ci]}
                  </T>
                ))}
              </View>
            ))}
            <View style={[s.last, s.cAmount, { paddingVertical: 7 }]}>
              {a.lines.map((l, i) => (
                <T key={i} style={{ marginBottom: 7 }}>
                  {fmt(l.net)}
                </T>
              ))}
            </View>
          </View>
        </View>

        <View style={s.foot} wrap={false}>
          <View style={s.pay}>
            <T style={[s.name, { marginBottom: 3 }]}>{X.payment}</T>
            <KV k="IBAN" v={groupIban(issuer.iban)} />
            {issuer.swift ? <KV k="SWIFT" v={issuer.swift} /> : null}
            <KV k={X.bank} v={issuer.bank} />
          </View>
          <View style={s.totals}>
            <View style={s.totRow}>
              <T style={s.muted}>{X.subtotal}</T>
              <T>{fmt(a.totalNet)}</T>
            </View>
            <View style={s.totRow}>
              <T style={s.muted}>
                {X.vat} {vatLabel}
              </T>
              <T>{fmt(a.totalVat)}</T>
            </View>
            <View style={[s.totRow, { borderBottomWidth: 0, paddingVertical: 6 }]}>
              <T style={s.grand}>{X.totalDue}</T>
              <T style={s.grand}>
                {fmt(a.totalGross)} {a.present}
              </T>
            </View>
          </View>
        </View>

        {a.showEquivalent ? (
          <View style={s.band}>
            <T>
              {L.equivalent(fmt(a.equivAmount), a.equivCur, invoice.issuedAt.replace(/\//g, "."), a.foreignCur, fmtRate(a.rate))}
            </T>
          </View>
        ) : null}
        {mention || invoice.footerNote ? (
          <View style={s.band}>
            {mention ? <T style={s.small}>{mention.ro}</T> : null}
            {mention ? <T style={s.small}>{mention.en}</T> : null}
            {invoice.footerNote ? <T style={s.small}>{invoice.footerNote}</T> : null}
          </View>
        ) : null}

        <T style={s.valid}>{L.validWithoutSignature}</T>
      </Page>
    </Document>
  );
}
