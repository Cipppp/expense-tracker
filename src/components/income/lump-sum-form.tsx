"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LumpSumForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/income", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "lumpsum",
        date: fd.get("date"),
        description: fd.get("description"),
        source: fd.get("source") || "Project",
        amountUsd: Number(fd.get("amount")),
      }),
    });
    setPending(false);
    if (!res.ok) {
      toast.error("Failed to save");
      return;
    }
    toast.success("Payment logged");
    (e.currentTarget as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-6 gap-3">
      <Field label="Date" className="md:col-span-2">
        <Input type="date" name="date" defaultValue={today} required />
      </Field>
      <Field label="Client / source" className="md:col-span-2">
        <Input name="source" placeholder="Client name" required />
      </Field>
      <Field label="Amount (USD)" className="md:col-span-2">
        <Input
          type="number"
          name="amount"
          step="0.01"
          min="0"
          placeholder="0.00"
          required
        />
      </Field>
      <Field label="Description" className="md:col-span-6">
        <Input
          name="description"
          placeholder="Project / invoice reference"
          required
        />
      </Field>
      <div className="md:col-span-6 flex justify-end">
        <Button type="submit" variant="accent" disabled={pending}>
          {pending ? "Saving…" : "Save payment"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
