"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "@/lib/icons";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimePicker } from "@/components/ui/time-picker";
import { fmtCurrency, fmtDuration, fmtRate, localISODate } from "@/lib/format";
import { cn } from "@/lib/utils";

export type JobOpt = {
  id: string;
  name: string;
  rateUsd: number;
  color: string;
  defaultCurrency?: string;
};

export type EntryDraft = {
  id?: string;
  date: string;          // yyyy-mm-dd
  jobId: string | null;
  startMinutes: number;  // 0-1440
  endMinutes: number;
  description: string;
};

export function TimeEntryDialog({
  open,
  onOpenChange,
  draft,
  jobs,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  draft: EntryDraft | null;
  jobs: JobOpt[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState<EntryDraft | null>(draft);

  useEffect(() => {
    if (open) setForm(draft);
  }, [draft, open]);

  const job = useMemo(
    () => jobs.find((j) => j.id === form?.jobId) ?? null,
    [form?.jobId, jobs],
  );
  const hours = useMemo(() => {
    if (!form) return 0;
    return Math.max(0, (form.endMinutes - form.startMinutes) / 60);
  }, [form]);
  const valid =
    !!form && !!form.jobId && form.endMinutes > form.startMinutes;

  async function save() {
    if (!form || !job || !valid) return;
    setPending(true);
    const isEdit = !!form.id;
    const url = isEdit ? `/api/income/${form.id}` : "/api/income";
    const body = isEdit
      ? {
          date: form.date,
          jobId: form.jobId,
          startMinutes: form.startMinutes,
          endMinutes: form.endMinutes,
          description: form.description,
        }
      : {
          kind: "time" as const,
          date: form.date,
          jobId: form.jobId,
          startMinutes: form.startMinutes,
          endMinutes: form.endMinutes,
          description: form.description,
        };
    const res = await fetch(url, {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setPending(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error("Failed to save", { description: String(err?.error ?? "") });
      return;
    }
    toast.success(isEdit ? "Updated" : `Logged ${fmtDuration(hours)} on ${job.name}`);
    onOpenChange(false);
    router.refresh();
  }

  async function remove() {
    if (!form?.id) return;
    setPending(true);
    const res = await fetch(`/api/income/${form.id}`, { method: "DELETE" });
    setPending(false);
    if (!res.ok) {
      toast.error("Failed to delete");
      return;
    }
    toast.success("Entry deleted");
    onOpenChange(false);
    router.refresh();
  }

  if (!form) return null;

  const earnedPreview = job
    ? fmtCurrency(
        Math.round(hours * job.rateUsd * 100),
        job.defaultCurrency || "USD",
      )
    : "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{form.id ? "Edit entry" : "New time entry"}</DialogTitle>
          <DialogDescription>
            {new Date(`${form.date}T12:00:00`).toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Client
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {jobs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No clients yet — add one in Settings.
                </p>
              ) : (
                jobs.map((j) => {
                  const selected = form.jobId === j.id;
                  return (
                    <button
                      key={j.id}
                      type="button"
                      onClick={() => setForm({ ...form, jobId: j.id })}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-all duration-200 ease-expo",
                        selected
                          ? "border-transparent shadow-sm scale-[1.02]"
                          : "border-border hover:border-foreground/40",
                      )}
                      style={
                        selected
                          ? { backgroundColor: j.color, color: "#fff" }
                          : undefined
                      }
                    >
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: selected ? "#fff" : j.color }}
                      />
                      <span className="font-medium">{j.name}</span>
                      <span
                        className={cn(
                          "tabular-nums",
                          selected ? "opacity-90" : "text-muted-foreground",
                        )}
                      >
                        {fmtRate(j.rateUsd, j.defaultCurrency || "USD")}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Start
              </Label>
              <TimePicker
                value={form.startMinutes}
                onChange={(v) => setForm({ ...form, startMinutes: v })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                End
              </Label>
              <TimePicker
                value={form.endMinutes}
                onChange={(v) => setForm({ ...form, endMinutes: v })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="desc"
              className="text-xs uppercase tracking-wider text-muted-foreground"
            >
              Description (optional)
            </Label>
            <Input
              id="desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What did you work on?"
            />
          </div>

          {/* Preview */}
          <div className="rounded-md border border-border bg-secondary/40 px-4 py-3 flex items-baseline justify-between">
            <div className="text-sm">
              <span className="text-muted-foreground">
                {valid ? "Duration · " : "Pick a valid range · "}
              </span>
              <span className="font-medium tabular-nums">
                {valid ? fmtDuration(hours) : "—"}
              </span>
            </div>
            <div className="font-display text-lg tabular-nums text-success">
              {valid ? earnedPreview : "—"}
            </div>
          </div>
        </div>

        <DialogFooter className="flex sm:justify-between gap-2">
          {form.id ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={remove}
              disabled={pending}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2 sm:ml-auto">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="accent"
              onClick={save}
              disabled={pending || !valid}
            >
              {pending ? "Saving…" : form.id ? "Save changes" : "Log time"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function makeEmptyDraft(date: Date): EntryDraft {
  return {
    date: localISODate(date),
    jobId: null,
    startMinutes: 9 * 60,
    endMinutes: 13 * 60,
    description: "",
  };
}
