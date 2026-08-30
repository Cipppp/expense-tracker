import { db } from "@/lib/db";
import { bucharestDay, type Supplement } from "@/lib/supplements";
import { SupplementsBoard, type LogRow } from "@/components/supplements/supplements-board";

export const dynamic = "force-dynamic";

export default async function SupplementsPage() {
  const today = bucharestDay(new Date());
  // Last 14 days cover the metrics strip plus a bit of back-navigation.
  const from = bucharestDay(new Date(Date.now() - 13 * 86400000));

  const [logs, catalog] = await Promise.all([
    db.supplementLog.findMany({
      where: { day: { gte: from, lte: today } },
      select: { day: true, person: true, key: true, count: true, updatedAt: true },
    }),
    db.supplement.findMany({ orderBy: { position: "asc" } }),
  ]);

  const rows: LogRow[] = logs.map((l) => ({
    day: l.day,
    person: l.person as "cip" | "axy",
    key: l.key,
    count: l.count,
    updatedAt: l.updatedAt.toISOString(),
  }));

  return (
    <SupplementsBoard
      initialLogs={rows}
      today={today}
      catalog={catalog.map((c) => ({
        key: c.key, name: c.name, brand: c.brand, short: c.short,
        benefits: c.benefits, unit: c.unit, target: c.target,
        timing: c.timing as Supplement["timing"],
        timingNote: c.timingNote, foodNote: c.foodNote,
        composition: c.composition, interactions: c.interactions,
        cautions: c.cautions, daily: c.daily,
        suggestedFor: (c.suggestedFor ?? undefined) as Supplement["suggestedFor"],
        contributes: (c.contributes ?? undefined) as Supplement["contributes"],
      }))}
    />
  );
}
