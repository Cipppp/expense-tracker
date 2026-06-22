import { db } from "@/lib/db";
import { GratitudeList, type Group } from "@/components/gratitude/gratitude-list";

export const dynamic = "force-dynamic";

const TZ = "Europe/Bucharest";
const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ }); // yyyy-mm-dd
const timeLabel = (d: Date) =>
  d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit", timeZone: TZ });

export default async function GratitudePage() {
  const items = await db.gratitudeItem.findMany({
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();
  const todayKey = dayKey(now);
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  const yestKey = dayKey(y);

  // Group newest-first by Bucharest calendar day, with friendly labels.
  // Number chronologically: oldest = #1, newest = #total, and each entry keeps
  // its number forever as new ones are added on top.
  const total = items.length;
  let seq = total;
  const groups: Group[] = [];
  for (const it of items) {
    const key = dayKey(it.createdAt);
    const last = groups[groups.length - 1];
    let group: Group;
    if (last && last.key === key) {
      group = last;
    } else {
      const label: string =
        key === todayKey
          ? "Azi"
          : key === yestKey
            ? "Ieri"
            : it.createdAt.toLocaleDateString("ro-RO", {
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: TZ,
              });
      group = { key, label, items: [] };
      groups.push(group);
    }
    group.items.push({
      id: it.id,
      text: it.text,
      author: (it.author as "cip" | "axy" | null) ?? null,
      time: timeLabel(it.createdAt),
      seq: seq--,
    });
  }

  return <GratitudeList groups={groups} total={total} />;
}
