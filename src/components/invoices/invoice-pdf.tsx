/* eslint-disable jsx-a11y/alt-text */
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import { vatKindForInvoice } from "@/lib/vat";

const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#111",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  block: { width: "33%" },
  blockTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  blockLine: { fontSize: 8, marginBottom: 1.5 },
  title: { fontSize: 22, fontFamily: "Helvetica-Bold", textAlign: "center", marginBottom: 4 },
  metaBox: {
    borderWidth: 1,
    borderColor: "#000",
    paddingVertical: 4,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  meta: { fontSize: 8, textAlign: "center", marginBottom: 1 },
  table: {
    marginTop: 8,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#000",
  },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#000" },
  th: {
    padding: 4,
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    borderRightWidth: 1,
    borderColor: "#000",
    textAlign: "center",
  },
  thLast: { padding: 4, fontSize: 7.5, fontFamily: "Helvetica-Bold", textAlign: "center" },
  td: { padding: 4, fontSize: 8, borderRightWidth: 1, borderColor: "#000" },
  tdLast: { padding: 4, fontSize: 8 },
  colNr: { width: "6%", textAlign: "center" },
  colDesc: { width: "40%" },
  colUm: { width: "7%", textAlign: "center" },
  colQty: { width: "8%", textAlign: "right" },
  colPrice: { width: "13%", textAlign: "right" },
  colAmount: { width: "13%", textAlign: "right" },
  colVat: { width: "13%", textAlign: "right" },
  spacerRow: { height: 230, flexDirection: "row", borderBottomWidth: 1, borderColor: "#000" },
  note: {
    marginTop: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#000",
    fontSize: 8,
  },
  footerBox: { marginTop: 6, borderWidth: 1, borderColor: "#000" },
  footerRow: { flexDirection: "row" },
  smallFoot: { marginTop: 12, fontSize: 7, textAlign: "center", color: "#666" },
});

export type InvoicePdfProps = {
  issuer: {
    name: string;
    cif: string;
    /** Codul special de TVA art. 317, folosit doar pe facturile catre UE. */
    vatIntra?: string;
    /** false = scutit art. 310; schimba si cota afisata, si mentiunea. */
    vatRegistered?: boolean;
    reg: string;
    address: string;
    iban: string;
    swift?: string;
    bank: string;
    capital: string;
    signer: string;
  };
  invoice: {
    series: string;
    number: string;
    issuedAt: string; // dd/mm/yyyy
    dueAt?: string | null; // dd/mm/yyyy
    clientName: string;
    clientCompany: string;
    clientCui?: string | null;
    clientReg?: string | null;
    clientAddress?: string | null;
    clientCountry?: string | null;
    invoiceCurrency: string; // "RON" | "USD" | "EUR"
    legalCurrency: string; // always "RON"
    bnrRate?: number | null;
    vatRate: number; // 0.21 or 0
    footerNote?: string | null;
    lines: Array<{
      description: string;
      unit: string;
      quantity: number;
      unitPrice: number; // in invoiceCurrency
      amount: number; // in invoiceCurrency
    }>;
  };
};

