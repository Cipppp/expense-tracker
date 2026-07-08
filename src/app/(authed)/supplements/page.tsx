import { db } from "@/lib/db";
import { bucharestDay } from "@/lib/supplements";
import { SupplementsBoard, type LogRow } from "@/components/supplements/supplements-board";

export const dynamic = "force-dynamic";

export default async function SupplementsPage() {
  const today = bucharestDay(new Date());
  // Last 14 days cover the metrics strip plus a bit of back-navigation.
  const from = bucharestDay(new Date(Date.now() - 13 * 86400000));

  const logs = await db.supplementLog.findMany({
    where: { day: { gte: from, lte: today } },
    select: { day: true, person: true, key: true, count: true, updatedAt: true },
  });

  const rows: LogRow[] = logs.map((l) => ({
    day: l.day,
    person: l.person as "cip" | "axy",
    key: l.key,
    count: l.count,
    updatedAt: l.updatedAt.toISOString(),
  }));

  return <SupplementsBoard initialLogs={rows} today={today} />;
}
