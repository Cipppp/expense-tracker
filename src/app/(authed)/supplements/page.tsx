import { resolvePeople } from "@/lib/chores";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/queries";
import { bucharestDay, type Supplement } from "@/lib/supplements";
import { SupplementsBoard, type LogRow } from "@/components/supplements/supplements-board";

export const dynamic = "force-dynamic";

export default async function SupplementsPage() {
  // O singură citire de ceas pentru ambele capete: două apeluri separate pot
  // cădea de o parte și de alta a miezului nopții, și-atunci intervalul iese
  // de 13 zile sau de 15.
  const now = new Date();
  const today = bucharestDay(now);
  // Last 14 days cover the metrics strip plus a bit of back-navigation.
  const from = bucharestDay(new Date(now.getTime() - 13 * 86400000));

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
      people={resolvePeople(await getSettings())}
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
