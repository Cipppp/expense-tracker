import path from "node:path";
import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import { vatKindForInvoice } from "@/lib/vat";
import { roCountyName } from "@/lib/anaf/scope";
import { legalMentions } from "@/lib/legal-mentions";
import { invoiceLabels, invoiceLanguage } from "@/lib/invoice-labels";
import type { InvoicePdfProps } from "@/components/invoices/invoice-pdf";

/*
 * Template-ul facturilor emise din 1 noiembrie 2026 (lib/invoice-template).
 *
 * Totul in JetBrains Mono: pe o factura aproape tot e cifre, coduri si
 * identificatori, iar un font monospace le aliniaza pe coloane fara efort.
 * Varianta NL, fara ligaturi, ca "->" sau "!=" dintr-o descriere sa ramana
 * caractere separate. Fontul are si diacriticele romanesti, pe care
 * Helvetica din template-ul vechi nu le avea.
 *
 * Calculul sumelor e copiat din invoice-pdf.tsx, nu mutat de acolo: facturile
 * vechi se randeaza in continuare cu codul lor, neatins.
 */

const FONT = "JetBrains Mono";
const fontFile = (weight: string) =>
  path.join(process.cwd(), "src/assets/fonts/jetbrains-mono", `JetBrainsMonoNL-${weight}.ttf`);
Font.register({
  family: FONT,
  fonts: [
    { src: fontFile("Regular"), fontWeight: 400 },
    { src: fontFile("Medium"), fontWeight: 500 },
    { src: fontFile("Bold"), fontWeight: 700 },
  ],
});

const INK = "#141414";
const MUTED = "#6b6b6b";
const RULE = "#d4d4d4";

const s = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingHorizontal: 44,
    paddingBottom: 64,
    fontFamily: FONT,
    fontSize: 7.8,
    lineHeight: 1.45,
    color: INK,
  },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  brand: { fontSize: 12, fontWeight: 700, letterSpacing: -0.2 },
  docTitle: { fontSize: 12, fontWeight: 700, textAlign: "right" },
  heavyRule: { borderBottomWidth: 1.2, borderColor: INK, marginTop: 10 },
  rule: { borderBottomWidth: 0.5, borderColor: RULE },
  label: { fontSize: 6.2, color: MUTED, letterSpacing: 0.7, textTransform: "uppercase" },
  meta: { flexDirection: "row", paddingVertical: 9 },
  metaCell: { flex: 1 },
  metaValue: { fontSize: 8.6, fontWeight: 500, marginTop: 2 },
  parties: { flexDirection: "row", marginTop: 22 },
  party: { flex: 1, paddingRight: 18 },
  partyName: { fontSize: 9, fontWeight: 700, marginTop: 5, marginBottom: 4 },
  kv: { flexDirection: "row", marginBottom: 1.5 },
  kvKey: { color: MUTED },
  due: { marginTop: 26, marginBottom: 18, lineHeight: 1.2 },
  dueAmount: { fontSize: 20, fontWeight: 700, letterSpacing: -0.5 },
  dueWhen: { fontSize: 9, fontWeight: 400, letterSpacing: 0, color: MUTED },
  tr: { flexDirection: "row", paddingVertical: 5 },
  th: { borderBottomWidth: 0.9, borderColor: INK, paddingBottom: 4 },
  cNo: { width: "5%" },
  cDesc: { width: "42%", paddingRight: 10 },
  cQty: { width: "8%", textAlign: "right" },
  cUnit: { width: "7%", textAlign: "center" },
  cPrice: { width: "12%", textAlign: "right" },
  cAmount: { width: "15%", textAlign: "right" },
  cVat: { width: "11%", textAlign: "right" },
  totals: { marginLeft: "auto", width: "46%", marginTop: 10 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5 },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.9,
    borderColor: INK,
    marginTop: 4,
    paddingTop: 6,
  },
  grand: { fontSize: 10, fontWeight: 700 },
  section: { marginTop: 26 },
  sectionBody: { marginTop: 6 },
  note: { fontSize: 7, color: "#333333", marginBottom: 5 },
  footer: { position: "absolute", left: 44, right: 44, bottom: 26 },
  footerRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  footText: { fontSize: 6.4, color: MUTED },
});

/*
 * Textele noi ale template-ului. Restul (registru, CIF, adresa, coloanele,
 * mentiunea de echivalent) vin din lib/invoice-labels, ca factura sa
 * vorbeasca la fel ca previzualizarea si Oblio.
 */
const MONO_LABELS = {
  ro: {
    title: "Factura",
    currency: "Moneda",
    issued: "Data emiterii",
    due: "Termen de plata",
    vat: "TVA",
    from: "Furnizor",
    billTo: "Client",
    dueOn: (d: string) => `scadenta ${d}`,
    subtotal: "Subtotal",
    totalDue: "Total de plata",
    payment: "Plata prin transfer bancar",
    reference: "Referinta",
    notes: "Mentiuni",
  },
  en: {
    title: "Invoice",
    currency: "Currency",
    issued: "Issue date",
    due: "Due date",
    vat: "VAT",
    from: "From",
    billTo: "Bill to",
    dueOn: (d: string) => `due ${d}`,
    subtotal: "Subtotal",
    totalDue: "Total due",
    payment: "Pay by bank transfer",
    reference: "Reference",
    notes: "Notes",
  },
} as const;