export function InvoicePdf({ issuer, invoice }: InvoicePdfProps) {
  const rate = invoice.bnrRate ?? 1;
  const kind = vatKindForInvoice(
    invoice.clientCountry,
    invoice.vatRate,
    issuer.vatRegistered ?? true,
  );

  // Presentation currency: Romanian clients are always invoiced in RON (legal
  // requirement); everyone else is invoiced in the contract currency. So an
  // EU client paying in EUR sees EUR amounts (with a RON equivalent), while a
  // RO client whose contract is in USD/EUR sees RON amounts (with the foreign
  // equivalent) — exactly like the SmartBill invoices.
  const present = invoice.clientCountry === "RO" ? "RON" : invoice.invoiceCurrency;
  const presLabel = present === "RON" ? "Lei" : present;
  // Factor from the line currency (invoiceCurrency) into the presentation
  // currency: 1 if they match, the BNR rate when converting a foreign contract
  // into RON.
  const factor = present === invoice.invoiceCurrency ? 1 : rate;

  // Round each line to 2dp and sum the rounded values, so the printed VAT
  // column always reconciles with the "Total" cell (round-then-sum).
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const presLines = invoice.lines.map((l) => {
    const net = round2(l.amount * factor);
    return {
      ...l,
      presUnitPrice: round2(l.unitPrice * factor),
      presNet: net,
      presVat: round2(net * invoice.vatRate),
    };
  });
  const totalNet = round2(presLines.reduce((a, l) => a + l.presNet, 0));
  const totalVat = round2(presLines.reduce((a, l) => a + l.presVat, 0));
  const totalGross = round2(totalNet + totalVat);

  // Equivalent line — shown whenever any non-RON currency is involved. The
  // non-RON currency is always the contract currency; we print the "other"
  // currency's total + the BNR rate, matching SmartBill's wording.
  const showEquivalent = !(present === "RON" && invoice.invoiceCurrency === "RON");
  const foreignCur = present === "RON" ? invoice.invoiceCurrency : present;
  const equivAmount =
    present === "RON" ? totalGross / (rate || 1) : totalGross * rate; // RON-present → foreign; foreign-present → RON
  const equivCur = present === "RON" ? foreignCur : "RON";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Furnizor: {issuer.name}</Text>
            <Text style={styles.blockLine}>Reg. com.: {issuer.reg}</Text>
            {/* Pe facturile catre UE se trece codul special de TVA (art. 317),
                nu CIF-ul firmei — el e cel valabil in VIES pentru taxare
                inversa. Pe rest ramane CIF-ul obisnuit. */}
            {kind === "eu_reverse" && issuer.vatIntra ? (
              <Text style={styles.blockLine}>
                Cod TVA intracomunitar: {issuer.vatIntra}
              </Text>
            ) : (
              <Text style={styles.blockLine}>CIF: {issuer.cif}</Text>
            )}
            <Text style={styles.blockLine}>Adresa: {issuer.address}</Text>
            <Text style={styles.blockLine}>IBAN: {issuer.iban}</Text>
            {issuer.swift ? (
              <Text style={styles.blockLine}>SWIFT/BIC: {issuer.swift}</Text>
            ) : null}
            <Text style={styles.blockLine}>Banca: {issuer.bank}</Text>
            <Text style={styles.blockLine}>Capital social: {issuer.capital}</Text>
          </View>
          <View style={[styles.block, { alignItems: "center" }]}>
            <Text style={styles.title}>FACTURA</Text>
            <View style={styles.metaBox}>
              <Text style={styles.meta}>
                Seria {invoice.series} nr. {invoice.number}
              </Text>
              <Text style={styles.meta}>Data (zi/luna/an): {invoice.issuedAt}</Text>
              <Text style={styles.meta}>
                Cota TVA:{" "}
                {kind === "eu_reverse"
                  ? "taxare inversa"
                  : kind === "export"
                    ? "neimpozabil"
                    : kind === "exempt_310"
                      ? "scutit art. 310"
                      : `${Math.round(invoice.vatRate * 100)}%`}
              </Text>
            </View>
          </View>
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Client: {invoice.clientCompany}</Text>
            {invoice.clientReg ? (
              <Text style={styles.blockLine}>Reg. com.: {invoice.clientReg}</Text>
            ) : null}
            {invoice.clientCui ? (
              <Text style={styles.blockLine}>CIF: {invoice.clientCui}</Text>
            ) : null}
            {invoice.clientAddress ? (
              <Text style={styles.blockLine}>Adresa: {invoice.clientAddress}</Text>
            ) : null}
            {invoice.clientCountry && invoice.clientCountry !== "RO" ? (
              <Text style={styles.blockLine}>Tara: {countryName(invoice.clientCountry)}</Text>
            ) : invoice.clientCountry === "RO" ? (
              <Text style={styles.blockLine}>Judet: Bucuresti</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={[styles.th, styles.colNr]}>Nr. crt</Text>
            <Text style={[styles.th, styles.colDesc]}>
              Denumirea produselor sau a serviciilor
            </Text>
            <Text style={[styles.th, styles.colUm]}>U.M.</Text>
            <Text style={[styles.th, styles.colQty]}>Cant.</Text>
            <Text style={[styles.th, styles.colPrice]}>
              Pret unitar{"\n"}(fara TVA){"\n"}-{presLabel}-
            </Text>
            <Text style={[styles.th, styles.colAmount]}>
              Valoarea{"\n"}-{presLabel}-
            </Text>
            <Text style={[styles.thLast, styles.colVat]}>
              Valoarea TVA{"\n"}-{presLabel}-
            </Text>
          </View>
          <View style={[styles.tr, { backgroundColor: "#f7f7f7" }]}>
            <Text style={[styles.td, styles.colNr]}>0</Text>
            <Text style={[styles.td, styles.colDesc]}>1</Text>
            <Text style={[styles.td, styles.colUm]}>2</Text>
            <Text style={[styles.td, styles.colQty]}>3</Text>
            <Text style={[styles.td, styles.colPrice]}>4</Text>
            <Text style={[styles.td, styles.colAmount]}>5(3x4)</Text>
            <Text style={[styles.tdLast, styles.colVat]}>6</Text>
          </View>
          {presLines.map((line, i) => (
            <View key={i} style={styles.tr}>
              <Text style={[styles.td, styles.colNr]}>{i + 1}</Text>
              <Text style={[styles.td, styles.colDesc]}>{line.description}</Text>
              <Text style={[styles.td, styles.colUm]}>{line.unit}</Text>
              <Text style={[styles.td, styles.colQty]}>{fmtNum(line.quantity)}</Text>
              <Text style={[styles.td, styles.colPrice]}>{fmtAmount(line.presUnitPrice)}</Text>
              <Text style={[styles.td, styles.colAmount]}>{fmtAmount(line.presNet)}</Text>
              <Text style={[styles.tdLast, styles.colVat]}>{fmtAmount(line.presVat)}</Text>
            </View>
          ))}
          <View style={styles.spacerRow} />
        </View>

        {showEquivalent ? (
          <View style={styles.note}>
            <Text>
              Echivalent {fmtAmount(equivAmount)} {equivCur} la cursul BNR din{" "}
              {dotDate(invoice.issuedAt)}, 1 {foreignCur} = {fmtRate(rate)} RON.
            </Text>
          </View>
        ) : null}

        {kind === "eu_reverse" ? (
          <View style={styles.note}>
            <Text>
              Operatiune neimpozabila in Romania - taxare inversa (reverse charge).
              TVA se achita de beneficiar conform art. 196 din Directiva 2006/112/CE
              (servicii intracomunitare B2B).
            </Text>
          </View>
        ) : kind === "exempt_310" ? (
          <View style={styles.note}>
            <Text>
              Neplatitor de TVA - scutit conform art. 310 din Legea nr. 227/2015
              privind Codul fiscal (regim special de scutire pentru
              intreprinderile mici).
            </Text>
          </View>
        ) : kind === "export" ? (
          <View style={styles.note}>
            <Text>
              Operatiune neimpozabila in Romania - export de servicii catre un
              beneficiar din afara UE (locul prestarii la beneficiar, art. 278
              Cod fiscal). TVA conform legislatiei din tara beneficiarului.
            </Text>
          </View>
        ) : null}

        {invoice.footerNote ? (
          <View style={styles.note}>
            <Text>{invoice.footerNote}</Text>
          </View>
        ) : null}

        <View style={styles.footerBox}>
          <View style={styles.footerRow}>
            <Text style={{ flex: 1, padding: 4, borderRightWidth: 1, borderColor: "#000", fontSize: 8 }}>
              Intocmit de: {issuer.signer}{"\n"}
              CNP: -{"\n"}
              Numele delegatului: -{"\n"}
              B.I/C.I: -{"\n"}
              Mijloc transport: -{"\n"}
              Expedierea s-a efectuat in prezenta noastra la data de ........ora......
              {"\n"}
              Semnatura de primire:
            </Text>
            <View style={{ width: "40%" }}>
              {/* Total (net | VAT) */}
              <View style={{ flexDirection: "row", borderBottomWidth: 1, borderColor: "#000" }}>
                <Text style={{ flex: 1, padding: 4, fontSize: 8, fontFamily: "Helvetica-Bold", borderRightWidth: 1, borderColor: "#000" }}>
                  Total
                </Text>
                <Text style={{ flex: 1, padding: 4, fontSize: 8, textAlign: "right", borderRightWidth: 1, borderColor: "#000" }}>
                  {fmtAmount(totalNet)}
                </Text>
                <Text style={{ flex: 1, padding: 4, fontSize: 8, textAlign: "right" }}>
                  {fmtAmount(totalVat)}
                </Text>
              </View>
              {/* Total plata (gross) */}
              <View style={{ flexDirection: "row" }}>
                <Text style={{ flex: 1, padding: 4, fontSize: 9, fontFamily: "Helvetica-Bold", borderRightWidth: 1, borderColor: "#000" }}>
                  Total plata
                </Text>
                <Text style={{ flex: 2, padding: 4, fontSize: 9, fontFamily: "Helvetica-Bold", textAlign: "right" }}>
                  {fmtAmount(totalGross)} {present}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {invoice.dueAt ? (
          <Text style={{ marginTop: 6, fontSize: 8 }}>Termen plata: {invoice.dueAt}</Text>
        ) : null}

        <Text style={styles.smallFoot}>
          Factura este valabila fara semnatura si stampila, conform art. 319 alin.
          29 din legea 227/2015.
        </Text>
      </Page>
    </Document>
  );
}

function fmtNum(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2);
}

function fmtAmount(n: number): string {
  return n.toLocaleString("ro-RO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// BNR rate with 4 decimals, Romanian comma separator (e.g. "5,2359").
function fmtRate(n: number): string {
  return n.toLocaleString("ro-RO", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

// dd.mm.yyyy from a dd/mm/yyyy string (SmartBill uses dots in the note).
function dotDate(ddmmyyyy: string): string {
  return ddmmyyyy.replace(/\//g, ".");
}

function countryName(code: string): string {
  const names: Record<string, string> = {
    RO: "Romania",
    DK: "Danemarca",
    PT: "Portugalia",
    US: "Statele Unite",
    GB: "Marea Britanie",
    DE: "Germania",
    ES: "Spania",
    FR: "Franta",
    NL: "Olanda",
  };
  return names[code] ?? code;
}
