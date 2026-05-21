/**
 * Free-form time-entry parser for the Cmd+K quick-logger. Pulls out client,
 * time range / hours, date keyword, and treats whatever's left as a
 * description. Designed to be forgiving and to keep the original word
 * order — the user just types, we figure it out.
 *
 * Examples we should handle:
 *   - "8h netop today"
 *   - "2h Rudig fix bug ieri"
 *   - "9:00-17:00 safeINIT migrate the auth layer"
 *   - "9-17 blng yesterday emergency rollback"
 *   - "1.5h SPOTLITE deep dive on schema"
 *   - "blng 22:00-04:00 night incident response"
 *
 * The parser doesn't fail on ambiguity — instead returns a partial result
 * and the UI flags what's missing so the user can correct in place.
 */

export type ParsedQuickLog = {
  jobId: string | null;
  jobName: string | null;
  /** yyyy-mm-dd in the local timezone */
  date: string;
  startMinutes: number | null;
  /** >= startMinutes; may exceed 1440 for overnight shifts */
  endMinutes: number | null;
  /** Total hours (end - start) / 60 — handy for the preview line */
  hours: number | null;
  description: string;
  /** Human-readable list of issues; empty when good-to-go. */
  missing: string[];
};

type JobCandidate = {
  id: string;
  name: string;
};

function localISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Strip non-alnum and lowercase — used for fuzzy client-name comparison. */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const DAY_OF_WEEK = [
  { names: ["sunday", "duminica", "duminică"], day: 0 },
  { names: ["monday", "luni"], day: 1 },
  { names: ["tuesday", "marti", "marți"], day: 2 },
  { names: ["wednesday", "miercuri"], day: 3 },
  { names: ["thursday", "joi"], day: 4 },
  { names: ["friday", "vineri"], day: 5 },
  { names: ["saturday", "sambata", "sâmbătă"], day: 6 },
];