/** Fara despartire in silabe: un cod, un IBAN sau un nume nu se rup cu cratima. */
const noHyphens = (word: string) => [word];

function T({ style, children }: { style?: Style | Style[]; children?: React.ReactNode }) {
  return (
    <Text style={style} hyphenationCallback={noHyphens}>
      {children}
    </Text>
  );
}

function KV({ k, v, width }: { k: string; v: string; width: number }) {
  return (
    <View style={s.kv}>
      <T style={[s.kvKey, { width }]}>{k}</T>
      <T style={{ flex: 1 }}>{v}</T>
    </View>
  );
}

/** RO53INGB0000... in grupe de cate patru, cum se citeste si se dicteaza. */
function groupIban(iban: string): string {
  return iban.replace(/\s+/g, "").replace(/(.{4})(?=.)/g, "$1 ");
}

export function InvoicePdfMono({ issuer, invoice }: InvoicePdfProps) {
  const L = invoiceLabels(invoice.clientCountry);
  const M = MONO_LABELS[invoiceLanguage(invoice.clientCountry)];
  const rate = invoice.bnrRate ?? 1;
  const fmtAmount = (n: number) =>
    n.toLocaleString(L.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtRate = (n: number) =>
    n.toLocaleString(L.locale, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  const kind = vatKindForInvoice(invoice.clientCountry, invoice.vatRate, issuer.vatRegistered ?? true);

  // Aceeasi regula ca in template-ul vechi: clientii romani vad lei, ceilalti
  // moneda contractului, cu echivalentul in cealalta moneda la cursul BNR.
  const present = invoice.clientCountry === "RO" ? "RON" : invoice.invoiceCurrency;
  const factor = present === invoice.invoiceCurrency ? 1 : rate;
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const lines = invoice.lines.map((l) => {
    const net = round2(l.amount * factor);
    return { ...l, unitPrice: round2(l.unitPrice * factor), net, vat: round2(net * invoice.vatRate) };
  });
  const totalNet = round2(lines.reduce((a, l) => a + l.net, 0));
  const totalVat = round2(lines.reduce((a, l) => a + l.vat, 0));
  const totalGross = round2(totalNet + totalVat);

  const showEquivalent = !(present === "RON" && invoice.invoiceCurrency === "RON");
  const foreignCur = present === "RON" ? invoice.invoiceCurrency : present;
  const equivAmount = present === "RON" ? totalGross / (rate || 1) : totalGross * rate;
  const equivCur = present === "RON" ? foreignCur : "RON";

  const number = `${invoice.series} ${invoice.number}`;
  const vatLabel = L.vatKind[kind] || `${Math.round(invoice.vatRate * 100)}%`;
  const mention = legalMentions(kind, { issuerVatIntra: issuer.vatIntra });
  const countryLine =
    invoice.clientCountry && invoice.clientCountry !== "RO"
      ? { k: L.country, v: L.countryNames[invoice.clientCountry] ?? invoice.clientCountry }
      : invoice.clientCountry === "RO" && roCountyName(invoice.clientCounty)
        ? { k: L.county, v: roCountyName(invoice.clientCounty)! }
        : null;
  const KEY = 92;

  return (
    <Document title={`${M.title} ${number}`} author={issuer.name} creator={issuer.name} producer={issuer.name}>
      <Page size="A4" style={s.page}>
        <View style={s.head}>
          <T style={s.brand}>{issuer.name}</T>
          <T style={s.docTitle}>
            {M.title} {number}
          </T>
        </View>
        <View style={s.heavyRule} />

        <View style={s.meta}>
          {[
            [M.issued, invoice.issuedAt],
            [M.due, invoice.dueAt ?? "-"],
            [M.currency, present],
            [M.vat, vatLabel],
          ].map(([k, v]) => (
            <View key={k} style={s.metaCell}>
              <T style={s.label}>{k}</T>
              <T style={s.metaValue}>{v}</T>
            </View>
          ))}
        </View>
        <View style={s.rule} />

        <View style={s.parties}>
          <View style={s.party}>
            <T style={s.label}>{M.from}</T>
            <T style={s.partyName}>{issuer.name}</T>
            <KV width={KEY} k={L.regCom} v={issuer.reg} />
            {/* Catre UE, codul special de TVA (art. 317) e cel valabil in VIES. */}
            {kind === "eu_reverse" && issuer.vatIntra ? (
              <KV width={KEY} k={L.euVatId} v={issuer.vatIntra} />
            ) : (
              <KV width={KEY} k={L.taxId} v={issuer.cif} />
            )}
            <KV width={KEY} k={L.address} v={issuer.address} />
            <KV width={KEY} k={L.capital} v={issuer.capital} />
          </View>
          <View style={s.party}>
            <T style={s.label}>{M.billTo}</T>
            <T style={s.partyName}>{invoice.clientCompany}</T>
            {invoice.clientReg ? <KV width={KEY} k={L.regCom} v={invoice.clientReg} /> : null}
            {invoice.clientCui ? <KV width={KEY} k={L.taxId} v={invoice.clientCui} /> : null}
            {invoice.clientAddress ? <KV width={KEY} k={L.address} v={invoice.clientAddress} /> : null}
            {countryLine ? <KV width={KEY} k={countryLine.k} v={countryLine.v} /> : null}
          </View>
        </View>

        <Text style={s.due} hyphenationCallback={noHyphens}>
          <Text style={s.dueAmount}>
            {fmtAmount(totalGross)} {present}
          </Text>
          {invoice.dueAt ? <Text style={s.dueWhen}>{"   "}{M.dueOn(invoice.dueAt)}</Text> : null}
        </Text>

        <View style={[s.tr, s.th]}>
          <T style={[s.label, s.cNo]}>#</T>
          <T style={[s.label, s.cDesc]}>{L.colDescShort}</T>
          <T style={[s.label, s.cQty]}>{L.colQty}</T>
          <T style={[s.label, s.cUnit]}>{L.colUnit}</T>
          <T style={[s.label, s.cPrice]}>{L.colUnitPriceShort}</T>
          <T style={[s.label, s.cAmount]}>
            {L.colAmount} {present}
          </T>
          <T style={[s.label, s.cVat]}>{M.vat}</T>
        </View>
        {lines.map((l, i) => (
          <View key={i} style={[s.tr, s.rule]} wrap={false}>
            <T style={[s.cNo, { color: MUTED }]}>{String(i + 1).padStart(2, "0")}</T>
            <T style={s.cDesc}>{l.description}</T>
            <T style={s.cQty}>{fmtNum(l.quantity)}</T>
            <T style={s.cUnit}>{l.unit}</T>
            <T style={s.cPrice}>{fmtAmount(l.unitPrice)}</T>
            <T style={s.cAmount}>{fmtAmount(l.net)}</T>
            <T style={s.cVat}>{fmtAmount(l.vat)}</T>
          </View>
        ))}

        <View style={s.totals} wrap={false}>
          <View style={s.totalRow}>
            <T style={{ color: MUTED }}>{M.subtotal}</T>
            <T>{fmtAmount(totalNet)}</T>
          </View>
          <View style={s.totalRow}>
            <T style={{ color: MUTED }}>
              {M.vat} {vatLabel}
            </T>
            <T>{fmtAmount(totalVat)}</T>
          </View>
          <View style={s.grandRow}>
            <T style={s.grand}>{M.totalDue}</T>
            <T style={s.grand}>
              {fmtAmount(totalGross)} {present}
            </T>
          </View>
        </View>

        <View style={s.section} wrap={false}>
          <T style={s.label}>{M.payment}</T>
          <View style={s.sectionBody}>
            <KV width={KEY} k={L.iban} v={groupIban(issuer.iban)} />
            {issuer.swift ? <KV width={KEY} k={L.swift} v={issuer.swift} /> : null}
            <KV width={KEY} k={L.bank} v={issuer.bank} />
            <KV width={KEY} k={M.reference} v={number} />
          </View>
        </View>

        {showEquivalent || mention || invoice.footerNote ? (
          <View style={s.section} wrap={false}>
            <T style={s.label}>{M.notes}</T>
            <View style={s.sectionBody}>
              {showEquivalent ? (
                <T style={s.note}>
                  {L.equivalent(fmtAmount(equivAmount), equivCur, invoice.issuedAt.replace(/\//g, "."), foreignCur, fmtRate(rate))}
                </T>
              ) : null}
              {/* Mentiunea de TVA ramane in ambele limbi, ca in Oblio si in XML. */}
              {mention ? <T style={s.note}>{mention.ro}</T> : null}
              {mention ? <T style={s.note}>{mention.en}</T> : null}
              {invoice.footerNote ? <T style={s.note}>{invoice.footerNote}</T> : null}
            </View>
          </View>
        ) : null}

        {/* Subsolul se repeta pe fiecare pagina. Fara numar de pagina: in
            react-pdf 4 un Text cu `render` nu se mai deseneaza deloc cand
            pagina foloseste un font inregistrat, iar factura are o pagina. */}
        <View style={s.footer} fixed>
          <View style={s.rule} />
          <View style={s.footerRow}>
            <T style={s.footText}>
              {L.preparedBy}: {issuer.signer}
            </T>
            <T style={s.footText}>{number}</T>
          </View>
          <T style={[s.footText, { marginTop: 2 }]}>{L.validWithoutSignature}</T>
        </View>
      </Page>
    </Document>
  );
}

function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
