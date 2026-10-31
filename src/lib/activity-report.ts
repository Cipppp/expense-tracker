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
  /** Data facturii; ajunge doar in proprietatile fisierului, nu pe pagina. */
  issuedAt: Date;
  /** "mono" pentru facturile pe template-ul nou (lib/invoice-template). */
  style?: "classic" | "mono";
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
  const days = Math.floor(min / 1440);
  const tag = days >= 1 ? ` (+${days}d)` : "";
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
  if (data.style === "mono") return buildMonoReport(data);
  const wb = new ExcelJS.Workbook();
  wb.creator = data.supplier;
  wb.created = data.issuedAt;
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
  // r is now 6 → leave rows 6-7 as a spacer, table header on row 8.
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

const MONO = "JetBrains Mono";
const INK = "FF111111";
const MUTED = "FF5F6368";
const HAIR = "FFD0D0D0";

/*
 * Varianta raportului pentru facturile pe template-ul nou: acelasi aspect ca
 * factura, adica JetBrains Mono, etichete gri, linii fine, fara banda neagra
 * si fara dungi. Daca fontul nu e instalat la client, Excel il inlocuieste cu
 * cel implicit; PDF-ul raportului (components/invoices/activity-report-pdf)
 * il are inclus.
 */
async function buildMonoReport(data: ActivityReportData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = data.supplier;
  wb.created = data.issuedAt;
  const ws = wb.addWorksheet("Activity report", {
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.6, right: 0.6, top: 0.7, bottom: 0.7, header: 0.3, footer: 0.3 } },
    properties: { defaultRowHeight: 16 },
  });
  ws.columns = [{ width: 14 }, { width: 11 }, { width: 14 }, { width: 8 }, { width: 70 }];
  const font = (extra: Partial<ExcelJS.Font> = {}): Partial<ExcelJS.Font> => ({ name: MONO, size: 9, color: { argb: INK }, ...extra });
  const hair: Partial<ExcelJS.Border> = { style: "thin", color: { argb: HAIR } };
  const ink: Partial<ExcelJS.Border> = { style: "medium", color: { argb: INK } };

  ws.getCell("A1").value = "Activity report";
  ws.getCell("A1").font = font({ size: 18, bold: true });
  ws.mergeCells("C1:E1");
  ws.getCell("C1").value = data.supplier;
  ws.getCell("C1").font = font({ size: 10, bold: true });
  ws.getCell("C1").alignment = { horizontal: "right", vertical: "top" };
  ws.getRow(1).height = 28;

  const meta: Array<[string, string]> = [
    ["Invoice number", data.invoiceLabel],
    ["Period", data.periodLabel],
    ["Client", data.client],
  ];
  meta.forEach(([k, v], i) => {
    const row = 3 + i;
    ws.mergeCells(row, 1, row, 2);
    ws.getCell(row, 1).value = k;
    ws.getCell(row, 1).font = font({ color: { argb: MUTED } });
    ws.mergeCells(row, 3, row, 5);
    ws.getCell(row, 3).value = v;
    ws.getCell(row, 3).font = font();
  });

  const headerRow = 8;
  ["Date", "Day", "Time", "Hours", "Description"].forEach((h, i) => {
    const c = ws.getCell(headerRow, i + 1);
    c.value = h;
    c.font = font({ size: 8, color: { argb: MUTED } });
    c.alignment = { horizontal: i === 3 ? "right" : "left", vertical: "bottom" };
    c.border = { bottom: ink };
  });
  ws.views = [{ state: "frozen", ySplit: headerRow }];

  let row = headerRow + 1;
  let total = 0;
  for (const e of data.entries) {
    total += e.hours;
    const cells: Array<string | number> = [
      `${String(e.date.getUTCDate()).padStart(2, "0")} ${e.date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })} ${e.date.getUTCFullYear()}`,
      e.date.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" }),
      `${minutesToClock(e.startMinutes)}–${minutesToClock(e.endMinutes)}`,
      Math.round(e.hours * 100) / 100,
      e.description || "",
    ];
    cells.forEach((v, ci) => {
      const c = ws.getCell(row, ci + 1);
      c.value = v;
      c.font = font(ci === 1 ? { color: { argb: MUTED } } : {});
      c.alignment = { vertical: "top", horizontal: ci === 3 ? "right" : "left", wrapText: ci === 4 };
      c.border = { bottom: hair };
      if (ci === 3) c.numFmt = "0.##";
    });
    row++;
  }

  row++;
  const amount = Math.round(total * data.rate * 100) / 100;
  const money = (n: number) => `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${data.currency}`;
  const summary: Array<[string, string | number, boolean]> = [
    ["Total hours", Math.round(total * 100) / 100, false],
    ["Hourly rate", money(data.rate), false],
    ["Amount", money(amount), true],
  ];
  for (const [k, v, strong] of summary) {
    ws.mergeCells(row, 1, row, 3);
    ws.getCell(row, 4).value = k;
    ws.getCell(row, 4).font = font({ bold: strong, color: { argb: strong ? INK : MUTED } });
    ws.getCell(row, 5).value = v;
    ws.getCell(row, 5).font = font({ bold: strong });
    ws.getCell(row, 5).alignment = { horizontal: "right" };
    if (typeof v === "number") ws.getCell(row, 5).numFmt = "0.##";
    for (const ci of [4, 5]) ws.getCell(row, ci).border = { top: strong ? ink : hair };
    row++;
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
