/*
 * Body measurements on the weekly check-in, in the order they're taken.
 * Shared by the API (validation) and the page (form and history).
 */
export const MEASUREMENTS = [
  { key: "waistCm", label: "Talie", hint: "102" },
  { key: "hipsCm", label: "Fesieri", hint: "108" },
  { key: "chestCm", label: "Piept", hint: "110" },
  { key: "thighCm", label: "Coapsă", hint: "62" },
  { key: "armCm", label: "Braț", hint: "38" },
] as const;

export type MeasurementKey = (typeof MEASUREMENTS)[number]["key"];
