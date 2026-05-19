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

/** "09:00" → 540 */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** 540 → "09:00". Wraps past midnight: 1560 (26:00) → "02:00". */
export function minutesToTime(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** 2.5 → "2h 30m", 0.25 → "15m", 8 → "8h" */
export function fmtDuration(hours: number): string {
  const total = Math.round(hours * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** ISO yyyy-mm-dd from a Date, in local time */
export function localISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Monday-start week. Returns array of 7 dates. */
export function weekDates(anchor: Date): Date[] {
  const d = new Date(anchor);
  d.setHours(12, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    return x;
  });
}
