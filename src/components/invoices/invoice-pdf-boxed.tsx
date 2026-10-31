import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import { vatKindForInvoice } from "@/lib/vat";
import { roCountyName } from "@/lib/anaf/scope";
import { legalMentions } from "@/lib/legal-mentions";
import { invoiceLabels, invoiceLanguage } from "@/lib/invoice-labels";
import { INVOICE_FONT, noHyphens } from "@/lib/invoice-fonts";
import { fmtQty, invoiceAmounts } from "@/lib/invoice-amounts";
import type { InvoicePdfProps } from "@/components/invoices/invoice-pdf";

/*
 * Varianta "boxed": asezarea facturii SmartBill (casete, coloane numerotate
 * 0-6, rubrica de expeditie), in JetBrains Mono si fara subsolul publicitar
 * al SmartBill. Pentru clientii straini etichetele sunt bilingve, ca la
 * SmartBill: engleza, cu romana mica in paranteza.
 */

const B = "#000";
const s = StyleSheet.create({
  page: { padding: 28, fontFamily: INVOICE_FONT, fontSize: 7.6, lineHeight: 1.35, color: "#111" },
  head: { flexDirection: "row", borderWidth: 1, borderColor: B, padding: 7 },
  vendor: { width: "37%", paddingRight: 6 },
  center: { width: "29%", alignItems: "center", paddingHorizontal: 4 },
  customer: { width: "34%", paddingLeft: 6 },
  title: { fontSize: 11.5, fontWeight: 700, textAlign: "center", marginBottom: 5 },
  metaBox: { borderWidth: 0.8, borderColor: B, paddingVertical: 4, paddingHorizontal: 5, width: "100%" },
  meta: { textAlign: "center", marginBottom: 1.5 },
  ro: { fontSize: 5.8 },
  table: { marginTop: 10, borderWidth: 1, borderColor: B },
  tr: { flexDirection: "row" },
  cell: { borderRightWidth: 0.8, borderColor: B, paddingHorizontal: 3, paddingVertical: 3 },
  last: { paddingHorizontal: 3, paddingVertical: 3 },
  th: { fontWeight: 700, textAlign: "center" },
  cNo: { width: "7%", textAlign: "center" },
  cDesc: { width: "38%" },
  cUnit: { width: "7%", textAlign: "center" },
  cQty: { width: "9%", textAlign: "right" },
  cPrice: { width: "13%", textAlign: "right" },
  cValue: { width: "13%", textAlign: "right" },
  cVat: { width: "13%", textAlign: "right" },
  ruled: { borderBottomWidth: 0.8, borderColor: B },
  body: { height: 360 },
  band: { borderWidth: 1, borderTopWidth: 0, borderColor: B, paddingHorizontal: 4, paddingVertical: 3 },
  foot: { flexDirection: "row", borderWidth: 1, borderTopWidth: 0, borderColor: B },
  footLeft: { width: "59%", borderRightWidth: 0.8, borderColor: B, padding: 4 },
  footRight: { width: "41%" },
  totRow: { flexDirection: "row", borderBottomWidth: 0.8, borderColor: B },
  totLabel: { width: "28%", borderRightWidth: 0.8, borderColor: B, padding: 4 },
  totCell: { width: "36%", borderRightWidth: 0.8, borderColor: B, padding: 4, textAlign: "right" },
  totCellLast: { width: "36%", padding: 4, textAlign: "right" },
  totWide: { width: "72%", padding: 4, textAlign: "right" },
  small: { fontSize: 6.4 },
  after: { marginTop: 5 },
  valid: { marginTop: 3, fontSize: 6.6, color: "#666" },
});

function T({ style, children }: { style?: Style | Style[]; children?: React.ReactNode }) {
  return (
    <Text style={style} hyphenationCallback={noHyphens}>
      {children}
    </Text>
  );
}

