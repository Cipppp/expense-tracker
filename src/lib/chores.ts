/**
 * Household chores rotation — two fixed weekly chore sets ("Rândul 1" lighter,
 * "Rândul 2" heavier) that Cip and Axy swap each week. Data transcribed from
 * the shared spreadsheet. Pure module (no server-only) so both the server page
 * and the client board can import it.
 */

export type SetId = 1 | 2;

export const PEOPLE = {
  cip: { key: "cip", name: "Cip", color: "#3f6fb0", soft: "rgba(63,111,176,0.12)" },
  axy: { key: "axy", name: "Axy", color: "#b5739d", soft: "rgba(181,115,157,0.12)" },
} as const;
export type PersonKey = keyof typeof PEOPLE;

export type Person = { key: PersonKey; name: string; color: string; soft: string };
export type People = Record<PersonKey, Person>;

/**
 * Cine sunt cei doi din casa.
 *
 * Cheile raman "cip" si "axy" — sunt scrise in fiecare rand din baza de date
 * si nu au de ce sa se schimbe. Numele si culorile vin din Settings, ca alta
 * casa sa nu fie nevoita sa traiasca cu numele noastre pe ecran.
 */
function softOf(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "rgba(120,120,130,0.12)";
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},0.12)`;
}

export function resolvePeople(settings: {
  personAName?: string | null;
  personAColor?: string | null;
  personBName?: string | null;
  personBColor?: string | null;
}): People {
  const one = (
    key: PersonKey,
    name: string | null | undefined,
    color: string | null | undefined,
  ): Person => {
    const c = (color ?? "").trim() || PEOPLE[key].color;
    return {
      key,
      name: (name ?? "").trim() || PEOPLE[key].name,
      color: c,
      soft: softOf(c),
    };
  };
  return {
    cip: one("cip", settings.personAName, settings.personAColor),
    axy: one("axy", settings.personBName, settings.personBColor),
  };
}

export const DAYS = [
  "Luni",
  "Marți",
  "Miercuri",
  "Joi",
  "Vineri",
  "Sâmbătă",
  "Duminică",
] as const;

export type Chore = { label: string; shopping?: boolean };

// Index 0 = Luni … 6 = Duminică. Mirrors the spreadsheet's two grids.
export const CHORES: Record<SetId, Chore[][]> = {
  1: [
    [{ label: "Făcut pat" }, { label: "Aspirat" }], // Luni
    [{ label: "Spălat vase" }, { label: "Frigider interior/exterior" }], // Marți
    [
      { label: "Făcut pat" },
      { label: "Aspirat" },
      { label: "Prosoape schimbate" },
      { label: "Lenjerie schimbată" },
    ], // Miercuri
    [{ label: "Spălat vase" }, { label: "Oglindă" }, { label: "Chiuvetă" }], // Joi
    [
      { label: "Făcut pat" },
      { label: "Aspirat" },
      { label: "Dat cu mopul" },
      { label: "Birou" },
    ], // Vineri
    [{ label: "Spălat vase" }, { label: "Aragaz + cuptor + microunde" }], // Sâmbătă
    [{ label: "Făcut pat" }], // Duminică
  ],
  2: [
    [{ label: "Spălat vase" }, { label: "Haine la spălat / întins" }], // Luni
    [
      { label: "Făcut pat" },
      { label: "Rafturi + blat baie" },
      { label: "Bringo", shopping: true },
    ], // Marți
    [
      { label: "Spălat vase" },
      { label: "Haine la spălat / întins" },
      { label: "Masă + scaune + blat bucătărie" },
    ], // Miercuri
    [{ label: "Făcut pat" }, { label: "Toaletă" }, { label: "Duș" }], // Joi
    [{ label: "Spălat vase" }, { label: "Ordine dulapuri" }], // Vineri
    [
      { label: "Făcut pat" },
      { label: "Raft alb + mobilă + dulap TV" },
      { label: "Bringo", shopping: true },
    ], // Sâmbătă
    [{ label: "Spălat vase" }], // Duminică
  ],
};

export const choreKey = (set: SetId, day: number, idx: number) =>
  `${set}-${day}-${idx}`;

/** Total chores in a set across the whole week. */
export function setTotal(set: SetId): number {
  return CHORES[set].reduce((a, day) => a + day.length, 0);
}

// --- ISO week helpers -------------------------------------------------------

/** ISO-8601 week number + year for a date. */
export function isoWeekParts(d: Date): { year: number; week: number } {
  // Copy at UTC midnight to avoid DST/time-of-day drift.
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7; // Mon=1 … Sun=7
  t.setUTCDate(t.getUTCDate() + 4 - day); // shift to the Thursday of this week
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: t.getUTCFullYear(), week };
}

export function isoWeekKey(d: Date): string {
  const { year, week } = isoWeekParts(d);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** The seven dates (Mon→Sun) of the week containing `d`, as local dates. */
export function weekDates(d: Date): Date[] {
  const base = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const offset = (base.getDay() + 6) % 7; // 0 if Monday
  base.setDate(base.getDate() - offset);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(base);
    x.setDate(base.getDate() + i);
    return x;
  });
}

/** Index (0=Mon … 6=Sun) of `d` within its week. */
export function weekdayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/**
 * Who is on which set this week. Base rule: even ISO week → Cip on Rândul 1.
 * `flip` inverts the phase so a single tap can match the real-world cadence.
 */
export function assignment(
  week: number,
  flip: boolean,
): { cip: SetId; axy: SetId } {
  const cipOnOne = (week % 2 === 0) !== flip;
  return cipOnOne ? { cip: 1, axy: 2 } : { cip: 2, axy: 1 };
}

export function personForSet(
  set: SetId,
  a: { cip: SetId; axy: SetId },
): PersonKey {
  return a.cip === set ? "cip" : "axy";
}
