import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { centsFromUsd, dateAtNoonUTC } from "@/lib/format";
import { parseQuickLog } from "@/lib/quick-log";

export const dynamic = "force-dynamic";

/**
 * External time-log API for tools like Conductor / Claude Code.
 *
 * Auth: `Authorization: Bearer <token>` where the token matches
 * Settings.timelogToken (generated in Settings → API access). This bypasses
 * the browser session, so an agent can POST hours straight from a workspace.
 *
 * Two ways to call it:
 *
 *   1. Free-form text — parsed the same way as the Cmd+K quick-logger:
 *        { "text": "30m safeINIT fixed the auth race" }
 *        { "text": "9-17 netop migrated billing" }
 *
 *   2. Structured:
 *        { "client": "safeINIT", "minutes": 30, "description": "..." }   // append
 *        { "client": "netop", "start": "10:00", "end": "18:00" }         // explicit block
 *
 * Append mode (the default when you pass `minutes`) accumulates into the
 * day's block for that client — call it after each prompt and the block
 * grows. Explicit start/end always creates/sets a precise block.
 */

const Body = z.object({
  text: z.string().optional(),
  client: z.string().optional(),
  minutes: z.coerce.number().positive().max(24 * 60).optional(),
  start: z.string().optional(), // "HH:MM" or minutes-from-midnight
  end: z.string().optional(),
  date: z.string().optional(), // today | yesterday | yyyy-mm-dd
  description: z.string().optional(),
  mode: z.enum(["append", "replace"]).optional(),
});

/** Current calendar day in Romania, as yyyy-mm-dd. Avoids the UTC-midnight
 * drift that would otherwise log late-evening work on the wrong day. */
