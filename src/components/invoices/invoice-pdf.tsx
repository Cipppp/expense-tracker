/* eslint-disable jsx-a11y/alt-text */
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

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
  block: {
    width: "32%",
  },
  blockTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  blockLine: {
    fontSize: 8,
    marginBottom: 1.5,
  },
  title: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginBottom: 4,
  },
  meta: {
    fontSize: 8,
    textAlign: "center",
  },
  table: {
    marginTop: 8,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#000",
  },
  tr: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#000",
  },
  th: {
    padding: 4,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    borderRightWidth: 1,
    borderColor: "#000",
    textAlign: "center",
  },
  thLast: {
    padding: 4,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
  },
  td: {
    padding: 4,
    fontSize: 8,
    borderRightWidth: 1,
    borderColor: "#000",
  },
  tdLast: {
    padding: 4,
    fontSize: 8,
  },
  colNr: { width: "8%", textAlign: "center" },
  colDesc: { width: "44%" },
  colUm: { width: "8%", textAlign: "center" },
  colQty: { width: "10%", textAlign: "right" },
  colPrice: { width: "15%", textAlign: "right" },
  colAmount: { width: "15%", textAlign: "right" },
  spacerRow: {
    height: 280,
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#000",
  },
  exchange: {
    marginTop: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#000",
    fontSize: 8,
  },
  footerBox: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#000",
  },
  footerRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#000",
  },
  footerCellGrow: {
    flex: 1,
    padding: 4,
    borderRightWidth: 1,
    borderColor: "#000",
    fontSize: 8,
  },
  footerCellRight: {
    width: "30%",
    padding: 4,
    fontSize: 8,
  },
  footerTotalLabel: {
    flex: 1,
    padding: 4,
    borderRightWidth: 1,
    borderColor: "#000",
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },
  footerTotalValue: {
    width: "30%",
    padding: 4,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
  },
  smallFoot: {
    marginTop: 12,
    fontSize: 7,
    textAlign: "center",
    color: "#666",
  },
});

export type InvoicePdfProps = {
  issuer: {
    name: string;
    cif: string;
    reg: string;
    address: string;
    iban: string;
    bank: string;
    capital: string;
    signer: string;
  };
  invoice: {
    series: string;
    number: string;
    issuedAt: string;             // dd/mm/yyyy
    clientName: string;
    clientCompany: string;
    clientCui?: string | null;
    clientReg?: string | null;
    clientAddress?: string | null;
    clientCountry?: string | null;
    invoiceCurrency: string;       // "RON" | "USD" | "EUR"
    legalCurrency: string;
    bnrRate?: number | null;
    legalTotal: number;            // in legalCurrency (always RON for an RO SRL)
    invoiceTotal: number;          // in invoiceCurrency
    footerNote?: string | null;
    lines: Array<{
      description: string;
      unit: string;
      quantity: number;
      unitPrice: number;
      amount: number;
    }>;
  };
};

export function InvoicePdf({ issuer, invoice }: InvoicePdfProps) {
  const showExchange = invoice.invoiceCurrency !== invoice.legalCurrency;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Furnizor:</Text>
            <Text style={styles.blockLine}>{issuer.name}</Text>
            <Text style={styles.blockLine}>Reg. com.: {issuer.reg}</Text>
            <Text style={styles.blockLine}>CIF: {issuer.cif}</Text>
            <Text style={styles.blockLine}>Adresa: {issuer.address}</Text>
            <Text style={styles.blockLine}>IBAN: {issuer.iban}</Text>
            <Text style={styles.blockLine}>Banca: {issuer.bank}</Text>
            <Text style={styles.blockLine}>Capital social: {issuer.capital}</Text>
          </View>
          <View style={[styles.block, { alignItems: "center" }]}>
            <Text style={styles.title}>FACTURA</Text>
            <Text style={styles.meta}>
              Seria {invoice.series} nr. {invoice.number}
            </Text>
            <Text style={styles.meta}>Data (zi/luna/an): {invoice.issuedAt}</Text>
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
              Pret unitar{"\n"}-{invoice.legalCurrency}-
            </Text>
            <Text style={[styles.thLast, styles.colAmount]}>
              Valoarea{"\n"}-{invoice.legalCurrency}-
            </Text>
          </View>
          <View style={[styles.tr, { backgroundColor: "#f7f7f7" }]}>
            <Text style={[styles.td, styles.colNr]}>0</Text>
            <Text style={[styles.td, styles.colDesc]}>1</Text>
            <Text style={[styles.td, styles.colUm]}>2</Text>
            <Text style={[styles.td, styles.colQty]}>3</Text>
            <Text style={[styles.td, styles.colPrice]}>4</Text>
            <Text style={[styles.tdLast, styles.colAmount]}>5(3x4)</Text>
          </View>
          {invoice.lines.map((line, i) => (
            <View key={i} style={styles.tr}>
              <Text style={[styles.td, styles.colNr]}>{i + 1}</Text>
              <Text style={[styles.td, styles.colDesc]}>{line.description}</Text>
              <Text style={[styles.td, styles.colUm]}>{line.unit}</Text>
              <Text style={[styles.td, styles.colQty]}>
                {fmtNum(line.quantity)}
              </Text>
              <Text style={[styles.td, styles.colPrice]}>
                {fmtAmount(line.unitPrice * (invoice.bnrRate ?? 1))}
              </Text>
              <Text style={[styles.tdLast, styles.colAmount]}>
                {fmtAmount(line.amount * (invoice.bnrRate ?? 1))}
              </Text>
            </View>
          ))}
          <View style={styles.spacerRow} />
        </View>

        {showExchange && invoice.bnrRate ? (
          <View style={styles.exchange}>
            <Text>
              Exchange rate {invoice.invoiceCurrency}/{invoice.legalCurrency} as
              per BNR on invoice date: {invoice.bnrRate.toFixed(4)} ={" "}
              {fmtAmount(invoice.invoiceTotal)} {invoice.invoiceCurrency}
            </Text>
          </View>
        ) : null}

        <View style={styles.footerBox}>
          <View style={styles.footerRow}>
            <Text style={styles.footerCellGrow}>
              Intocmit de: {issuer.signer}{"\n"}
              CNP:  -{"\n"}
              Numele delegatului: -{"\n"}
              B/I/C/I: -{"\n"}
              Mijloc transport: -{"\n"}
              Expedierea s-a efectuat in prezenta noastra la data de ........ora......
              {"\n"}
              Semnaturile:
            </Text>
            <View style={{ width: "30%" }}>
              <View
                style={{
                  flex: 1,
                  borderBottomWidth: 1,
                  borderColor: "#000",
                  padding: 4,
                }}
              >
                <Text style={{ fontSize: 8 }}>Total</Text>
              </View>
              <View style={{ flex: 1, padding: 4 }}>
                <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold" }}>
                  {fmtAmount(invoice.legalTotal)}
                </Text>
              </View>
              <View
                style={{
                  flex: 1,
                  borderTopWidth: 1,
                  borderColor: "#000",
                  padding: 4,
                }}
              >
                <Text style={{ fontSize: 8 }}>Semnatura de primire:</Text>
              </View>
            </View>
          </View>
        </View>

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

function countryName(code: string): string {
  const names: Record<string, string> = {
    RO: "Romania",
    DK: "Denemarca",
    US: "Statele Unite",
    GB: "Marea Britanie",
    DE: "Germania",
  };
  return names[code] ?? code;
}