export function InvoicePdfBoxed({ issuer, invoice }: InvoicePdfProps) {
  const L = invoiceLabels(invoice.clientCountry);
  const en = invoiceLanguage(invoice.clientCountry) === "en";
  /**
   * "Vendor (Furnizor)" pe facturile in engleza, doar "Furnizor" pe cele
   * romanesti. In capul de tabel si la totaluri romana trece pe randul de
   * dedesubt (`stack`), ca la SmartBill: in coloanele inguste, paranteza
   * rupta pe doua randuri primea o cratima de la react-pdf.
   */
  const lab = (enText: string, roText: string, stack = false) =>
    en ? (
      <>
        {enText}
        {stack ? "\n" : " "}
        <Text style={s.ro}>({roText})</Text>
      </>
    ) : (
      roText
    );
  const fmt = (n: number) => n.toLocaleString(L.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtRate = (n: number) => n.toLocaleString(L.locale, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  const kind = vatKindForInvoice(invoice.clientCountry, invoice.vatRate, issuer.vatRegistered ?? true);
  const a = invoiceAmounts(invoice);
  const cur = a.present === "RON" ? "Lei" : a.present;
  const other = a.present === "RON" ? a.foreignCur : "Lei";
  const inOther = (n: number) => (a.showEquivalent ? fmt(a.present === "RON" ? n / (a.rate || 1) : n * a.rate) : null);
  const vatPct = `${Math.round(invoice.vatRate * 100)}%`;
  const mention = legalMentions(kind, { issuerVatIntra: issuer.vatIntra });
  // Spatiu care nu se rupe: "CP 0035" ramane pe un rand.
  const number = `${invoice.series}\u00a0${invoice.number}`;

  return (
    <Document title={`${en ? "Invoice" : "Factura"} ${number}`} author={issuer.name} creator={issuer.name} producer={issuer.name}>
      <Page size="A4" style={s.page}>
        <View style={s.head}>
          <View style={s.vendor}>
            <T>{lab("Vendor", "Furnizor")}: {issuer.name}</T>
            <T>{lab("No. Registrar of Companies", "Reg. com.")}: {issuer.reg}</T>
            {kind === "eu_reverse" && issuer.vatIntra ? (
              <T>{lab("VAT CODE", "Cod TVA")}: {issuer.vatIntra}</T>
            ) : (
              <T>{lab("VAT CODE", "CIF")}: {issuer.cif}</T>
            )}
            <T>{lab("Address", "Adresa")}: {issuer.address}</T>
            <T>
              {lab("IBAN code", "IBAN")} ({invoice.clientCountry === "RO" ? "RON" : invoice.invoiceCurrency}): {issuer.iban}
            </T>
            <T>{lab("Bank", "Banca")}: {issuer.bank}</T>
            {issuer.swift ? <T>SWIFT: {issuer.swift}</T> : null}
            <T>{lab("Share capital", "Capital social")}: {issuer.capital}</T>
          </View>

          <View style={s.center}>
            <T style={s.title}>{en ? "INVOICE / FACTURA" : "FACTURA"}</T>
            <View style={s.metaBox}>
              <T style={s.meta}>{lab("Series and no.", "Seria si nr.")}: {number}</T>
              <T style={s.meta}>{lab("Date (day/month/year)", "Data (zi/luna/an)")}:</T>
              <T style={s.meta}>{invoice.issuedAt}</T>
              <T style={s.meta}>
                {lab("VAT(%)", "Cota TVA")}: {vatPct}
                {kind === "eu_reverse" ? <>{" "}{lab("Reverse charge", "Taxare inversa")}</> : null}
              </T>
            </View>
          </View>

          <View style={s.customer}>
            <T>{lab("Customer", "Client")}: {invoice.clientCompany}</T>
            {invoice.clientReg ? <T>{lab("No. Registrar of Companies", "Reg. com.")}: {invoice.clientReg}</T> : null}
            {invoice.clientCui ? <T>{lab("VAT CODE", "CIF")}: {invoice.clientCui}</T> : null}
            {invoice.clientAddress ? <T>{lab("Address", "Adresa")}: {invoice.clientAddress}</T> : null}
            {invoice.clientCountry && invoice.clientCountry !== "RO" ? (
              <T>
                {lab("Country", "Tara")}: {L.countryNames[invoice.clientCountry] ?? invoice.clientCountry}
              </T>
            ) : roCountyName(invoice.clientCounty) ? (
              <T>Judet: {roCountyName(invoice.clientCounty)}</T>
            ) : null}
          </View>
        </View>

        <View style={s.table}>
          <View style={[s.tr, s.ruled]}>
            <T style={[s.cell, s.th, s.cNo]}>{en ? "Nr. crt" : "Nr. crt"}</T>
            <T style={[s.cell, s.th, s.cDesc]}>{lab("Description of services", "Denumirea serviciilor", true)}</T>
            <T style={[s.cell, s.th, s.cUnit]}>{lab("Unit", "U.M.", true)}</T>
            <T style={[s.cell, s.th, s.cQty]}>{lab("Qty", "Cant.", true)}</T>
            <T style={[s.cell, s.th, s.cPrice]}>
              {lab("Unit price", "Pret unitar", true)}
              {"\n"}-{a.present}-
            </T>
            <T style={[s.cell, s.th, s.cValue]}>
              {lab("Value", "Valoarea", true)}
              {"\n"}-{a.present}-
            </T>
            <T style={[s.last, s.th, s.cVat]}>
              {lab("VAT", "Valoarea TVA", true)}
              {"\n"}-{a.present}-
            </T>
          </View>
          <View style={[s.tr, s.ruled]}>
            {["0", "1", "2", "3", "4", "5(3x4)"].map((n, i) => (
              <T key={n} style={[s.cell, { textAlign: "center" }, [s.cNo, s.cDesc, s.cUnit, s.cQty, s.cPrice, s.cValue][i]]}>
                {n}
              </T>
            ))}
            <T style={[s.last, s.cVat, { textAlign: "center" }]}>6</T>
          </View>
          <View style={[s.tr, s.body]}>
            {[s.cNo, s.cDesc, s.cUnit, s.cQty, s.cPrice, s.cValue].map((col, ci) => (
              <View key={ci} style={[s.cell, col, { paddingVertical: 6 }]}>
                {a.lines.map((l, i) => (
                  <T key={i} style={{ marginBottom: 6 }}>
                    {[String(i + 1), l.description, l.unit, fmtQty(l.quantity), fmt(l.unitPrice), fmt(l.net)][ci]}
                  </T>
                ))}
              </View>
            ))}
            <View style={[s.last, s.cVat, { paddingVertical: 6 }]}>
              {a.lines.map((l, i) => (
                <T key={i} style={{ marginBottom: 6 }}>
                  {fmt(l.vat)}
                </T>
              ))}
            </View>
          </View>
        </View>

        {a.showEquivalent ? (
          <View style={s.band}>
            <T>
              {lab("Exchange rate", "Curs")} 1 {a.foreignCur} = {fmtRate(a.rate)} Lei ({invoice.issuedAt})
            </T>
          </View>
        ) : null}
        {mention ? (
          <View style={s.band}>
            <T style={s.small}>{mention.ro}</T>
            <T style={s.small}>{mention.en}</T>
          </View>
        ) : null}
        {invoice.footerNote ? (
          <View style={s.band}>
            <T>{invoice.footerNote}</T>
          </View>
        ) : null}

        <View style={s.foot}>
          <View style={s.footLeft}>
            <T>{lab("Made by", "Intocmit de")}: {issuer.signer}</T>
            <T>{lab("Personal ID", "CNP")}: -</T>
            <T>{lab("Representative", "Numele delegatului")}: -</T>
            <T>{lab("ID card", "B.I./C.I.")}: -</T>
            <T>{lab("Transportation", "Mijloc transport")}: -</T>
            <T>
              {lab("Shipment made in our presence, on", "Expedierea s-a efectuat in prezenta noastra la data de")}{" "}
              ............ {lab("at", "ora")} ......
            </T>
            <T>{lab("Signatures", "Semnaturile")}:</T>
          </View>
          <View style={s.footRight}>
            <View style={s.totRow}>
              <T style={s.totLabel}>{lab("Total", "Total")}</T>
              <T style={s.totCell}>
                {fmt(a.totalNet)} {cur}
                {inOther(a.totalNet) ? `\n(${inOther(a.totalNet)}\u00a0${other})` : ""}
              </T>
              <T style={s.totCellLast}>
                {fmt(a.totalVat)} {cur}
                {inOther(a.totalVat) ? `\n(${inOther(a.totalVat)}\u00a0${other})` : ""}
              </T>
            </View>
            <View style={s.totRow}>
              <T style={[s.totLabel, { fontWeight: 700 }]}>{lab("Total value", "Total plata", true)}</T>
              <T style={[s.totWide, { fontWeight: 700 }]}>
                {fmt(a.totalGross)} {cur}
                {inOther(a.totalGross) ? `\n(${inOther(a.totalGross)}\u00a0${other})` : ""}
              </T>
            </View>
            <T style={{ padding: 4, minHeight: 38 }}>{lab("Signature", "Semnatura de primire")}:</T>
          </View>
        </View>

        {invoice.dueAt ? (
          <T style={s.after}>
            {lab("Payment term", "Termen plata")}: {invoice.dueAt}
          </T>
        ) : null}
        <T style={s.valid}>{L.validWithoutSignature}</T>
      </Page>
    </Document>
  );
}
