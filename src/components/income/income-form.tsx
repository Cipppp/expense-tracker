"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Job = { name: string; rateUsd: number };

export function IncomeForm({ jobs }: { jobs: Job[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  async function submit(payload: Record<string, unknown>) {
    setPending(true);
    const res = await fetch("/api/income", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setPending(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error("Failed to save", { description: JSON.stringify(err.error) });
      return;
    }
    toast.success("Income logged");
    router.refresh();
  }

  return (
    <Tabs defaultValue="hourly">
      <TabsList className="mb-4">
        <TabsTrigger value="hourly">Hourly</TabsTrigger>
        <TabsTrigger value="project">Project / lump-sum</TabsTrigger>
      </TabsList>

      <TabsContent value="hourly">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const hours = Number(fd.get("hours"));
            const rate = Number(fd.get("rate"));
            await submit({
              date: fd.get("date"),
              description: fd.get("description") || `${hours}h hourly`,
              source: fd.get("source"),
              hours,
              hourlyRate: rate,
              amountUsd: hours * rate,
            });
            (e.currentTarget as HTMLFormElement).reset();
          }}
          className="grid grid-cols-1 md:grid-cols-6 gap-3"
        >
          <Field label="Date" className="md:col-span-2">
            <Input type="date" name="date" defaultValue={today} required />
          </Field>
          <Field label="Job / client" className="md:col-span-2">
            <Input
              name="source"
              list="jobs"
              defaultValue={jobs[0]?.name ?? ""}
              required
            />
            <datalist id="jobs">
              {jobs.map((j) => (
                <option key={j.name} value={j.name} />
              ))}
            </datalist>
          </Field>
          <Field label="Hours" className="md:col-span-1">
            <Input
              type="number"
              name="hours"
              step="0.25"
              min="0"
              defaultValue="1"
              required
            />
          </Field>
          <Field label="Rate (USD/h)" className="md:col-span-1">
            <Input
              type="number"
              name="rate"
              step="0.5"
              min="0"
              defaultValue={jobs[0]?.rateUsd ?? 30}
              required
            />
          </Field>
          <Field label="Description (optional)" className="md:col-span-6">
            <Input name="description" placeholder="What did you work on?" />
          </Field>
          <div className="md:col-span-6 flex justify-end">
            <Button type="submit" variant="accent" disabled={pending}>
              {pending ? "Saving…" : "Save entry"}
            </Button>
          </div>
        </form>
      </TabsContent>

      <TabsContent value="project">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            await submit({
              date: fd.get("date"),
              description: fd.get("description"),
              source: fd.get("source") || "Project",
              amountUsd: Number(fd.get("amount")),
            });
            (e.currentTarget as HTMLFormElement).reset();
          }}
          className="grid grid-cols-1 md:grid-cols-6 gap-3"
        >
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
            <Input name="description" placeholder="Project / invoice reference" required />
          </Field>
          <div className="md:col-span-6 flex justify-end">
            <Button type="submit" variant="accent" disabled={pending}>
              {pending ? "Saving…" : "Save entry"}
            </Button>
          </div>
        </form>
      </TabsContent>
    </Tabs>
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
