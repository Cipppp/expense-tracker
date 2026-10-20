/*
 * Ce inseamna un mesaj din SPV si cat de repede trebuie sa faci ceva.
 *
 * ANAF da pentru fiecare mesaj doar un "tip" (RECIPISA, NOTIFICARE, ...) si o
 * descriere libera. Din ele scoatem ce vrei sa vezi dintr-o privire: ce fel
 * de document e, daca e de rau, si termenul, cand notificarea il da. Termenele
 * vin din textul notificarilor: "15 zile de la primirea prezentei" pentru
 * nedepuneri si erori, 30 de zile inainte de declararea ca inactiv.
 *
 * Fisierul e pur: acelasi cod ruleaza la sincronizare, in pagina si in teste.
 */

export type SpvTone = "ok" | "info" | "warn" | "danger";

export type SpvMessageInput = {
  id: string;
  cif: string;
  tip: string;
  detalii: string;
  data_creare: string;
  id_solicitare?: string | null;
};

export type SpvInfo = {
  /** Eticheta scurta: "Recipisă D112 · 08/2026", "Notificare: nedepunere". */
  title: string;
  tone: SpvTone;
  /** Termenul de raspuns, cand notificarea il da; zi calendaristica, UTC noon. */
  deadline: Date | null;
};

const DAY = 86_400_000;

/**
 * `data_creare` vine ca "24.08.2026 02:54:22", dar ora e pe 12 ore fara AM/PM:
 * acelasi mesaj apare in SPV la 14:54. Ziua e singura parte sigura, asa ca o
 * pastram doar pe ea, la pranz UTC, ca fusul orar sa n-o mute in alta zi.
 */
export function parseAnafDay(s: string): Date | null {
  const m = s.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (!m) return null;
  const [, d, mo, y] = m.map(Number) as unknown as [never, number, number, number];
  const date = new Date(Date.UTC(y, mo - 1, d, 12));
  return date.getUTCMonth() === mo - 1 ? date : null;
}

function plusDays(d: Date, n: number) {
  return new Date(d.getTime() + n * DAY);
}

/** "tip D112, ... perioada raportare 8.2026" → { form: "D112", period: "08/2026" } */
function receiptParts(details: string) {
  const form = details.match(/\btip\s+([A-Z]\d{3}[A-Z]?|Z\d{2})\b/i)?.[1]?.toUpperCase() ?? null;
  const p = details.match(/perioada raportare\s+(\d{1,2})\.(\d{4})/i);
  const period = p ? `${p[1].padStart(2, "0")}/${p[2]}` : null;
  return { form, period };
}

export function describeSpv(kind: string, details: string, received: Date): SpvInfo {
  const k = kind.trim().toUpperCase();
  const d = details.toLowerCase();

  if (k === "RECIPISA") {
    const { form, period } = receiptParts(details);
    const title = ["Recipisă", form, period && `· ${period}`].filter(Boolean).join(" ");
    return { title, tone: "ok", deadline: null };
  }

  if (k === "NOTIFICARE") {
    if (d.includes("nedepunerea")) {
      return { title: "Notificare: declarații nedepuse", tone: "danger", deadline: plusDays(received, 15) };
    }
    if (d.includes("depunerea eronata") || d.includes("modul de completare")) {
      return { title: "Notificare: declarație cu erori", tone: "warn", deadline: plusDays(received, 15) };
    }
    if (d.includes("inactiv")) {
      return { title: "Notificare: risc de inactivare", tone: "danger", deadline: plusDays(received, 30) };
    }
    return { title: "Notificare", tone: "warn", deadline: null };
  }

  if (k.includes("INACTIV")) return { title: "Decizie de inactivare", tone: "danger", deadline: null };
  if (k.includes("ANULAREA") && k.includes("TVA")) {
    return { title: "Decizie: anularea înregistrării în scopuri de TVA", tone: "danger", deadline: null };
  }
  if (k.includes("DECIZIE")) return { title: kind.trim(), tone: "warn", deadline: null };
  if (k === "P300 ETVA") return { title: "Decont TVA precompletat (RO e-TVA)", tone: "info", deadline: null };
  if (k === "RASPUNS SOLICITARE") {
    const what = details.replace(/^duplicat\s+/i, "").replace(/\s+pentru\s+(CUI|CIF)\s+\d+$/i, "").trim();
    return { title: what ? `Răspuns: ${what}` : "Răspuns la solicitare", tone: "info", deadline: null };
  }
  if (k.includes("CERTIFICAT")) return { title: kind.trim(), tone: "ok", deadline: null };
  return { title: kind.trim() || "Mesaj SPV", tone: "info", deadline: null };
}

/** 13 cifre = CNP: nu-l afisam intreg, e un identificator personal. */
export function isCnp(cif: string) {
  return /^\d{13}$/.test(cif);
}

export function maskCnp(cnp: string) {
  return `${cnp.slice(0, 1)}••••••••${cnp.slice(-4)}`;
}

/** "PROJECT CIP S.R.L." → "PROJECT CIP": in lista, forma juridica doar ocupa loc. */
export function shortCompany(name: string) {
  return name.replace(/[\s,]+(S\.?\s?R\.?\s?L\.?|S\.?\s?A\.?|SRL|SA|PFA)\.?$/i, "").trim() || name;
}

/**
 * Notificarile cu termen, o data pe fiecare problema. ANAF trimite adesea doua
 * notificari identice in aceeasi zi (una pe declaratie); in banda de sus
 * conteaza ce ai de facut si pana cand, nu de cate ori ti s-a spus.
 */
export function groupDue<T extends { cif: string; info: SpvInfo }>(items: T[], today: Date) {
  const groups = new Map<string, { first: T; count: number }>();
  for (const m of items) {
    const { deadline, tone, title } = m.info;
    if (!deadline || deadline.getTime() < today.getTime()) continue;
    if (tone !== "danger" && tone !== "warn") continue;
    const key = `${m.cif}|${title}|${deadline.toISOString().slice(0, 10)}`;
    const g = groups.get(key);
    if (g) g.count += 1;
    else groups.set(key, { first: m, count: 1 });
  }
  return [...groups.values()].sort(
    (a, b) => a.first.info.deadline!.getTime() - b.first.info.deadline!.getTime(),
  );
}
