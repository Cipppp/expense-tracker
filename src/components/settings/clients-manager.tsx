"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Check, X, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type ClientRow = {
  id: string;
  name: string;
  rateUsd: number;
  color: string;
  active: boolean;
};

const PRESET_COLORS = [
  "#c65c2a", // terracotta
  "#2f7a5c", // sage
  "#456d99", // dusty blue
  "#9b6b3f", // amber
  "#6a4d8a", // muted plum
  "#a8323f", // deep red
  "#3d8a8a", // teal
  "#566d2c", // olive
  "#7a5840", // brown
  "#525252", // slate
];

export function ClientsManager({ initial }: { initial: ClientRow[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState(false);

  async function refresh() {
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {initial.length === 0 && !adding && (
          <p className="text-sm text-muted-foreground">
            No clients yet. Add one to start tracking time.
          </p>
        )}
        {initial.map((c) => (
          <ClientRowEditor
            key={c.id}
            client={c}
            onChanged={refresh}
            disabled={pending}
            setPending={setPending}
          />
        ))}
      </div>

      {adding ? (
        <NewClientForm
          onCancel={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            refresh();
          }}
        />
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAdding(true)}
          className="w-full"
        >
          <Plus className="h-3.5 w-3.5" />
          Add client
        </Button>
      )}
    </div>
  );
}

function ClientRowEditor({
  client,
  onChanged,
  disabled,
  setPending,
}: {
  client: ClientRow;
  onChanged: () => void;
  disabled: boolean;
  setPending: (v: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(client.name);
  const [rate, setRate] = useState(String(client.rateUsd));
  const [color, setColor] = useState(client.color);

  async function save() {
    setPending(true);
    const res = await fetch(`/api/jobs/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, rateUsd: Number(rate), color }),
    });
    setPending(false);
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      toast.error("Failed to save", { description: JSON.stringify(e?.error) });
      return;
    }
    toast.success("Client updated");
    setEditing(false);
    onChanged();
  }

  async function remove() {
    if (!confirm(`Archive "${client.name}"? Existing entries are kept.`)) return;
    setPending(true);
    const res = await fetch(`/api/jobs/${client.id}`, { method: "DELETE" });
    setPending(false);
    if (!res.ok) {
      toast.error("Failed to delete");
      return;
    }
    toast.success("Client archived");
    onChanged();
  }

  if (editing) {
    return (
      <div className="rounded-md border border-border bg-card p-3 space-y-3 animate-fade-in">
        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-12 sm:col-span-6 space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Name
            </Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="col-span-6 sm:col-span-3 space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Rate (USD/h)
            </Label>
            <Input
              type="number"
              step="0.5"
              min="0"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </div>
          <div className="col-span-6 sm:col-span-3 space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Color
            </Label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={remove}
            disabled={disabled}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Archive
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(false);
                setName(client.name);
                setRate(String(client.rateUsd));
                setColor(client.color);
              }}
              disabled={disabled}
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button
              type="button"
              variant="accent"
              size="sm"
              onClick={save}
              disabled={disabled || !name.trim()}
            >
              <Check className="h-3.5 w-3.5" />
              Save
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-4 py-3 hover:border-border/80">
      <div className="flex items-center gap-3 min-w-0">
        <span
          className="h-3 w-3 rounded-full shrink-0"
          style={{ backgroundColor: client.color }}
        />
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{client.name}</div>
          <div className="text-xs text-muted-foreground tabular-nums">
            ${client.rateUsd}/hour
          </div>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setEditing(true)}
        className="text-muted-foreground hover:text-foreground"
      >
        <Pencil className="h-3.5 w-3.5" />
        Edit
      </Button>
    </div>
  );
}

function NewClientForm({
  onCancel,
  onSaved,
}: {
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [rate, setRate] = useState("30");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), rateUsd: Number(rate), color }),
    });
    setPending(false);
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      toast.error("Failed to create", { description: JSON.stringify(e?.error) });
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
            placeholder="Client name"
            autoFocus
          />
        </div>
        <div className="col-span-6 sm:col-span-3 space-y-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Rate (USD/h)
          </Label>
          <Input
            type="number"
            step="0.5"
            min="0"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
        </div>
        <div className="col-span-6 sm:col-span-3 space-y-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Color
          </Label>
          <ColorPicker value={color} onChange={setColor} />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button
          variant="accent"
          size="sm"
          onClick={save}
          disabled={pending || !name.trim()}
        >
          {pending ? "Adding…" : "Add client"}
        </Button>
      </div>
    </div>
  );
}

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:border-foreground/40 transition-colors"
        >
          <span
            className="h-4 w-4 rounded-full shrink-0"
            style={{ backgroundColor: value }}
          />
          <span className="text-xs text-muted-foreground font-mono">{value}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48" align="end">
        <div className="grid grid-cols-5 gap-1.5">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              className={cn(
                "h-7 w-7 rounded-full border-2 transition-all duration-200 ease-expo",
                value === c
                  ? "border-foreground scale-110"
                  : "border-transparent hover:scale-110",
              )}
              style={{ backgroundColor: c }}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
