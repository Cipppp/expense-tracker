"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Pencil } from "@/lib/icons";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { fmtRon, fmtUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

const CATEGORY_COLORS: Record<
  string,
  "default" | "accent" | "success" | "warning" | "destructive" | "secondary" | "outline"
> = {
  Food: "accent",
  Groceries: "success",
  Transport: "warning",
  Health: "destructive",
  Bills: "secondary",
  Subscriptions: "secondary",
  Shopping: "accent",
  Transfer: "outline",
  Savings: "outline",
  Other: "outline",
};

export type ExpenseRowData = {
  id: string;
  date: string;          // ISO yyyy-mm-dd
  dateShort: string;     // e.g. "18 May"
  description: string;
  category: string;
  amountRon: number;
  amountUsd: number;
  excluded: boolean;
  isHotDay: boolean;
  notes: string | null;
};

export function ExpenseRow({ row }: { row: ExpenseRowData }) {
  const router = useRouter();
  const [optimisticExcluded, setOptimisticExcluded] = useState(row.excluded);
  const [pending, startTransition] = useTransition();
  /*
   * Nota se editeaza pe loc. Descrierea vine din extras si e ce a scris banca;
   * nota e singurul loc unde incape de ce ai cheltuit, iar peste sase luni aia
   * e tot ce mai conteaza.
   */
  const [notes, setNotes] = useState(row.notes ?? "");
  const [editingNote, setEditingNote] = useState(false);
  const [savedNote, setSavedNote] = useState(row.notes ?? "");

  async function saveNote() {
    setEditingNote(false);
    const next = notes.trim();
    if (next === savedNote) return;
    const prev = savedNote;
    setSavedNote(next);
    const res = await fetch(`/api/expenses/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: next }),
    });
    if (!res.ok) {
      setSavedNote(prev);
      setNotes(prev);
      toast.error("Couldn't save the note");
      return;
    }
    startTransition(() => router.refresh());
  }

  async function toggle() {
    const next = !optimisticExcluded;
    setOptimisticExcluded(next);
    const res = await fetch(`/api/expenses/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ excluded: next }),
    });
    if (!res.ok) {
      setOptimisticExcluded(!next);
      toast.error("Failed to update");
      return;
    }
    toast.success(next ? "Excluded from analytics" : "Included again");
    startTransition(() => router.refresh());
  }

  return (
    <tr
      className={cn(
        "group/row transition-colors",
        optimisticExcluded
          ? "bg-muted/40 opacity-60"
          : "hover:bg-secondary/40",
        pending && "animate-pulse",
      )}
    >
      <td className="px-4 py-2 whitespace-nowrap text-xs text-muted-foreground tabular-nums">
        {row.dateShort}
      </td>
      <td className="px-4 py-2">
        <span
          className={cn(
            "font-medium",
            optimisticExcluded && "line-through decoration-1",
          )}
        >
          {row.description}
        </span>
        {editingNote ? (
          <input
            autoFocus
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNote}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveNote();
              if (e.key === "Escape") {
                setNotes(savedNote);
                setEditingNote(false);
              }
            }}
            placeholder="Add a note…"
            className="mt-0.5 block w-full max-w-md bg-transparent border-b border-border focus:border-accent outline-none text-[11.5px] text-muted-foreground py-0.5"
          />
        ) : savedNote ? (
          <button
            type="button"
            onClick={() => setEditingNote(true)}
            className="mt-0.5 block text-left text-[11.5px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {savedNote}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setEditingNote(true)}
            className="mt-0.5 hidden md:inline-flex items-center gap-1 text-[10.5px] text-muted-foreground/60 opacity-0 group-hover/row:opacity-100 hover:text-foreground transition-all duration-200 ease-expo"
          >
            <Pencil className="h-2.5 w-2.5" />
            note
          </button>
        )}
      </td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-1.5">
          <Badge
            variant={CATEGORY_COLORS[row.category] ?? "outline"}
            className={cn(
              "text-[10px] font-normal",
              optimisticExcluded && "opacity-70",
            )}
          >
            {row.category}
          </Badge>
          {optimisticExcluded && (
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
              excluded
            </span>
          )}
        </div>
      </td>
      <td
        className={cn(
          "px-4 py-2 text-right tabular-nums whitespace-nowrap font-semibold",
          optimisticExcluded
            ? "text-muted-foreground line-through decoration-1 font-normal"
            : row.isHotDay
              ? "text-destructive"
              : "",
        )}
      >
        -{fmtRon(row.amountRon).replace("- ", "")}
      </td>
      <td
        className={cn(
          "px-4 py-2 text-right tabular-nums text-muted-foreground whitespace-nowrap font-medium",
          optimisticExcluded && "line-through decoration-1 font-normal",
        )}
      >
        -{fmtUsd(row.amountUsd).replace("-", "")}
      </td>
      <td className="px-2 py-2 text-right w-[44px] md:w-[40px]">
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          aria-label={
            optimisticExcluded ? "Include" : "Exclude from analytics"
          }
          title={
            optimisticExcluded
              ? "Include in analytics"
              : "Exclude from analytics"
          }
          className={cn(
            "inline-flex items-center justify-center rounded-md transition-all duration-150 ease-expo h-9 w-9 md:h-7 md:w-7",
            optimisticExcluded
              ? "opacity-100 text-muted-foreground hover:text-foreground hover:bg-secondary"
              : "opacity-100 md:opacity-0 md:group-hover/row:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10",
          )}
        >
          {optimisticExcluded ? (
            <Eye className="h-4 w-4 md:h-3.5 md:w-3.5" />
          ) : (
            <EyeOff className="h-4 w-4 md:h-3.5 md:w-3.5" />
          )}
        </button>
      </td>
    </tr>
  );
}
