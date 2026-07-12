"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sparkle,
  Plus,
  Trash2,
  Pencil,
  Camera,
  X,
  Loader2,
  PushPin,
  Smiley,
  Search,
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import { PEOPLE, type PersonKey } from "@/lib/chores";
import type {
  GratitudeFeed,
  Group,
  Item,
  Memory,
  Reaction,
} from "@/lib/gratitude";

const AUTHOR_KEY = "gratitude:author";

// Generous "any reaction" set, WhatsApp-style.
const EMOJIS = [
  "❤️","😍","🥰","😘","🤗","😂","😊","👍","🔥","🎉","✨","🙏","💪","👏","🥳","😅",
  "😎","🤩","😢","😭","🥹","😴","🙃","😋","🤤","🫶","💖","💕","💯","⭐","🌟","🌈",
  "☀️","🌹","🌸","🍀","🎁","🍕","🍺","☕","🏠","✈️","🚗","💍","🤍","💙","💜","🧡",
];

const TAG_COLORS = ["#3f6fb0", "#b5739d", "#2f8f6b", "#c0863a", "#7b5ea7", "#c25b5b", "#3a8ab0"];
function tagColor(t: string): string {
  let h = 0;
  for (const c of t) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TAG_COLORS[h % TAG_COLORS.length];
}

