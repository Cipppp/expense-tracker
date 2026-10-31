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
 * Varianta "sheet": factura ca un formular tehnic, ca cartusul unui desen.
 * Fiecare camp sta in casuta lui, cu eticheta mica in colt si valoarea
 * dedesubt, iar casutele se aliniaza pe aceeasi grila de sus pana jos. Doar
 * ce cere legea si ce-i trebuie clientului ca sa plateasca; nimic de goods
 * (expeditie, delegat), TVA-ul o data, la totaluri.
 *
 * `ruled` decide daca grila se vede (chenare, ca la SmartBill) sau ramane
 * doar in aliniere, cu cateva linii orizontale.
 *
 * Fara chenare, sectiunile se despart prin aer, nu prin linii: spatiu mare
 * intre ele, o linie fina gri deasupra fiecareia, iar mentiunile legale jos,
 * ca nota de subsol.
 */

const INK = "#000000";
const LABEL = "#555555";
const PAD = 7;
const HAIR = "#d6d6d6";

const base = StyleSheet.create({
  page: { paddingTop: 36, paddingHorizontal: 36, paddingBottom: 40, fontFamily: INVOICE_FONT, fontSize: 7.8, lineHeight: 1.42, color: INK },
  pageOpen: { paddingTop: 54, paddingHorizontal: 50, paddingBottom: 130, fontSize: 8, lineHeight: 1.5 },
  footOpen: { position: "absolute", left: 50, right: 50, bottom: 40, borderTopWidth: 0.5, borderColor: HAIR, paddingTop: 10 },
  row: { flexDirection: "row" },
  label: { fontSize: 5.8, color: LABEL, letterSpacing: 0.9, textTransform: "uppercase", marginBottom: 4 },
  issuer: { fontSize: 13, fontWeight: 700, letterSpacing: -0.2 },
  issuerSub: { marginTop: 3, color: LABEL },
  number: { fontSize: 20, fontWeight: 700, letterSpacing: -0.4, lineHeight: 1.1 },
  value: { fontSize: 8.6, fontWeight: 500 },
  name: { fontSize: 8.6, fontWeight: 700, marginBottom: 3 },
  kv: { flexDirection: "row" },
  kvKey: { width: 66, color: LABEL },
  th: { fontSize: 5.8, color: LABEL, letterSpacing: 0.9, textTransform: "uppercase" },
  right: { textAlign: "right" },
  totLine: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  grand: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 6 },
  grandLabel: { fontSize: 8.6, fontWeight: 700, lineHeight: 1 },
  grandValue: { fontSize: 14, fontWeight: 700, letterSpacing: -0.3, lineHeight: 1 },
  equiv: { marginTop: 6, fontSize: 6.4, color: LABEL, textAlign: "right" },
  note: { fontSize: 6.4, color: "#333333", marginBottom: 3 },
  valid: { marginTop: 8, fontSize: 6.2, color: LABEL },
});

const SHEET_LABELS = {
  ro: {
    title: "Factura",
    issued: "Data emiterii",
    due: "Scadenta",
    currency: "Moneda",
    vat: "TVA",
    supplier: "Furnizor",
    client: "Client",
    desc: "Descriere",
    qty: "Cant.",
    price: "Pret unitar",
    amount: "Valoare",
    payment: "Plata",
    reference: "Referinta",
    subtotal: "Subtotal",
    totalDue: "Total de plata",
    notes: "Mentiuni",
    vatId: "CIF",
    reg: "Reg. com.",
    capital: "Capital",
    county: "Judet",
  },
  en: {
    title: "Invoice",
    issued: "Issue date",
    due: "Due date",
    currency: "Currency",
    vat: "VAT",
    supplier: "Supplier",
    client: "Client",
    desc: "Description",
    qty: "Qty",
    price: "Unit price",
    amount: "Amount",
    payment: "Payment",
    reference: "Reference",
    subtotal: "Subtotal",
    totalDue: "Total due",
    notes: "Notes",
    vatId: "VAT ID",
    reg: "Reg. no.",
    capital: "Capital",
    county: "County",
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
    <View style={base.kv}>
      <T style={base.kvKey}>{k}</T>
      <T style={{ flex: 1 }}>{v}</T>
    </View>
  );
}

