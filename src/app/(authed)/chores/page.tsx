import { requireUserId } from "@/lib/queries";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/queries";
import {
  assignment,
  isoWeekKey,
  isoWeekParts,
  weekDates,
  weekdayIndex,
  resolvePeople,
} from "@/lib/chores";
import { ChoresBoard } from "@/components/chores/chores-board";

export const dynamic = "force-dynamic";

export default async function ChoresPage() {
  const now = new Date();
  const weekKey = isoWeekKey(now);
  const { week } = isoWeekParts(now);

  const [settings, choreWeek, chores] = await Promise.all([
    getSettings(),
    db.choreWeek.findUnique({ where: { userId_isoWeek: { userId: await requireUserId(), isoWeek: weekKey } } }),
    db.chore.findMany({ orderBy: [{ setId: "asc" }, { day: "asc" }, { position: "asc" }] }),
  ]);

  const flip = settings.choresFlip;
  const days = weekDates(now);
  const next = new Date(now);
  next.setDate(now.getDate() + 7);

  const fmtRange = () => {
    const first = days[0];
    const last = days[6];
    const month = last.toLocaleDateString("ro-RO", { month: "long" });
    return `${first.getDate()}–${last.getDate()} ${month} ${last.getFullYear()}`;
  };

  return (
    <ChoresBoard
      people={resolvePeople(await getSettings())}
      weekKey={weekKey}
      weekRange={fmtRange()}
      assignmentThis={assignment(week, flip)}
      assignmentNext={assignment(isoWeekParts(next).week, flip)}
      done={choreWeek?.done ?? []}
      todayIdx={weekdayIndex(now)}
      dayNums={days.map((d) => d.getDate())}
      flip={flip}
      chores={chores.map((c) => ({
        id: c.id, setId: c.setId, day: c.day, label: c.label, shopping: c.shopping,
      }))}
    />
  );
}