export function parseQuickLog(
  input: string,
  jobs: JobCandidate[],
  now: Date = new Date(),
): ParsedQuickLog {
  let remaining = ` ${input.trim()} `;

  function strip(re: RegExp) {
    remaining = remaining.replace(re, " ").replace(/\s+/g, " ");
  }

  // 1. Try a time range first: 9-17, 09:00-17:00, 22:30 - 04:00.
  let startMinutes: number | null = null;
  let endMinutes: number | null = null;
  const rangeRe =
    /\b(\d{1,2})(?::(\d{2}))?\s*[-–—to]+\s*(\d{1,2})(?::(\d{2}))?\b/i;
  const rangeMatch = remaining.match(rangeRe);
  if (rangeMatch) {
    const sh = parseInt(rangeMatch[1], 10);
    const sm = parseInt(rangeMatch[2] ?? "0", 10);
    const eh = parseInt(rangeMatch[3], 10);
    const em = parseInt(rangeMatch[4] ?? "0", 10);
    if (sh < 24 && eh < 24 && sm < 60 && em < 60) {
      startMinutes = sh * 60 + sm;
      endMinutes = eh * 60 + em;
      if (endMinutes <= startMinutes) endMinutes += 24 * 60;
      strip(rangeRe);
    }
  }

  // 2. Else hours-only: "8h", "1.5h", "2.25h".
  let hours: number | null = null;
  if (startMinutes === null) {
    const hRe = /\b(\d+(?:[.,]\d+)?)h\b/i;
    const hMatch = remaining.match(hRe);
    if (hMatch) {
      hours = parseFloat(hMatch[1].replace(",", "."));
      // Default the day window to a 09:00 start; the UI shows the preview
      // and the user can drag/resize later in the calendar.
      startMinutes = 9 * 60;
      endMinutes = startMinutes + Math.round(hours * 60);
      strip(hRe);
    }
  } else {
    hours = (endMinutes! - startMinutes!) / 60;
  }

  // 3. Date keyword: today / yesterday / tomorrow + RO equivalents.
  const date = new Date(now);
  const TODAY_RE = /\b(today|azi)\b/i;
  const YESTERDAY_RE = /\b(yesterday|ieri)\b/i;
  const TOMORROW_RE = /\b(tomorrow|maine|mâine)\b/i;
  if (TODAY_RE.test(remaining)) {
    strip(TODAY_RE);
  } else if (YESTERDAY_RE.test(remaining)) {
    date.setDate(date.getDate() - 1);
    strip(YESTERDAY_RE);
  } else if (TOMORROW_RE.test(remaining)) {
    date.setDate(date.getDate() + 1);
    strip(TOMORROW_RE);
  } else {
    // Day-of-week: roll back to the most recent matching weekday.
    for (const dow of DAY_OF_WEEK) {
      const re = new RegExp(`\\b(${dow.names.join("|")})\\b`, "i");
      if (re.test(remaining)) {
        const todayDow = date.getDay();
        const diff = (todayDow - dow.day + 7) % 7;
        date.setDate(date.getDate() - (diff === 0 ? 7 : diff));
        strip(re);
        break;
      }
    }
  }

  // 4. Client match — try increasingly flexible strategies. Longest name
  //    wins so "safeINIT" beats a hypothetical "safe".
  //
  //   a) exact word match, case-insensitive: "safeinit" → safeINIT ✓
  //   b) normalized token window: "safe init" / "safe-init" → safeINIT ✓
  //   c) prefix match on a single token (≥3 chars): "safe" → safeINIT ✓
  //      (only fires when there's no ambiguity — multiple clients sharing
  //      the same prefix means we skip this strategy)
  let job: JobCandidate | null = null;
  let matchedText: string | null = null;
  const sortedJobs = [...jobs].sort((a, b) => b.name.length - a.name.length);

  // a) exact \bNAME\b /i
  for (const j of sortedJobs) {
    const re = new RegExp(`\\b${escapeRegex(j.name)}\\b`, "i");
    const m = remaining.match(re);
    if (m) {
      job = j;
      matchedText = m[0];
      break;
    }
  }

  // b) normalized window: try to match consecutive tokens against each
  //    job's normalized name (alnum-only, lowercase). This lets the user
  //    type "safe init", "safe-init", or "safe.init" — they all collapse
  //    to "safeinit" which equals normalize("safeINIT").
  if (!job) {
    const tokens = remaining.trim().split(/\s+/).filter(Boolean);
    outer: for (const j of sortedJobs) {
      const target = normalize(j.name);
      if (!target) continue;
      for (let start = 0; start < tokens.length; start++) {
        let combined = "";
        for (let end = start; end < Math.min(start + 4, tokens.length); end++) {
          combined += normalize(tokens[end]);
          if (combined === target) {
            job = j;
            matchedText = tokens.slice(start, end + 1).join(" ");
            break outer;
          }
          if (!target.startsWith(combined)) break;
        }
      }
    }
  }

  // c) single-token prefix match, only when unambiguous.
  if (!job) {
    const tokens = remaining.trim().split(/\s+/).filter(Boolean);
    for (const t of tokens) {
      const n = normalize(t);
      if (n.length < 3) continue;
      const candidates = sortedJobs.filter((j) =>
        normalize(j.name).startsWith(n),
      );
      if (candidates.length === 1) {
        job = candidates[0];
        matchedText = t;
        break;
      }
    }
  }

  if (job && matchedText) {
    // Escape regex meta-chars in the matched text — could contain dashes etc.
    remaining = remaining
      .replace(new RegExp(escapeRegex(matchedText), "i"), " ")
      .replace(/\s+/g, " ");
  }

  const description = remaining.trim();

  const missing: string[] = [];
  if (!job) missing.push("client");
  if (startMinutes === null || endMinutes === null) missing.push("hours");

  return {
    jobId: job?.id ?? null,
    jobName: job?.name ?? null,
    date: localISO(date),
    startMinutes,
    endMinutes,
    hours,
    description,
    missing,
  };
}
