import { db } from "@/lib/db";
import {
  assignment,
  isoWeekKey,
  isoWeekParts,
  weekDates,
  weekdayIndex,
} from "@/lib/chores";
import { ChoresBoard } from "@/components/chores/chores-board";

export const dynamic = "force-dynamic";

export default async function ChoresPage() {
  const now = new Date();
  const weekKey = isoWeekKey(now);
  const { week } = isoWeekParts(now);

  const [settings, choreWeek] = await Promise.all([
    db.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }),
    db.choreWeek.findUnique({ where: { isoWeek: weekKey } }),
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
      weekKey={weekKey}
      weekRange={fmtRange()}
      assignmentThis={assignment(week, flip)}
      assignmentNext={assignment(isoWeekParts(next).week, flip)}
      done={choreWeek?.done ?? []}
      todayIdx={weekdayIndex(now)}
      dayNums={days.map((d) => d.getDate())}
      flip={flip}
    />
  );
}
