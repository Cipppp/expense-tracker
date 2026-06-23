import "server-only";
import { db } from "@/lib/db";
import { presignGet, photosConfigured } from "@/lib/s3";
import type { PersonKey } from "@/lib/chores";

const TZ = "Europe/Bucharest";
const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });
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

export type Reaction = { person: PersonKey; emoji: string };
export type Item = {
  id: string;
  text: string;
  author: PersonKey | null;
  time: string;
  seq: number;
  hasPhoto: boolean;
  photoUrl: string | null;
  pinned: boolean;
  tags: string[];
  reactions: Reaction[];
};
export type Group = { key: string; label: string; items: Item[] };
export type Memory = { text: string; author: PersonKey | null; when: string };
export type Recap = { month: string; count: number; cip: number; axy: number; photos: number };
export type GratitudeFeed = {
  groups: Group[];
  total: number;
  streak: number;
  memory: Memory | null;
  recap: Recap;
};

/** Build the full gratitude feed (grouped entries + streak/memory/recap), with
 * short-lived signed photo URLs. Shared by the page and the polling endpoint. */
export async function buildGratitudeFeed(): Promise<GratitudeFeed> {
  const rows = await db.gratitudeItem.findMany({
    orderBy: { createdAt: "desc" },
    include: { reactions: { select: { person: true, emoji: true } } },
  });

  const now = new Date();
  const todayKey = dayKey(now);
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  const yestKey = dayKey(y);

  const total = rows.length;
  let seq = total;
  const groups: Group[] = [];
  const keyByItem = new Map<string, string | null>();
  for (const it of rows) {
    const key = dayKey(it.createdAt);
    const last = groups[groups.length - 1];
    let group: Group;
    if (last && last.key === key) {
      group = last;
    } else {
      const label =
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
    keyByItem.set(it.id, it.photoKey ?? null);
    group.items.push({
      id: it.id,
      text: it.text,
      author: (it.author as PersonKey | null) ?? null,
      time: timeLabel(it.createdAt),
      seq: seq--,
      hasPhoto: Boolean(it.photoKey),
      photoUrl: null,
      pinned: it.pinned,
      tags: it.tags,
      reactions: it.reactions.map((r) => ({ person: r.person as PersonKey, emoji: r.emoji })),
    });
  }

  if (photosConfigured) {
    await Promise.all(
      groups.flatMap((g) => g.items).map(async (i) => {
        const k = keyByItem.get(i.id);
        if (k) i.photoUrl = await presignGet(k).catch(() => null);
      }),
    );
  }

  // Streak: consecutive days (ending today or yesterday) with an entry.
  const dayset = new Set(rows.map((it) => dayKey(it.createdAt)));
  let streak = 0;
  const cur = new Date(now);
  if (!dayset.has(dayKey(cur))) cur.setDate(cur.getDate() - 1);
  while (dayset.has(dayKey(cur))) {
    streak++;
    cur.setDate(cur.getDate() - 1);
  }

  // Memory: an entry older than a week, rotating daily.
  let memory: Memory | null = null;
  const old = rows.filter((it) => now.getTime() - it.createdAt.getTime() > 7 * 86400000);
  if (old.length > 0) {
    const dayOfYear = Math.floor(
      (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000,
    );
    const pick = old[dayOfYear % old.length];
    memory = {
      text: pick.text,
      author: (pick.author as PersonKey | null) ?? null,
      when: relativeLabel(pick.createdAt, now),
    };
  }

  // This-month recap.
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthItems = rows.filter((it) => it.createdAt >= monthStart);
  const recap: Recap = {
    month: now.toLocaleDateString("ro-RO", { month: "long", timeZone: TZ }),
    count: monthItems.length,
    cip: monthItems.filter((i) => i.author === "cip").length,
    axy: monthItems.filter((i) => i.author === "axy").length,
    photos: monthItems.filter((i) => i.photoKey).length,
  };

  return { groups, total, streak, memory, recap };
}
