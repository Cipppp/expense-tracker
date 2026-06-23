import { db } from "@/lib/db";
import { presignGet, photosConfigured } from "@/lib/s3";
import {
  GratitudeList,
  type Group,
  type Memory,
  type Recap,
} from "@/components/gratitude/gratitude-list";

export const dynamic = "force-dynamic";

const TZ = "Europe/Bucharest";
const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ }); // yyyy-mm-dd
const timeLabel = (d: Date) =>
  d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit", timeZone: TZ });

function relativeLabel(then: Date, now: Date): string {
  const days = Math.round((now.getTime() - then.getTime()) / 86400000);
  if (days >= 360) return `acum ${Math.round(days / 365)} an${days >= 720 ? "i" : ""}`;
  if (days >= 60) return `acum ${Math.round(days / 30)} luni`;
  if (days >= 28) return "acum o lună";
  if (days >= 14) return `acum ${Math.round(days / 7)} săptămâni`;
  if (days >= 7) return "acum o săptămână";
  return `acum ${days} zile`;
}

export default async function GratitudePage() {
  const items = await db.gratitudeItem.findMany({
    orderBy: { createdAt: "desc" },
    include: { reactions: { select: { person: true, emoji: true } } },
  });

  const now = new Date();
  const todayKey = dayKey(now);
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  const yestKey = dayKey(y);

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
      hasPhoto: Boolean(it.photoKey),
      photoUrl: null,
      pinned: it.pinned,
      tags: it.tags,
      reactions: it.reactions.map((r) => ({
        person: r.person as "cip" | "axy",
        emoji: r.emoji,
      })),
      _photoKey: it.photoKey ?? null,
    });
  }

  if (photosConfigured) {
    const withPhoto = groups.flatMap((g) => g.items).filter((i) => i._photoKey);
    await Promise.all(
      withPhoto.map(async (i) => {
        i.photoUrl = await presignGet(i._photoKey as string).catch(() => null);
      }),
    );
  }
  for (const g of groups) for (const i of g.items) delete i._photoKey;

  // --- Streak: consecutive days (ending today or yesterday) with an entry ---
  const dayset = new Set(items.map((it) => dayKey(it.createdAt)));
  let streak = 0;
  {
    const cur = new Date(now);
    if (!dayset.has(dayKey(cur))) cur.setDate(cur.getDate() - 1); // grace: today not yet logged
    while (dayset.has(dayKey(cur))) {
      streak++;
      cur.setDate(cur.getDate() - 1);
    }
  }

  // --- Memory: an entry older than a week, rotating daily ---
  let memory: Memory | null = null;
  {
    const old = items.filter(
      (it) => now.getTime() - it.createdAt.getTime() > 7 * 86400000,
    );
    if (old.length > 0) {
      const dayOfYear = Math.floor(
        (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000,
      );
      const pick = old[dayOfYear % old.length];
      memory = {
        text: pick.text,
        author: (pick.author as "cip" | "axy" | null) ?? null,
        when: relativeLabel(pick.createdAt, now),
      };
    }
  }

  // --- This-month recap ---
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthItems = items.filter((it) => it.createdAt >= monthStart);
  const recap: Recap = {
    month: now.toLocaleDateString("ro-RO", { month: "long", timeZone: TZ }),
    count: monthItems.length,
    cip: monthItems.filter((i) => i.author === "cip").length,
    axy: monthItems.filter((i) => i.author === "axy").length,
    photos: monthItems.filter((i) => i.photoKey).length,
  };

  return (
    <GratitudeList
      groups={groups}
      total={total}
      streak={streak}
      memory={memory}
      recap={recap}
    />
  );
}
