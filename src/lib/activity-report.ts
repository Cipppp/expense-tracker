import "server-only";
import ExcelJS from "exceljs";

export type ActivityEntry = {
  date: Date;
  startMinutes: number | null;
  endMinutes: number | null;
  hours: number;
  description: string;
};

export type ActivityReportData = {
  supplier: string;
  client: string;
  invoiceLabel: string; // "CP 0017"
  periodLabel: string; // "May 2026"
  generatedAt: Date;
  currency: string;
  rate: number; // hourly rate in `currency`
  entries: ActivityEntry[];
};

const BLACK = "FF000000";
const WHITE = "FFFFFFFF";
const LIGHT = "FFF2F2F2";

function minutesToClock(min: number | null): string {
  if (min == null) return "—";
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  const tag = min >= 1440 ? " (+1d)" : "";
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}${tag}`;
}

function thinBorder(): Partial<ExcelJS.Borders> {
  const side: Partial<ExcelJS.Border> = { style: "thin", color: { argb: BLACK } };
  return { top: side, left: side, bottom: side, right: side };
}

/**
 * Build a professional, black-and-white timesheet workbook (Clockify-style)
 * the user can hand to the client alongside the invoice. No colour beyond a
 * black header band — clean borders, bold headers, right-aligned numbers.
 */
export async function buildActivityReport(
  data: ActivityReportData,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = data.supplier;
  wb.created = data.generatedAt;
  const ws = wb.addWorksheet("Activity report", {
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 } },
    views: [{ state: "frozen", ySplit: 8 }],
  });

  ws.columns = [
    { width: 5 }, // #
    { width: 13 }, // Date
    { width: 7 }, // Day
    { width: 11 }, // From
    { width: 11 }, // To
    { width: 9 }, // Hours
    { width: 56 }, // Description
  ];

  // ---- Title ----
  ws.mergeCells("A1:G1");
  const title = ws.getCell("A1");
  title.value = "ACTIVITY REPORT";
  title.font = { name: "Arial", size: 16, bold: true, color: { argb: BLACK } };
  title.alignment = { vertical: "middle" };
  ws.getRow(1).height = 24;

  // ---- Meta block (label : value rows) ----
  const meta: Array<[string, string]> = [
    ["Supplier", data.supplier],
    ["Client", data.client],
    ["Invoice", data.invoiceLabel],
    ["Period", data.periodLabel],
    ["Generated", data.generatedAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })],
  ];
  let r = 2;
  for (const [label, value] of meta) {
    const lc = ws.getCell(r, 1);
    lc.value = label;
    lc.font = { name: "Arial", size: 9, bold: true, color: { argb: BLACK } };
    ws.mergeCells(r, 2, r, 7);
    const vc = ws.getCell(r, 2);
    vc.value = value;
    vc.font = { name: "Arial", size: 9, color: { argb: BLACK } };
    r++;
  }
  // r is now 7 → leave row 7 as a thin spacer, table header on row 8.
  const headerRow = 8;

  // ---- Table header ----
  const headers = ["#", "Date", "Day", "From", "To", "Hours", "Description"];
  const hr = ws.getRow(headerRow);
  headers.forEach((h, i) => {
    const c = hr.getCell(i + 1);
    c.value = h;
    c.font = { name: "Arial", size: 9, bold: true, color: { argb: WHITE } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLACK } };
    c.alignment = { vertical: "middle", horizontal: i >= 3 && i <= 5 ? "right" : i === 6 ? "left" : "center" };
    c.border = thinBorder();
  });
  hr.height = 18;

  // ---- Entry rows ----
  let row = headerRow + 1;
  let totalHours = 0;
  data.entries.forEach((e, i) => {
    totalHours += e.hours;
    const cells: Array<{ v: string | number; align?: "left" | "right" | "center"; num?: boolean }> = [
      { v: i + 1, align: "center" },
      { v: e.date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }), align: "center" },
      { v: e.date.toLocaleDateString("en-GB", { weekday: "short" }), align: "center" },
      { v: minutesToClock(e.startMinutes), align: "right" },
      { v: minutesToClock(e.endMinutes), align: "right" },
      { v: Math.round(e.hours * 100) / 100, align: "right", num: true },
      { v: e.description || "—", align: "left" },
    ];
    const rr = ws.getRow(row);
    cells.forEach((cell, ci) => {
      const c = rr.getCell(ci + 1);
      c.value = cell.v;
      c.font = { name: "Arial", size: 9, color: { argb: BLACK } };
      c.alignment = { vertical: "top", horizontal: cell.align ?? "left", wrapText: ci === 6 };
      c.border = thinBorder();
      if (cell.num) c.numFmt = "0.00";
    });
    if (i % 2 === 1) {
      // subtle zebra striping (light grey) — still B&W-printer friendly
      for (let ci = 1; ci <= 7; ci++) {
        rr.getCell(ci).fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT } };
      }
    }
    row++;
  });

  // ---- Total hours row ----
  const totalRow = ws.getRow(row);
  ws.mergeCells(row, 1, row, 5);
  const tl = totalRow.getCell(1);
  tl.value = "Total hours";
  tl.font = { name: "Arial", size: 9, bold: true, color: { argb: BLACK } };
  tl.alignment = { horizontal: "right", vertical: "middle" };
  tl.border = thinBorder();
  for (let ci = 2; ci <= 5; ci++) totalRow.getCell(ci).border = thinBorder();
  const th = totalRow.getCell(6);
  th.value = Math.round(totalHours * 100) / 100;
  th.numFmt = "0.00";
  th.font = { name: "Arial", size: 9, bold: true, color: { argb: BLACK } };
  th.alignment = { horizontal: "right" };
  th.border = thinBorder();
  const tdesc = totalRow.getCell(7);
  tdesc.border = thinBorder();
  row++;

  // ---- Summary block (rate / amount) ----
  row++; // spacer
  const summary: Array<[string, string | number, string?]> = [
    ["Hourly rate", `${data.rate.toFixed(2)} ${data.currency}`],
    ["Total hours", Math.round(totalHours * 100) / 100],
    ["Amount", `${(Math.round(totalHours * data.rate * 100) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${data.currency}`],
  ];
  for (const [label, value] of summary) {
    const lc = ws.getCell(row, 5);
    lc.value = label;
    lc.font = { name: "Arial", size: 9, bold: label === "Amount", color: { argb: BLACK } };
    lc.alignment = { horizontal: "right" };
    ws.mergeCells(row, 6, row, 7);
    const vc = ws.getCell(row, 6);
    vc.value = value;
    vc.font = { name: "Arial", size: 9, bold: label === "Amount", color: { argb: BLACK } };
    vc.alignment = { horizontal: "right" };
    row++;
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
