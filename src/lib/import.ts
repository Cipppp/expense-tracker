/**
 * Import pipeline: parse → filter → dedup → categorize → write.
 *
 * Dedup rules (matches Code.gs `importCsvText`):
 *
 *   1. Exact duplicate INSIDE same CSV (same Started Date + desc + amount) —
 *      skip. Keyed on `sortKey|desc|amount`.
 *
 *   2. Legitimate same-day twin transactions (e.g. two Wolt 17.97 RON orders
 *      one minute apart) — must NOT collapse. Different sortKey means pass.
 *
 *   3. Cross-import duplicate (same transaction in two overlapping CSV
 *      statements) — skip via count-based check: for each `day|desc|amount`,
 *      count existing rows in the DB; only insert when batch count > existing.
 */

import { db } from "@/lib/db";
import {
  baniFromRon,
  centsFromUsd,
  dateAtNoonUTC,
  monthKey,
} from "@/lib/format";
import {
  parseRevolutCsv,
  dayKey,
  type RevolutRow,
} from "@/lib/csv";
import {
  DEFAULT_RULES,
  categorize,
  canonicalMerchant,
  type Rule,
} from "@/lib/categorizer";

export type ImportSummary = {
  filename: string;
  rowsRead: number;
  rowsInserted: number;
  rowsSkipped: number;
  insertedExamples: Array<{ date: string; description: string; amountRon: number }>;
};

/** Group helper: returns "day|desc|amount" key for cross-import dedup. */
function dedupKeyFor(day: string, description: string, amountRon: number): string {
  return `${day}|${description.trim().toLowerCase()}|${amountRon.toFixed(2)}`;
}

export async function importRevolutCsv(
  filename: string,
  text: string,
): Promise<ImportSummary> {
  const all = parseRevolutCsv(text);
  const eligible: RevolutRow[] = all.filter(
    (r) =>
      r.state.toUpperCase() === "COMPLETED" &&
      r.currency.toUpperCase() === "RON" &&
      r.amount < 0, // only expenses
  );

  const settings = await db.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  const rulesRaw = await db.categoryRule.findMany();
  const rules: Rule[] =
    rulesRaw.length > 0
      ? rulesRaw.map((r) => ({ keyword: r.keyword, category: r.category, priority: r.priority }))
      : DEFAULT_RULES;

  // -------- Pass 1: within-CSV exact-duplicate skip --------
  const seenInBatch = new Set<string>();
  const within: RevolutRow[] = [];
  for (const r of eligible) {
    const k = `${r.startedDate}|${r.description}|${r.amount.toFixed(2)}`;
    if (seenInBatch.has(k)) continue;
    seenInBatch.add(k);
    within.push(r);
  }

  // -------- Pass 2: cross-import count-based dedup --------
  // Build per-key batch counts.
  const batchCounts = new Map<string, number>();
  for (const r of within) {
    const k = dedupKeyFor(dayKey(r.startedDate), r.description, Math.abs(r.amount));
    batchCounts.set(k, (batchCounts.get(k) ?? 0) + 1);
  }

  // Existing counts for the same keys.
  const existingCounts = new Map<string, number>();
  const keys = Array.from(batchCounts.keys());
  if (keys.length > 0) {
    const existing = await db.expense.findMany({
      where: { dedupKey: { in: keys } },
      select: { dedupKey: true },
    });
    for (const e of existing) {
      existingCounts.set(e.dedupKey, (existingCounts.get(e.dedupKey) ?? 0) + 1);
    }
  }

  // -------- Pass 3: build insert payload --------
  const usedSlots = new Map<string, number>(); // already used in this insert pass
  const toInsert = [] as Array<{
    date: Date;
    description: string;
    category: string;
    amountRon: number;
    amountUsd: number;
    fxRate: number;
    merchant: string;
    source: string;
    dedupKey: string;
    sortKey: string;
  }>;

  for (const r of within) {
    const day = dayKey(r.startedDate);
    const absRon = Math.abs(r.amount);
    const k = dedupKeyFor(day, r.description, absRon);
    const used = usedSlots.get(k) ?? 0;
    const existing = existingCounts.get(k) ?? 0;
    const batchTotal = batchCounts.get(k) ?? 0;

    // We insert this row only if there's still a "slot" not already filled
    // by an existing DB row. used + existing < batchTotal means yes.
    if (used + existing >= batchTotal) continue;

    usedSlots.set(k, used + 1);

    const amountRonBani = baniFromRon(absRon);
    const amountUsdCents = centsFromUsd(absRon * settings.fxRonToUsd);
    const merchant = canonicalMerchant(r.description);
    const category = categorize(r.description, rules);
    const date = dateAtNoonUTC(day);

    toInsert.push({
      date,
      description: r.description,
      category,
      amountRon: amountRonBani,
      amountUsd: amountUsdCents,
      fxRate: settings.fxRonToUsd,
      merchant,
      source: "revolut",
      dedupKey: k,
      sortKey: r.startedDate,
    });
  }

  // Refund-pair removal: if a positive inflow exists with matching desc/amount
  // within ±1 day, drop the negative. The CSV already filters out positive
  // amounts; this is a placeholder for future inclusion of inflows.

  if (toInsert.length > 0) {
    await db.expense.createMany({ data: toInsert });
  }

  const summary: ImportSummary = {
    filename,
    rowsRead: all.length,
    rowsInserted: toInsert.length,
    rowsSkipped: eligible.length - toInsert.length,
    insertedExamples: toInsert.slice(0, 5).map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      description: r.description,
      amountRon: r.amountRon,
    })),
  };

  await db.importBatch.create({
    data: {
      filename,
      rowsRead: summary.rowsRead,
      rowsInsert: summary.rowsInserted,
      rowsSkipped: summary.rowsSkipped,
    },
  });

  return summary;
}

export { monthKey };
