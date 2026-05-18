/**
 * Money / date formatters. RON is shown with " RON" suffix, USD with leading "$".
 * Internally money is stored as integers in minor units (bani / cents).
 */

export function ronFromBani(bani: number): number {
  return Math.round(bani) / 100;
}

export function usdFromCents(cents: number): number {
  return Math.round(cents) / 100;
}

export function baniFromRon(ron: number): number {
  return Math.round(ron * 100);
}

export function centsFromUsd(usd: number): number {
  return Math.round(usd * 100);
}

export function fmtRon(bani: number): string {
  const v = ronFromBani(bani);
  const sign = v < 0 ? "-" : "";
  return `${sign}${Math.abs(v).toLocaleString("ro-RO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} RON`;
}

export function fmtUsd(cents: number): string {
  const v = usdFromCents(cents);
  const sign = v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function fmtDate(d: Date | string, locale = "en-GB"): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function fmtMonth(year: number, month: number): string {
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function startOfMonth(year: number, month: number): Date {
  return new Date(year, month - 1, 1, 0, 0, 0, 0);
}

export function endOfMonth(year: number, month: number): Date {
  return new Date(year, month, 0, 23, 59, 59, 999);
}
