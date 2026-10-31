import { Document, Page, StyleSheet, View } from "@react-pdf/renderer";
import { vatKindForInvoice } from "@/lib/vat";
import { legalMentions } from "@/lib/legal-mentions";
import { invoiceLabels, invoiceLanguage } from "@/lib/invoice-labels";
import { INVOICE_FONT, groupIban } from "@/lib/invoice-fonts";
import { fmtQty, invoiceAmounts } from "@/lib/invoice-amounts";
import { T, clientPlace } from "@/components/invoices/pdf-parts";
import type { InvoicePdfProps } from "@/components/invoices/invoice-pdf";

/*
 * Varianta "letter": factura ca scrisoare de afaceri dupa DIN 5008, cum
 * arata facturile firmelor germane si nordice. Adresa clientului in stanga
 * sus (unde cade fereastra plicului), blocul de informatii in dreapta,
 * subiectul pe un rand, tabelul, apoi o propozitie care spune exact cat,
 * pana cand si unde se plateste. Datele firmei si banca stau in subsol, pe
 * coloane, ca pe hartia cu antet.
 */

const MUTED = "#5f6368";
const RULE = "#cfcfcf";

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingHorizontal: 56, paddingBottom: 110, fontFamily: INVOICE_FONT, fontSize: 8.6, lineHeight: 1.5, color: "#111" },
  head: { alignItems: "flex-end" },
  issuer: { fontSize: 12, fontWeight: 700 },
  window: { flexDirection: "row", marginTop: 54 },
  address: { width: "55%" },
  returnLine: { fontSize: 6.2, color: MUTED, borderBottomWidth: 0.5, borderColor: RULE, paddingBottom: 2, marginBottom: 8, alignSelf: "flex-start" },
  infoBlock: { width: "45%" },
  info: { flexDirection: "row", justifyContent: "space-between" },
  subject: { fontSize: 12, fontWeight: 700, marginTop: 46 },
  intro: { marginTop: 10 },
  thead: { flexDirection: "row", marginTop: 18, paddingBottom: 5, borderBottomWidth: 0.8, borderColor: "#111", fontWeight: 700 },
  tr: { flexDirection: "row", paddingVertical: 7, borderBottomWidth: 0.5, borderColor: RULE },
  cPos: { width: "7%" },
  cDesc: { width: "47%", paddingRight: 10 },
  cQty: { width: "12%", textAlign: "right" },
  cPrice: { width: "15%", textAlign: "right" },
  cAmount: { width: "19%", textAlign: "right" },
  totals: { marginLeft: "auto", width: "48%", marginTop: 8 },
  tot: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5 },
  grand: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 0.8, borderBottomWidth: 2, borderColor: "#111", paddingVertical: 5, marginTop: 3, fontWeight: 700 },
  ask: { marginTop: 26 },
  note: { marginTop: 10, fontSize: 7.2, color: MUTED },
  foot: { position: "absolute", left: 56, right: 56, bottom: 30, flexDirection: "row", borderTopWidth: 0.5, borderColor: RULE, paddingTop: 7, fontSize: 6.8, color: MUTED, lineHeight: 1.45 },
  footCol: { flex: 1, paddingRight: 8 },
});

const X = {
  ro: {
    title: "Factura",
    number: "Nr. factura",
    issued: "Data",
    due: "Scadenta",
    clientVat: "CIF client",
    ourVat: "CIF furnizor",
    intro: "Va facturam urmatoarele servicii:",
    pos: "Poz.",
    desc: "Descriere",
    qty: "Cant.",
    price: "Pret unitar",
    amount: "Valoare",
    net: "Total fara TVA",
    vat: "TVA",
    total: "Total de plata",
    ask: (amt: string, due: string | null, ref: string) =>
      `Va rugam sa achitati ${amt}${due ? ` pana la ${due}` : ""} in contul de mai jos, cu referinta ${ref}.`,
    reg: "Reg. com.",
    capital: "Capital social",
    bank: "Banca",
  },
  en: {
    title: "Invoice",
    number: "Invoice no.",
    issued: "Date",
    due: "Due date",
    clientVat: "Your VAT ID",
    ourVat: "Our VAT ID",
    intro: "We invoice the following services:",
    pos: "Pos.",
    desc: "Description",
    qty: "Qty",
    price: "Unit price",
    amount: "Amount",
    net: "Total excl. VAT",
    vat: "VAT",
    total: "Total due",
    ask: (amt: string, due: string | null, ref: string) =>
      `Please transfer ${amt}${due ? ` by ${due}` : ""} to the account below, quoting ${ref}.`,
    reg: "Reg. no.",
    capital: "Share capital",
    bank: "Bank",
  },
} as const;