function bucharestToday(): string {
  // en-CA renders as yyyy-mm-dd.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function shiftIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Parse "9", "9:30", "09:00", or a raw minute count into minutes-from-midnight. */
function toMinutes(v: string | undefined): number | null {
  if (v == null) return null;
  const s = v.trim();
  if (/^\d{1,4}$/.test(s)) {
    const n = parseInt(s, 10);
    return n <= 48 ? n * 60 : n; // small number = hour, big = already minutes
  }
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  return null;
}

function resolveDate(keyword: string | undefined): string {
  const today = bucharestToday();
  if (!keyword || keyword === "today" || keyword === "azi") return today;
  if (keyword === "yesterday" || keyword === "ieri") return shiftIso(today, -1);
  if (keyword === "tomorrow" || keyword === "maine" || keyword === "mâine")
    return shiftIso(today, 1);
  if (/^\d{4}-\d{2}-\d{2}$/.test(keyword)) return keyword;
  return today;
}

export async function POST(req: Request) {
  // --- auth ---
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const settings = await db.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
  if (!settings.timelogToken) {
    return NextResponse.json(
      { error: "Time-log API is disabled. Generate a token in Settings." },
      { status: 403 },
    );
  }
  if (!token || token !== settings.timelogToken) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // --- parse body ---
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const v = parsed.data;

  const jobs = await db.job.findMany({ where: { active: true } });
  if (jobs.length === 0) {
    return NextResponse.json({ error: "No active clients" }, { status: 400 });
  }

  // Resolve the inputs into: jobId, date, and either a (start,end) range or
  // a minutes-to-append. Free-form `text` is run through the shared parser.
  let jobId: string | null = null;
  let jobName: string | null = null;
  let date = resolveDate(v.date);
  let startMin: number | null = null;
  let endMin: number | null = null;
  let appendMinutes: number | null = null;
  let description = v.description?.trim() ?? "";

  if (v.text) {
    // Parser localISO uses the runtime's local date; anchor it to Bucharest
    // by handing it a Date that reads as "now" in Bucharest.
    const p = parseQuickLog(
      v.text,
      jobs.map((j) => ({ id: j.id, name: j.name })),
    );
    if (!p.jobId) {
      return NextResponse.json(
        { error: `Couldn't match a client in "${v.text}". Known: ${jobs.map((j) => j.name).join(", ")}` },
        { status: 422 },
      );
    }
    jobId = p.jobId;
    jobName = p.jobName;
    date = v.date ? resolveDate(v.date) : resolveDate(undefined); // prefer explicit
    if (p.date && !v.date) date = p.date;
    if (p.description) description = p.description;
    // A bare duration ("30m netop") accumulates into today's block; an
    // explicit clock range ("9-17 netop") sets a precise block.
    if (p.hasExplicitRange) {
      startMin = p.startMinutes;
      endMin = p.endMinutes;
    } else if (p.durationMinutes != null) {
      appendMinutes = p.durationMinutes;
    } else {
      startMin = p.startMinutes;
      endMin = p.endMinutes;
    }
  } else {
    // Structured. Match client by exact id or fuzzy name.
    const needle = (v.client ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const job =
      jobs.find((j) => j.id === v.client) ??
      jobs.find((j) => j.name.toLowerCase().replace(/[^a-z0-9]/g, "") === needle) ??
      jobs.find((j) => j.name.toLowerCase().replace(/[^a-z0-9]/g, "").startsWith(needle) && needle.length >= 2);
    if (!job) {
      return NextResponse.json(
        { error: `Unknown client "${v.client}". Known: ${jobs.map((j) => j.name).join(", ")}` },
        { status: 422 },
      );
    }
    jobId = job.id;
    jobName = job.name;
    startMin = toMinutes(v.start);
    endMin = toMinutes(v.end);
    if (v.minutes != null && (startMin == null || endMin == null)) {
      appendMinutes = Math.round(v.minutes);
    }
  }

  const job = jobs.find((j) => j.id === jobId)!;
  const rate = job.rateUsd;
  const dayStart = dateAtNoonUTC(date);
  const dayLo = new Date(date + "T00:00:00.000Z");
  const dayHi = new Date(date + "T23:59:59.999Z");

  // ---- APPEND MODE: grow today's block for this client ----
  if (appendMinutes != null) {
    const existing = await db.income.findFirst({
      where: { jobId, date: { gte: dayLo, lte: dayHi }, startMinutes: { not: null } },
      orderBy: { endMinutes: "desc" },
    });
    if (existing && existing.startMinutes != null && existing.endMinutes != null) {
      const newEnd = Math.min(existing.startMinutes + 24 * 60, existing.endMinutes + appendMinutes);
      const hours = (newEnd - existing.startMinutes) / 60;
      const row = await db.income.update({
        where: { id: existing.id },
        data: {
          endMinutes: newEnd,
          hours,
          amountUsd: centsFromUsd(hours * rate),
          description:
            description && !existing.description.includes(description)
              ? `${existing.description}; ${description}`.replace(/^; /, "")
              : existing.description,
        },
      });
      return summary(row, jobName!, jobId!, dayLo, dayHi, "extended");
    }
    // No block yet — start one. Default 09:00 unless a start was given.
    const s = startMin ?? 9 * 60;
    const e = s + appendMinutes;
    const hours = (e - s) / 60;
    const row = await db.income.create({
      data: {
        date: dayStart,
        description: description || `${hours.toFixed(2)}h · ${job.name}`,
        source: job.name,
        jobId,
        startMinutes: s,
        endMinutes: e,
        hours,
        hourlyRate: rate,
        amountUsd: centsFromUsd(hours * rate),
      },
    });
    return summary(row, jobName!, jobId!, dayLo, dayHi, "created");
  }

  // ---- RANGE MODE: explicit start/end ----
  if (startMin == null || endMin == null) {
    return NextResponse.json(
      { error: "Provide either `minutes` (to append) or both `start` and `end`." },
      { status: 422 },
    );
  }
  if (endMin <= startMin) endMin += 24 * 60; // overnight

  // Idempotency: if an identical block already exists for this client+day,
  // return it instead of duplicating (safe to retry a call).
  const dup = await db.income.findFirst({
    where: { jobId, date: { gte: dayLo, lte: dayHi }, startMinutes: startMin, endMinutes: endMin },
  });
  if (dup) return summary(dup, jobName!, jobId!, dayLo, dayHi, "exists");

  const hours = (endMin - startMin) / 60;
  const row = await db.income.create({
    data: {
      date: dayStart,
      description: description || `${hours.toFixed(2)}h · ${job.name}`,
      source: job.name,
      jobId,
      startMinutes: startMin,
      endMinutes: endMin,
      hours,
      hourlyRate: rate,
      amountUsd: centsFromUsd(hours * rate),
    },
  });
  return summary(row, jobName!, jobId!, dayLo, dayHi, "created");
}

/** Build the response: what we logged + the running day total for the client. */
async function summary(
  row: { id: string; startMinutes: number | null; endMinutes: number | null; hours: number | null; date: Date },
  jobName: string,
  jobId: string,
  dayLo: Date,
  dayHi: Date,
  action: "created" | "extended" | "exists",
) {
  const dayRows = await db.income.findMany({
    where: { jobId, date: { gte: dayLo, lte: dayHi } },
    select: { hours: true },
  });
  const dayHours = dayRows.reduce((a, b) => a + (b.hours ?? 0), 0);
  const fmt = (min: number | null) =>
    min == null
      ? "—"
      : `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
  return NextResponse.json({
    ok: true,
    action,
    entry: {
      id: row.id,
      client: jobName,
      date: row.date.toISOString().slice(0, 10),
      start: fmt(row.startMinutes),
      end: fmt(row.endMinutes),
      hours: row.hours,
    },
    dayTotalHours: Math.round(dayHours * 100) / 100,
    message: `${action === "exists" ? "Already logged" : action === "extended" ? "Extended" : "Logged"} ${row.hours}h on ${jobName} — ${Math.round(dayHours * 100) / 100}h total today`,
  });
}
