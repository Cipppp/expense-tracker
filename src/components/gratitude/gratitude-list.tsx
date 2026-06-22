"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, Plus, Trash2 } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { PEOPLE, type PersonKey } from "@/lib/chores";
import { EnableNotifications } from "@/components/push/enable-notifications";

export type Item = {
  id: string;
  text: string;
  author: PersonKey | null;
  time: string;
  seq: number;
};
export type Group = { key: string; label: string; items: Item[] };

const AUTHOR_KEY = "gratitude:author";

export function GratitudeList({
  groups: initialGroups,
  total: initialTotal,
}: {
  groups: Group[];
  total: number;
}) {
  const [groups, setGroups] = useState<Group[]>(initialGroups);
  const [total, setTotal] = useState(initialTotal);
  const [text, setText] = useState("");
  const [author, setAuthor] = useState<PersonKey | null>(null);
  const [saving, setSaving] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Remember who's adding, per device.
  useEffect(() => {
    try {
      const a = localStorage.getItem(AUTHOR_KEY);
      if (a === "cip" || a === "axy") setAuthor(a);
    } catch {
      /* ignore */
    }
  }, []);
  function pickAuthor(a: PersonKey) {
    const next = author === a ? null : a;
    setAuthor(next);
    try {
      if (next) localStorage.setItem(AUTHOR_KEY, next);
      else localStorage.removeItem(AUTHOR_KEY);
    } catch {
      /* ignore */
    }
  }

  async function add() {
    const value = text.trim();
    if (!value || saving) return;
    setSaving(true);
    const tempId = `tmp-${Date.now()}`;
    const time = new Date().toLocaleTimeString("ro-RO", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const optimistic: Item = { id: tempId, text: value, author, time, seq: total + 1 };

    // Prepend into today's group ("Azi"), creating it if needed.
    setGroups((gs) => {
      const next = [...gs];
      if (next[0]?.label === "Azi") {
        next[0] = { ...next[0], items: [optimistic, ...next[0].items] };
      } else {
        next.unshift({ key: "today", label: "Azi", items: [optimistic] });
      }
      return next;
    });
    setTotal((t) => t + 1);
    setText("");
    taRef.current?.focus();

    try {
      const res = await fetch("/api/gratitude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value, author }),
      });
      if (!res.ok) throw new Error();
      const { item } = await res.json();
      // Swap the temp id for the real one.
      setGroups((gs) =>
        gs.map((g) => ({
          ...g,
          items: g.items.map((it) =>
            it.id === tempId ? { ...it, id: item.id } : it,
          ),
        })),
      );
    } catch {
      setGroups((gs) =>
        gs
          .map((g) => ({ ...g, items: g.items.filter((it) => it.id !== tempId) }))
          .filter((g) => g.items.length > 0),
      );
      setTotal((t) => t - 1);
      setText(value);
      toast.error("N-am putut salva");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    let removed: { group: Group; item: Item; idx: number } | null = null;
    setGroups((gs) =>
      gs
        .map((g) => {
          const idx = g.items.findIndex((it) => it.id === id);
          if (idx >= 0) removed = { group: g, item: g.items[idx], idx };
          return { ...g, items: g.items.filter((it) => it.id !== id) };
        })
        .filter((g) => g.items.length > 0),
    );
    setTotal((t) => Math.max(0, t - 1));
    try {
      const res = await fetch(`/api/gratitude/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      toast.error("N-am putut șterge");
      if (removed) {
        // best-effort restore
        setGroups((gs) => gs); // state already mutated; reload to be safe
        location.reload();
      }
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      add();
    }
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <header>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-muted-foreground">
          <Heart weight="fill" className="h-3.5 w-3.5 text-accent" />
          Recunoștință
        </div>
        <h1 className="mt-1 font-display text-2xl sm:text-4xl tracking-tight">
          Pentru ce merită să fim fericiți împreună
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {total === 0
            ? "Adaugă primul motiv de mai jos."
            : `${total} ${total === 1 ? "motiv" : "de motive"} până acum · câte unul în fiecare zi.`}
        </p>
        <div className="mt-3">
          <EnableNotifications />
        </div>
      </header>

      {/* Add box */}
      <Card>
        <CardContent className="p-3 sm:p-4 space-y-3">
          <textarea
            ref={taRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            maxLength={500}
            placeholder="Pentru ce ești recunoscător azi?"
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {(["cip", "axy"] as PersonKey[]).map((pk) => {
                const p = PEOPLE[pk];
                const on = author === pk;
                return (
                  <button
                    key={pk}
                    type="button"
                    onClick={() => pickAuthor(pk)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                      on ? "text-white" : "text-muted-foreground hover:bg-secondary",
                    )}
                    style={
                      on
                        ? { backgroundColor: p.color, borderColor: p.color }
                        : { borderColor: `${p.color}55` }
                    }
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: on ? "#fff" : p.color }}
                    />
                    {p.name}
                  </button>
                );
              })}
            </div>
            <Button
              variant="accent"
              size="sm"
              onClick={add}
              disabled={saving || text.trim().length === 0}
            >
              <Plus className="h-4 w-4" />
              Adaugă
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Entries */}
      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-6 py-16 text-center">
          <Heart className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            Încă nimic pe listă. Primul lucru frumos începe aici.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.key} className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
                  {g.label}
                </span>
                <span className="h-px flex-1 bg-border" />
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {g.items.length}
                </span>
              </div>
              <ul className="space-y-2">
                {g.items.map((it) => {
                  const p = it.author ? PEOPLE[it.author] : null;
                  const accent = p ? p.color : "hsl(var(--accent))";
                  const soft = p ? p.soft : "hsl(var(--accent) / 0.10)";
                  return (
                    <li
                      key={it.id}
                      className="group relative flex items-start gap-3 rounded-xl border border-border bg-card px-3 py-2.5 animate-fade-in transition-all duration-200 ease-expo hover:border-foreground/20 hover:shadow-sm"
                    >
                      {/* number badge */}
                      <span
                        className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold tabular-nums ring-1 ring-inset"
                        style={{ backgroundColor: soft, color: accent, boxShadow: `inset 0 0 0 1px ${accent}22` }}
                      >
                        {it.seq}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-[15px] leading-snug tracking-tight pr-6">
                          {it.text}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
                          {p && (
                            <span
                              className="inline-flex items-center gap-1 font-medium"
                              style={{ color: p.color }}
                            >
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ backgroundColor: p.color }}
                              />
                              {p.name}
                            </span>
                          )}
                          {p && <span aria-hidden>·</span>}
                          <span className="tabular-nums">{it.time}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(it.id)}
                        aria-label="Șterge"
                        className="absolute right-1.5 top-1.5 h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground/0 group-hover:text-muted-foreground/70 hover:bg-secondary hover:!text-destructive transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