export function InvoicePdfLetter({ issuer, invoice }: InvoicePdfProps) {
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
  const due = `${fmt(a.totalGross)} ${a.present}`;

  return (
    <Document title={`${C.title} ${invoice.series} ${invoice.number}`} author={issuer.name} creator={issuer.name} producer={issuer.name}>
      <Page size="A4" style={s.page}>
        <View style={s.head}>
          <T style={s.issuer}>{issuer.name}</T>
          <T style={{ color: MUTED }}>{issuer.address}</T>
        </View>

        <View style={s.window}>
          <View style={s.address}>
            {/* Randul expeditorului, cel mic de deasupra adresei din fereastra plicului. */}
            <T style={s.returnLine}>{issuer.name}</T>
            <T style={{ fontWeight: 700 }}>{invoice.clientCompany}</T>
            {invoice.clientAddress ? <T>{invoice.clientAddress}</T> : null}
            {place ? <T>{place}</T> : null}
          </View>
          <View style={s.infoBlock}>
            {[
              [C.number, number],
              [C.issued, invoice.issuedAt],
              ...(invoice.dueAt ? [[C.due, invoice.dueAt]] : []),
              ...(invoice.clientCui ? [[C.clientVat, invoice.clientCui]] : []),
              [C.ourVat, issuerVat],
            ].map(([k, v]) => (
              <View key={k} style={s.info}>
                <T style={{ color: MUTED }}>{k}</T>
                <T>{v}</T>
              </View>
            ))}
          </View>
        </View>

        <T style={s.subject}>
          {C.title} {number}
        </T>
        <T style={s.intro}>{C.intro}</T>

        <View style={s.thead}>
          <T style={s.cPos}>{C.pos}</T>
          <T style={s.cDesc}>{C.desc}</T>
          <T style={s.cQty}>{C.qty}</T>
          <T style={s.cPrice}>{C.price}</T>
          <T style={s.cAmount}>
            {C.amount} {a.present}
          </T>
        </View>
        {a.lines.map((l, i) => (
          <View key={i} style={s.tr} wrap={false}>
            <T style={s.cPos}>{i + 1}</T>
            <T style={s.cDesc}>{l.description}</T>
            <T style={s.cQty}>
              {fmtQty(l.quantity)} {l.unit}
            </T>
            <T style={s.cPrice}>{fmt(l.unitPrice)}</T>
            <T style={s.cAmount}>{fmt(l.net)}</T>
          </View>
        ))}

        <View style={s.totals} wrap={false}>
          <View style={s.tot}>
            <T>{C.net}</T>
            <T>{fmt(a.totalNet)}</T>
          </View>
          <View style={s.tot}>
            <T>
              {C.vat} ({vatLabel})
            </T>
            <T>{fmt(a.totalVat)}</T>
          </View>
          <View style={s.grand}>
            <T>{C.total}</T>
            <T>{due}</T>
          </View>
          {a.showEquivalent ? (
            <T style={{ textAlign: "right", fontSize: 7, color: MUTED, marginTop: 3 }}>
              {fmt(a.equivAmount)} {a.equivCur} · BNR {invoice.issuedAt.replace(/\//g, ".")}: 1 {a.foreignCur} = {fmtRate(a.rate)} RON
            </T>
          ) : null}
        </View>

        <T style={s.ask}>{C.ask(due, invoice.dueAt ?? null, number)}</T>
        {mention ? <T style={s.note}>{mention.ro}</T> : null}
        {mention ? <T style={[s.note, { marginTop: 3 }]}>{mention.en}</T> : null}
        {invoice.footerNote ? <T style={[s.note, { marginTop: 3 }]}>{invoice.footerNote}</T> : null}

        <View style={s.foot} fixed>
          <View style={s.footCol}>
            <T style={{ fontWeight: 700, color: "#111" }}>{issuer.name}</T>
            <T>{issuer.address}</T>
          </View>
          <View style={s.footCol}>
            <T>
              {C.reg} {issuer.reg}
            </T>
            <T>
              {C.ourVat} {issuerVat}
            </T>
            <T>
              {C.capital} {issuer.capital}
            </T>
          </View>
          <View style={[s.footCol, { flex: 1.3 }]}>
            <T>
              {C.bank} {issuer.bank}
            </T>
            <T>IBAN {groupIban(issuer.iban)}</T>
            {issuer.swift ? <T>SWIFT/BIC {issuer.swift}</T> : null}
          </View>
        </View>
        <View style={{ position: "absolute", left: 56, right: 56, bottom: 16 }} fixed>
          <T style={{ fontSize: 6.2, color: MUTED }}>{L.validWithoutSignature}</T>
        </View>
      </Page>
    </Document>
  );
}
