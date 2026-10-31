import { Document, Page, StyleSheet, View } from "@react-pdf/renderer";
import { INVOICE_FONT } from "@/lib/invoice-fonts";
import { KV, T } from "@/components/invoices/pdf-parts";
import type { ActivityReportData } from "@/lib/activity-report";

/*
 * Raportul de activitate ca PDF, in acelasi aspect ca factura noua
 * (invoice-pdf-mono): JetBrains Mono, etichete gri, linii fine, fara benzi
 * colorate. Clientul primeste doua documente care arata ca un set: factura
 * spune cat, raportul spune pe ce.
 */

const MUTED = "#5f6368";
const RULE = "#d0d0d0";

const s = StyleSheet.create({
  page: { paddingTop: 46, paddingHorizontal: 48, paddingBottom: 60, fontFamily: INVOICE_FONT, fontSize: 8.2, lineHeight: 1.45, color: "#111" },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  title: { fontSize: 20, fontWeight: 700, lineHeight: 1 },
  mark: { fontSize: 10, fontWeight: 700, textAlign: "right", lineHeight: 1.3 },
  meta: { marginTop: 12 },
  thead: { flexDirection: "row", marginTop: 30, paddingBottom: 5, borderBottomWidth: 0.8, borderColor: "#111", color: MUTED, fontSize: 7.4 },
  tr: { flexDirection: "row", paddingVertical: 7, borderBottomWidth: 0.5, borderColor: RULE },
  cDate: { width: "15%" },
  cTime: { width: "15%" },
  cHours: { width: "8%", textAlign: "right", paddingRight: 12 },
  cDesc: { width: "62%" },
  totals: { marginLeft: "auto", width: "46%", marginTop: 10 },
  tot: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderTopWidth: 0.5, borderColor: RULE },
  bold: { fontWeight: 700 },
  foot: { position: "absolute", left: 48, right: 48, bottom: 30, borderTopWidth: 0.5, borderColor: RULE, paddingTop: 6, fontSize: 7, color: MUTED },
});

/** "08 Sep 2026": luna scurta pe trei litere (en-GB scrie "Sept"). */
const day = (d: Date) =>
  `${String(d.getUTCDate()).padStart(2, "0")} ${d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })} ${d.getUTCFullYear()}`;

const clock = (min: number | null) =>
  min == null ? "" : `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export function ActivityReportPdf({ data }: { data: ActivityReportData }) {
  const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const total = Math.round(data.entries.reduce((a, e) => a + e.hours, 0) * 100) / 100;
  const amount = Math.round(total * data.rate * 100) / 100;

  return (
    <Document title={`Activity report ${data.invoiceLabel}`} author={data.supplier} creator={data.supplier} producer={data.supplier}>
      <Page size="A4" style={s.page}>
        <View style={s.top}>
          <View style={{ width: "64%" }}>
            <T style={s.title}>Activity report</T>
            <View style={s.meta}>
              <KV width={98} keyStyle={{ color: MUTED }} k="Invoice number" v={data.invoiceLabel} />
              <KV width={98} keyStyle={{ color: MUTED }} k="Period" v={data.periodLabel} />
              <KV width={98} keyStyle={{ color: MUTED }} k="Client" v={data.client} />
            </View>
          </View>
          <T style={s.mark}>{data.supplier}</T>
        </View>

        <View style={s.thead}>
          <T style={s.cDate}>Date</T>
          <T style={s.cTime}>Time</T>
          <T style={s.cHours}>Hours</T>
          <T style={s.cDesc}>Description</T>
        </View>
        {data.entries.map((e, i) => (
          <View key={i} style={s.tr} wrap={false}>
            <View style={s.cDate}>
              <T>{day(e.date)}</T>
              <T style={{ color: MUTED }}>{e.date.toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" })}</T>
            </View>
            <T style={s.cTime}>
              {clock(e.startMinutes)}–{clock(e.endMinutes)}
            </T>
            <T style={s.cHours}>{Math.round(e.hours * 100) / 100}</T>
            <T style={s.cDesc}>{e.description}</T>
          </View>
        ))}

        <View style={s.totals} wrap={false}>
          <View style={s.tot}>
            <T>Total hours</T>
            <T>{total}</T>
          </View>
          <View style={s.tot}>
            <T>Hourly rate</T>
            <T>
              {fmt(data.rate)} {data.currency}
            </T>
          </View>
          <View style={s.tot}>
            <T style={s.bold}>Amount</T>
            <T style={s.bold}>
              {fmt(amount)} {data.currency}
            </T>
          </View>
        </View>

        <View style={s.foot} fixed>
          <T>
            {data.invoiceLabel} · Activity report · {data.supplier}
          </T>
        </View>
      </Page>
    </Document>
  );
}