export function InvoicePdfSheet({ issuer, invoice, ruled }: InvoicePdfProps & { ruled: boolean }) {
  const lang = invoiceLanguage(invoice.clientCountry);
  const L = invoiceLabels(invoice.clientCountry);
  const S = SHEET_LABELS[lang];
  const fmt = (n: number) => n.toLocaleString(L.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtRate = (n: number) => n.toLocaleString(L.locale, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  const kind = vatKindForInvoice(invoice.clientCountry, invoice.vatRate, issuer.vatRegistered ?? true);
  const a = invoiceAmounts(invoice);
  const number = `${invoice.series} ${invoice.number}`;
  const vatLabel = L.vatKind[kind] || `${Math.round(invoice.vatRate * 100)}%`;
  const mention = legalMentions(kind, { issuerVatIntra: issuer.vatIntra });
  const issuerVat = kind === "eu_reverse" && issuer.vatIntra ? issuer.vatIntra : issuer.cif;

  // Tara se scrie doar daca adresa n-o contine deja.
  const code = invoice.clientCountry ?? "";
  const names = [L.countryNames[code], INVOICE_LABELS.en.countryNames[code]].filter(Boolean) as string[];
  const addr = (invoice.clientAddress ?? "").toLowerCase();
  const country = code && code !== "RO" && !names.some((c) => addr.includes(c.toLowerCase())) ? names[0] ?? code : null;
  const county = code === "RO" ? roCountyName(invoice.clientCounty) : null;

  // Grila: cu chenare, fiecare casuta are bordura stanga/sus, iar tabelul
  // inchide dreapta si jos. Fara chenare raman doar liniile orizontale dintre
  // randurile mari.
  const W = ruled ? 0.6 : 0;
  const frame: Style = ruled ? { borderRightWidth: 1, borderBottomWidth: 1, borderColor: INK } : {};
  const cell = (extra: Style = {}): Style => ({
    padding: PAD,
    ...(ruled ? { borderLeftWidth: W, borderTopWidth: W, borderColor: INK } : {}),
    ...extra,
  });
  const band = (extra: Style = {}): Style =>
    ruled ? extra : { borderTopWidth: 0.5, borderColor: HAIR, marginTop: 30, paddingTop: 8, ...extra };

  const notes = (
    <>
      {mention ? <T style={base.note}>{mention.ro}</T> : null}
      {mention ? <T style={base.note}>{mention.en}</T> : null}
      {invoice.footerNote ? <T style={base.note}>{invoice.footerNote}</T> : null}
    </>
  );

  return (
    <Document title={`${S.title} ${invoice.series} ${invoice.number}`} author={issuer.name} creator={issuer.name} producer={issuer.name}>
      <Page size="A4" style={ruled ? base.page : [base.page, base.pageOpen]}>
        <View style={ruled ? [frame, { borderLeftWidth: 0.4, borderTopWidth: 0.4, borderColor: INK }] : {}}>
          {/* Antet: cine emite si ce numar are factura. */}
          <View style={[base.row, ruled ? {} : { borderBottomWidth: 1.2, borderColor: INK, paddingBottom: 14 }]}>
            <View style={cell({ width: "75%", paddingVertical: 12 })}>
              <T style={base.issuer}>{issuer.name}</T>
              <T style={base.issuerSub}>{issuer.address}</T>
            </View>
            <View style={cell({ width: "25%", paddingVertical: 12 })}>
              <T style={base.label}>{S.title}</T>
              <T style={base.number}>{number}</T>
            </View>
          </View>

          <View style={[base.row, ruled ? {} : { marginTop: 14 }]}>
            {[
              [S.issued, invoice.issuedAt],
              [S.due, invoice.dueAt ?? "-"],
              [S.currency, a.present],
              [S.vat, vatLabel],
            ].map(([k, v]) => (
              <View key={k} style={cell({ width: "25%" })}>
                <T style={base.label}>{k}</T>
                <T style={base.value}>{v}</T>
              </View>
            ))}
          </View>

          <View style={[base.row, band()]}>
            <View style={cell({ width: "50%" })}>
              <T style={base.label}>{S.supplier}</T>
              <T style={base.name}>{issuer.name}</T>
              <KV k={S.vatId} v={issuerVat} />
              <KV k={S.reg} v={issuer.reg} />
              <KV k={S.capital} v={issuer.capital} />
            </View>
            <View style={cell({ width: "50%" })}>
              <T style={base.label}>{S.client}</T>
              <T style={base.name}>{invoice.clientCompany}</T>
              {invoice.clientCui ? <KV k={S.vatId} v={invoice.clientCui} /> : null}
              {invoice.clientReg ? <KV k={S.reg} v={invoice.clientReg} /> : null}
              {invoice.clientAddress ? <T style={{ marginTop: 2 }}>{invoice.clientAddress}</T> : null}
              {country ? <T>{country}</T> : null}
              {county ? <T>{S.county} {county}</T> : null}
            </View>
          </View>

          {/* Liniile facturii. */}
          <View style={[base.row, band()]}>
            <T style={[base.th, cell({ width: "6%" })]}>#</T>
            <T style={[base.th, cell({ width: "52%" })]}>{S.desc}</T>
            <T style={[base.th, base.right, cell({ width: "11%" })]}>{S.qty}</T>
            <T style={[base.th, base.right, cell({ width: "14%" })]}>{S.price}</T>
            <T style={[base.th, base.right, cell({ width: "17%" })]}>
              {S.amount} {a.present}
            </T>
          </View>
          {a.lines.map((l, i) => (
            <View key={i} style={[base.row, ruled ? {} : { borderTopWidth: 0.5, borderColor: HAIR }]} wrap={false}>
              <T style={[cell({ width: "6%", paddingVertical: ruled ? 9 : 12 })]}>{i + 1}</T>
              <T style={[cell({ width: "52%", paddingVertical: ruled ? 9 : 12 })]}>{l.description}</T>
              <T style={[base.right, cell({ width: "11%", paddingVertical: ruled ? 9 : 12 })]}>
                {fmtQty(l.quantity)} {l.unit}
              </T>
              <T style={[base.right, cell({ width: "14%", paddingVertical: ruled ? 9 : 12 })]}>{fmt(l.unitPrice)}</T>
              <T style={[base.right, cell({ width: "17%", paddingVertical: ruled ? 9 : 12 })]}>{fmt(l.net)}</T>
            </View>
          ))}

          {/* Plata si totalurile, pe acelasi rand. */}
          <View style={[base.row, band()]} wrap={false}>
            <View style={cell({ width: "58%" })}>
              <T style={base.label}>{S.payment}</T>
              <KV k="IBAN" v={groupIban(issuer.iban)} />
              {issuer.swift ? <KV k="SWIFT/BIC" v={issuer.swift} /> : null}
              <KV k={L.bank} v={issuer.bank} />
              <KV k={S.reference} v={number} />
            </View>
            <View style={cell({ width: "42%" })}>
              <View style={base.totLine}>
                <T style={{ color: LABEL }}>{S.subtotal}</T>
                <T>{fmt(a.totalNet)}</T>
              </View>
              <View style={base.totLine}>
                <T style={{ color: LABEL }}>
                  {S.vat} {vatLabel}
                </T>
                <T>{fmt(a.totalVat)}</T>
              </View>
              <View style={base.grand}>
                <T style={base.grandLabel}>{S.totalDue}</T>
                <T style={base.grandValue}>
                  {fmt(a.totalGross)} {a.present}
                </T>
              </View>
              {a.showEquivalent ? (
                <T style={base.equiv}>
                  = {fmt(a.equivAmount)} {a.equivCur}, BNR {invoice.issuedAt.replace(/\//g, ".")}: 1 {a.foreignCur} = {fmtRate(a.rate)} RON
                </T>
              ) : null}
            </View>
          </View>

          {ruled && (mention || invoice.footerNote) ? (
            <View style={base.row} wrap={false}>
              <View style={cell({ width: "100%" })}>
                <T style={base.label}>{S.notes}</T>
                {notes}
              </View>
            </View>
          ) : null}
        </View>

        {ruled ? (
          <T style={base.valid}>{L.validWithoutSignature}</T>
        ) : (
          <View style={base.footOpen} fixed>
            {notes}
            <T style={[base.note, { color: LABEL, marginBottom: 0 }]}>{L.validWithoutSignature}</T>
          </View>
        )}
      </Page>
    </Document>
  );
}