export function GratitudeList({
  groups: initialGroups,
  total: initialTotal,
  streak: initialStreak,
  memory: initialMemory,
  recap: initialRecap,
}: GratitudeFeed) {
  const [groups, setGroups] = useState<Group[]>(initialGroups);
  const [total, setTotal] = useState(initialTotal);
  const [streak, setStreak] = useState(initialStreak);
  const [memory, setMemory] = useState<Memory | null>(initialMemory);
  const [recap, setRecap] = useState(initialRecap);
  const [text, setText] = useState("");
  const [author, setAuthor] = useState<PersonKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [tagsDraft, setTagsDraft] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ id: string; url: string } | null>(null);
  const [reactingId, setReactingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filterPerson, setFilterPerson] = useState<"all" | PersonKey>("all");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingPhotoId = useRef<string | null>(null);

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

  // Near-real-time: poll the feed every ~8s while the tab is visible and the
  // user isn't mid-edit/save/upload (so we never clobber in-flight work).
  // React reconciles by id, so unchanged cards don't flicker.
  useEffect(() => {
    let stopped = false;
    async function poll() {
      if (document.hidden || editingId || saving || uploadingId) return;
      try {
        const res = await fetch("/api/gratitude/feed", { cache: "no-store" });
        if (!res.ok || stopped) return;
        const feed: GratitudeFeed = await res.json();
        if (stopped) return;
        setGroups(feed.groups);
        setTotal(feed.total);
        setStreak(feed.streak);
        setMemory(feed.memory);
        setRecap(feed.recap);
      } catch {
        /* ignore transient errors */
      }
    }
    const id = setInterval(poll, 8000);
    const onVisible = () => {
      if (!document.hidden) poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [editingId, saving, uploadingId]);

  function patchItem(id: string, patch: Partial<Item>) {
    setGroups((gs) =>
      gs.map((g) => ({
        ...g,
        items: g.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
      })),
    );
  }

  // --- add ----------------------------------------------------------------
  async function add() {
    const value = text.trim();
    if (!value || saving) return;
    setSaving(true);
    const tempId = `tmp-${Date.now()}`;
    const time = new Date().toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
    const optimistic: Item = {
      id: tempId, text: value, author, time, seq: total + 1,
      hasPhoto: false, photoUrl: null, pinned: false, tags: [], reactions: [],
    };
    setGroups((gs) => {
      const next = [...gs];
      if (next[0]?.label === "Azi") next[0] = { ...next[0], items: [optimistic, ...next[0].items] };
      else next.unshift({ key: "today", label: "Azi", items: [optimistic] });
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
      setGroups((gs) =>
        gs.map((g) => ({
          ...g,
          items: g.items.map((it) => (it.id === tempId ? { ...it, id: item.id } : it)),
        })),
      );
    } catch {
      setGroups((gs) =>
        gs.map((g) => ({ ...g, items: g.items.filter((it) => it.id !== tempId) })).filter((g) => g.items.length > 0),
      );
      setTotal((t) => t - 1);
      setText(value);
      toast.error("N-am putut salva");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setGroups((gs) =>
      gs.map((g) => ({ ...g, items: g.items.filter((it) => it.id !== id) })).filter((g) => g.items.length > 0),
    );
    setTotal((t) => Math.max(0, t - 1));
    try {
      const res = await fetch(`/api/gratitude/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      toast.error("N-am putut șterge");
      location.reload();
    }
  }

  // --- edit (text + tags) -------------------------------------------------
  function startEdit(it: Item) {
    setEditingId(it.id);
    setDraft(it.text);
    setTagsDraft(it.tags);
    setTagInput("");
  }
  function cancelEdit() {
    setEditingId(null);
    setDraft("");
    setTagsDraft([]);
    setTagInput("");
  }
  function addTag() {
    const t = tagInput.trim().replace(/^#/, "");
    if (!t) return;
    if (!tagsDraft.includes(t) && tagsDraft.length < 8) setTagsDraft((ts) => [...ts, t]);
    setTagInput("");
  }
  async function saveEdit(id: string) {
    const value = draft.trim();
    if (!value) return;
    const tags = tagsDraft;
    patchItem(id, { text: value, tags });
    const editedId = id;
    cancelEdit();
    try {
      const res = await fetch(`/api/gratitude/${editedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value, tags }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast.error("N-am putut salva modificarea");
      location.reload();
    }
  }

  // --- pin ----------------------------------------------------------------
  async function togglePin(it: Item) {
    const next = !it.pinned;
    patchItem(it.id, { pinned: next });
    try {
      const res = await fetch(`/api/gratitude/${it.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      patchItem(it.id, { pinned: !next });
      toast.error("N-am putut fixa");
    }
  }

  // --- reactions ----------------------------------------------------------
  async function react(id: string, emoji: string) {
    setReactingId(null);
    if (!author) {
      toast.error("Alege întâi cine ești (Cip / Axy), sus în casetă.");
      return;
    }
    // optimistic: replace this person's reaction, or toggle off if same emoji
    let prev: Reaction[] = [];
    for (const g of groups) {
      const f = g.items.find((it) => it.id === id);
      if (f) prev = f.reactions;
    }
    const mineSame = prev.some((r) => r.person === author && r.emoji === emoji);
    const without = prev.filter((r) => r.person !== author);
    const nextReactions = mineSame ? without : [...without, { person: author, emoji }];
    patchItem(id, { reactions: nextReactions });
    try {
      const res = await fetch(`/api/gratitude/${id}/reaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person: author, emoji }),
      });
      if (!res.ok) throw new Error();
      const { reactions } = await res.json();
      patchItem(id, { reactions });
    } catch {
      patchItem(id, { reactions: prev });
      toast.error("N-am putut reacționa");
    }
  }

  // --- photos -------------------------------------------------------------
  async function downscale(file: File, maxDim = 1600, quality = 0.82): Promise<Blob> {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = url;
      });
      let w = img.naturalWidth || img.width;
      let h = img.naturalHeight || img.height;
      if (w > maxDim || h > maxDim) {
        const s = Math.min(maxDim / w, maxDim / h);
        w = Math.round(w * s);
        h = Math.round(h * s);
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no ctx");
      ctx.drawImage(img, 0, 0, w, h);
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
      if (!blob) throw new Error("encode failed");
      return blob;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  function pickPhoto(id: string) {
    pendingPhotoId.current = id;
    fileRef.current?.click();
  }
  async function onPhotoChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const id = pendingPhotoId.current;
    e.target.value = "";
    if (!file || !id) return;
    setUploadingId(id);
    try {
      const blob = await downscale(file);
      const fd = new FormData();
      fd.append("photo", new File([blob], "photo.jpg", { type: "image/jpeg" }));
      const res = await fetch(`/api/gratitude/${id}/photo`, { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error);
      }
      const { photoUrl } = await res.json();
      patchItem(id, { hasPhoto: true, photoUrl });
      toast.success("Poză adăugată");
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "N-am putut încărca poza");
    } finally {
      setUploadingId(null);
    }
  }
  async function removePhoto(id: string) {
    patchItem(id, { hasPhoto: false, photoUrl: null });
    setLightbox(null);
    try {
      const res = await fetch(`/api/gratitude/${id}/photo`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Poză ștearsă");
    } catch {
      toast.error("N-am putut șterge poza");
      location.reload();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      add();
    }
  }
  function onEditKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>, id: string) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      saveEdit(id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
  }

  // --- derived: search/filter, pinned ------------------------------------
  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () => (it: Item) => {
      if (filterPerson !== "all" && it.author !== filterPerson) return false;
      if (!q) return true;
      return (
        it.text.toLowerCase().includes(q) ||
        it.tags.some((t) => t.toLowerCase().includes(q))
      );
    },
    [q, filterPerson],
  );

  const allItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const pinned = allItems.filter((i) => i.pinned && matches(i)).sort((a, b) => b.seq - a.seq);
  const filteredGroups = groups
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.pinned && matches(i)) }))
    .filter((g) => g.items.length > 0);
  const filtering = q !== "" || filterPerson !== "all";
  const nothing = pinned.length === 0 && filteredGroups.length === 0;

  // Plain render function (NOT a component) so editing inputs keep focus
  // across re-renders.
  function renderEntry(it: Item) {
    const p = it.author ? PEOPLE[it.author] : null;
    const accent = p ? p.color : "hsl(var(--accent))";
    const soft = p ? p.soft : "hsl(var(--accent) / 0.10)";
    const editing = editingId === it.id;

    // aggregate reactions by emoji
    const agg: { emoji: string; count: number; mine: boolean }[] = [];
    for (const r of it.reactions) {
      const e = agg.find((a) => a.emoji === r.emoji);
      if (e) e.count++;
      else agg.push({ emoji: r.emoji, count: 1, mine: false });
      if (author && r.person === author) {
        const me = agg.find((a) => a.emoji === r.emoji)!;
        me.mine = true;
      }
    }

    return (
      <li
        key={it.id}
        className={cn(
          "group relative rounded-xl border bg-card px-3 py-2.5 animate-fade-in transition-all duration-200 ease-expo hover:shadow-sm",
          it.pinned ? "border-accent/40" : "border-border hover:border-foreground/20",
        )}
      >
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold tabular-nums"
            style={{ backgroundColor: soft, color: accent, boxShadow: `inset 0 0 0 1px ${accent}22` }}
          >
            {it.seq}
          </span>
          <div className="min-w-0 flex-1">
            {editing ? (
              <div className="space-y-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => onEditKeyDown(e, it.id)}
                  rows={2}
                  maxLength={500}
                  autoFocus
                  className="w-full resize-none rounded-md border border-input bg-background px-2 py-1.5 font-display text-[15px] leading-snug outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {/* tag editor */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {tagsDraft.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                      style={{ backgroundColor: `${tagColor(t)}1a`, color: tagColor(t) }}
                    >
                      {t}
                      <button
                        type="button"
                        onClick={() => setTagsDraft((ts) => ts.filter((x) => x !== t))}
                        className="opacity-70 hover:opacity-100"
                        aria-label="Scoate eticheta"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    onBlur={addTag}
                    placeholder="+ etichetă"
                    className="w-24 rounded-full border border-dashed border-border bg-transparent px-2 py-0.5 text-[11px] outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="accent"
                    className="h-7 px-2.5 text-xs"
                    onClick={() => saveEdit(it.id)}
                    disabled={draft.trim().length === 0}
                  >
                    Salvează
                  </Button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                  >
                    Anulează
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="font-display text-[15px] leading-snug tracking-tight">
                  {it.text}
                </p>
                {it.tags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {it.tags.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setQuery(t)}
                        className="rounded-full px-2 py-0.5 text-[10.5px] font-medium transition-opacity hover:opacity-80"
                        style={{ backgroundColor: `${tagColor(t)}1a`, color: tagColor(t) }}
                      >
                        #{t}
                      </button>
                    ))}
                  </div>
                )}
                {it.hasPhoto && it.photoUrl && (
                  <button
                    type="button"
                    onClick={() => setLightbox({ id: it.id, url: it.photoUrl! })}
                    className="mt-2 block overflow-hidden rounded-lg border border-border transition-opacity hover:opacity-90"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={it.photoUrl} alt="" loading="lazy" className="max-h-56 w-full object-cover" />
                  </button>
                )}
                {/* reactions */}
                {agg.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {agg.map((a) => (
                      <button
                        key={a.emoji}
                        type="button"
                        onClick={() => react(it.id, a.emoji)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors",
                          a.mine
                            ? "border-accent/50 bg-accent/10"
                            : "border-border bg-secondary/50 hover:bg-secondary",
                        )}
                      >
                        <span>{a.emoji}</span>
                        {a.count > 1 && (
                          <span className="text-[10px] tabular-nums text-muted-foreground">
                            {a.count}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {/* meta + actions */}
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground min-w-0">
                    {it.pinned && <PushPin weight="fill" className="h-3 w-3 text-accent shrink-0" />}
                    {p && (
                      <span className="inline-flex items-center gap-1 font-medium" style={{ color: p.color }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                        {p.name}
                      </span>
                    )}
                    {p && <span aria-hidden>·</span>}
                    <span className="tabular-nums">{it.time}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5 text-muted-foreground">
                    <ActionBtn label="Reacționează" onClick={() => setReactingId(it.id)}>
                      <Smiley className="h-4 w-4" />
                    </ActionBtn>
                    <ActionBtn
                      label={it.hasPhoto ? "Schimbă poza" : "Adaugă poză"}
                      onClick={() => pickPhoto(it.id)}
                      disabled={uploadingId === it.id}
                    >
                      {uploadingId === it.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-accent" />
                      ) : (
                        <Camera className="h-4 w-4" />
                      )}
                    </ActionBtn>
                    <ActionBtn label={it.pinned ? "Anulează fixarea" : "Fixează"} onClick={() => togglePin(it)}>
                      <PushPin className={cn("h-4 w-4", it.pinned && "text-accent")} weight={it.pinned ? "fill" : "regular"} />
                    </ActionBtn>
                    <ActionBtn label="Editează" onClick={() => startEdit(it)}>
                      <Pencil className="h-4 w-4" />
                    </ActionBtn>
                    <ActionBtn label="Șterge" danger onClick={() => remove(it.id)}>
                      <Trash2 className="h-4 w-4" />
                    </ActionBtn>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </li>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <header>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-muted-foreground">
          <Sparkle weight="fill" className="h-3.5 w-3.5 text-accent" />
          Recunoștință
        </div>
        <h1 className="mt-1 font-display text-2xl sm:text-4xl tracking-tight">
          Pentru ce merită să fim fericiți împreună
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span>
            {total === 0
              ? "Adaugă primul motiv de mai jos."
              : `${total} ${total === 1 ? "motiv" : "de motive"} până acum.`}
          </span>
          {streak > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
              🔥 {streak} {streak === 1 ? "zi" : "zile"} la rând
            </span>
          )}
        </div>
      </header>

      {/* Memory */}
      {memory && (
        <div className="rounded-xl border border-accent/30 bg-accent/5 px-4 py-3">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-accent">
            <Sparkle weight="fill" className="h-3.5 w-3.5" />
            Îți amintești? · {memory.when}
          </div>
          <p className="mt-1 font-display text-[15px] leading-snug">“{memory.text}”</p>
          {memory.author && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">— {PEOPLE[memory.author].name}</p>
          )}
        </div>
      )}

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
                    style={on ? { backgroundColor: p.color, borderColor: p.color } : { borderColor: `${p.color}55` }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: on ? "#fff" : p.color }} />
                    {p.name}
                  </button>
                );
              })}
            </div>
            <Button variant="accent" size="sm" onClick={add} disabled={saving || text.trim().length === 0}>
              <Plus className="h-4 w-4" />
              Adaugă
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recap + search/filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          <span className="capitalize text-foreground">{recap.month}</span>: {recap.count}{" "}
          {recap.count === 1 ? "motiv" : "motive"}
          {recap.count > 0 && (
            <>
              {" · "}Cip {recap.cip} · Axy {recap.axy}
              {recap.photos > 0 && ` · ${recap.photos} cu poză`}
            </>
          )}
        </p>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-52">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Caută…"
              className="w-full rounded-full border border-border bg-background py-1.5 pl-8 pr-7 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Șterge căutarea"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            {(["all", "cip", "axy"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilterPerson(f)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  filterPerson === f ? "border-transparent bg-foreground text-background" : "border-border text-muted-foreground hover:bg-secondary",
                )}
              >
                {f === "all" ? "Toți" : PEOPLE[f].name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Pinned */}
      {pinned.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
            <PushPin weight="fill" className="h-3.5 w-3.5 text-accent" />
            Fixate
          </div>
          <ul className="space-y-2">{pinned.map((it) => renderEntry(it))}</ul>
        </section>
      )}

      {/* Entries */}
      {nothing ? (
        <div className="rounded-lg border border-dashed border-border px-6 py-16 text-center">
          <Sparkle className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            {filtering ? "Niciun motiv nu se potrivește." : "Încă nimic pe listă. Primul lucru frumos începe aici."}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {filteredGroups.map((g) => (
            <section key={g.key} className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
                  {g.label}
                </span>
                <span className="h-px flex-1 bg-border" />
                <span className="text-[11px] text-muted-foreground tabular-nums">{g.items.length}</span>
              </div>
              <ul className="space-y-2">{g.items.map((it) => renderEntry(it))}</ul>
            </section>
          ))}
        </div>
      )}

      {/* hidden file picker */}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhotoChosen} />

      {/* reaction picker */}
      {reactingId && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 animate-fade-in sm:items-center"
          onClick={() => setReactingId(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-3 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Reacționează {author ? `· ${PEOPLE[author].name}` : ""}
              </span>
              <button type="button" onClick={() => setReactingId(null)} aria-label="Închide">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="grid max-h-64 grid-cols-8 gap-1 overflow-y-auto">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => react(reactingId, e)}
                  className="rounded-lg p-1.5 text-xl transition-transform hover:scale-110 hover:bg-secondary"
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/85 p-4 animate-fade-in"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.url}
            alt=""
            onClick={(e) => e.stopPropagation()}
            className="max-h-[80vh] max-w-full rounded-lg object-contain"
          />
          <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => removePhoto(lightbox.id)}
              className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-sm text-white transition-colors hover:bg-destructive"
            >
              <Trash2 className="h-4 w-4" /> Șterge poza
            </button>
            <button
              type="button"
              onClick={() => setLightbox(null)}
              className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-sm text-white transition-colors hover:bg-white/20"
            >
              <X className="h-4 w-4" /> Închide
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionBtn({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  // Always tappable on touch; on desktop they're muted and brighten on hover.
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors",
        "text-muted-foreground/70 hover:bg-secondary sm:text-muted-foreground/50",
        danger ? "hover:!text-destructive" : "hover:!text-foreground",
      )}
    >
      {children}
    </button>
  );
}
