"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { fmtRon, fmtUsd } from "@/lib/format";

type Subscription = {
  id: string;
  name: string;
  category: string;
  amountRon: number;
  amountUsd: number;
  frequency: string;
  dayOfMonth: number;
  active: boolean;
};

export function SubscriptionsManager() {
  const router = useRouter();
  const [items, setItems] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [pendingTx, startTx] = useTransition();

  async function load() {
    const res = await fetch("/api/subscriptions");
    if (res.ok) setItems((await res.json()).subscriptions);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function toggleActive(id: string, active: boolean) {
    const res = await fetch(`/api/subscriptions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    if (!res.ok) {
      toast.error("Failed to update");
      return;
    }
    load();
    startTx(() => router.refresh());
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Remove subscription "${name}"?`)) return;
    const res = await fetch(`/api/subscriptions/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to remove");
      return;
    }
    toast.success("Removed");
    load();
    startTx(() => router.refresh());
  }

  const total = items
    .filter((s) => s.active)
    .reduce((a, b) => a + (b.frequency === "yearly" ? b.amountRon / 12 : b.amountRon), 0);

  return (
    <div className="space-y-3">
      {!loading && items.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">
          No subscriptions yet. Add Netflix, AWS, GitHub… so the dashboard can
          forecast next months.
        </p>
      )}

      {items.length > 0 && (
        <div className="rounded-md bg-secondary/50 px-3 py-2 text-xs flex items-baseline justify-between">
          <span className="text-muted-foreground inline-flex items-center gap-1">
            <RefreshCw className="h-3 w-3" />
            Monthly equivalent (active subs)
          </span>
          <span className="font-medium tabular-nums">{fmtRon(total)}</span>
        </div>
      )}

      <ul className="space-y-2">
        {items.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-4 py-2.5"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Switch
                checked={s.active}
                onCheckedChange={(c) => toggleActive(s.id, c)}
              />
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{s.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {fmtRon(s.amountRon)} ({fmtUsd(s.amountUsd)}) ·{" "}
                  {s.frequency === "yearly"
                    ? "yearly"
                    : `monthly on day ${s.dayOfMonth}`}{" "}
                  · {s.category}
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => remove(s.id, s.name)}
              className="text-muted-foreground hover:text-destructive"
              aria-label="Remove subscription"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </li>
        ))}
      </ul>

      {adding ? (
        <NewSubscriptionForm
          onCancel={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            load();
            startTx(() => router.refresh());
          }}
        />
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAdding(true)}
          className="w-full"
          disabled={pendingTx}
        >
          <Plus className="h-3.5 w-3.5" />
          Add subscription
        </Button>
      )}
    </div>
  );
}

function NewSubscriptionForm({
  onCancel,
  onSaved,
}: {
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [amountRon, setAmountRon] = useState("");
  const [frequency, setFrequency] = useState<"monthly" | "yearly">("monthly");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [category, setCategory] = useState("Subscriptions");
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    const res = await fetch("/api/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        amountRon: Number(amountRon),
        frequency,
        dayOfMonth: Number(dayOfMonth),
        category,
      }),
    });
    setPending(false);
    if (!res.ok) {
      toast.error("Failed to add");
      return;
    }
    toast.success(`${name} added`);
    onSaved();
  }

  return (
    <div className="rounded-md border border-accent/40 bg-card p-3 space-y-3 animate-fade-in">
      <div className="grid grid-cols-12 gap-2">
        <div className="col-span-12 sm:col-span-6 space-y-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Name
          </Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Netflix, AWS, GitHub…"
            autoFocus
          />
        </div>
        <div className="col-span-6 sm:col-span-3 space-y-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Amount (RON)
          </Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={amountRon}
            onChange={(e) => setAmountRon(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="col-span-6 sm:col-span-3 space-y-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Frequency
          </Label>
          <Select value={frequency} onValueChange={(v) => setFrequency(v as "monthly" | "yearly")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-6 sm:col-span-3 space-y-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Day of month
          </Label>
          <Input
            type="number"
            min="1"
            max="31"
            value={dayOfMonth}
            onChange={(e) => setDayOfMonth(e.target.value)}
          />
        </div>
        <div className="col-span-6 sm:col-span-3 space-y-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Category
          </Label>
          <Input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button
          variant="accent"
          size="sm"
          onClick={save}
          disabled={pending || !name.trim() || !amountRon}
        >
          {pending ? "Adding…" : "Add subscription"}
        </Button>
      </div>
    </div>
  );
}
