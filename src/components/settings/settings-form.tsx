"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Initial = {
  fxRonToUsd: number;
  bsBasRon: number;
  camRon: number;
  microPct: number;
  dividendePct: number;
  redThresholdRon: number;
  senderEmail: string;
  senderName: string;
  invoiceStartNumber: number;
  issuerIban: string;
  issuerIbanEur: string;
  issuerSwift: string;
};

export function SettingsForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      fxRonToUsd: Number(fd.get("fxRonToUsd")),
      bsBasRon: Number(fd.get("bsBasRon")),
      camRon: Number(fd.get("camRon")),
      microPct: Number(fd.get("microPct")) / 100,
      dividendePct: Number(fd.get("dividendePct")) / 100,
      redThresholdRon: Number(fd.get("redThresholdRon")),
      senderEmail: String(fd.get("senderEmail") ?? ""),
      senderName: String(fd.get("senderName") ?? ""),
      invoiceStartNumber: Number(fd.get("invoiceStartNumber")),
      issuerIban: String(fd.get("issuerIban") ?? "").trim(),
      issuerIbanEur: String(fd.get("issuerIbanEur") ?? "").trim(),
      issuerSwift: String(fd.get("issuerSwift") ?? "").trim(),
    };
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setPending(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error("Failed to save", { description: JSON.stringify(err.error) });
      return;
    }
    toast.success("Settings saved");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Field label="RON → USD rate">
        <Input
          type="number"
          step="0.0001"
          name="fxRonToUsd"
          defaultValue={initial.fxRonToUsd}
          required
        />
      </Field>
      <Field label="Red threshold (RON/day)">
        <Input
          type="number"
          step="0.01"
          name="redThresholdRon"
          defaultValue={initial.redThresholdRon}
          required
        />
      </Field>

      <Field label="BS + BAS (RON/month)">
        <Input
          type="number"
          step="0.01"
          name="bsBasRon"
          defaultValue={initial.bsBasRon}
          required
        />
      </Field>
      <Field label="CAM (RON/month)">
        <Input
          type="number"
          step="0.01"
          name="camRon"
          defaultValue={initial.camRon}
          required
        />
      </Field>

      <Field label="Impozit micro (%)">
        <Input
          type="number"
          step="0.01"
          name="microPct"
          defaultValue={initial.microPct * 100}
          required
        />
      </Field>
      <Field label="Impozit dividende (%)">
        <Input
          type="number"
          step="0.01"
          name="dividendePct"
          defaultValue={initial.dividendePct * 100}
          required
        />
      </Field>

      <Field label="Next invoice number">
        <Input
          type="number"
          step="1"
          min="1"
          name="invoiceStartNumber"
          defaultValue={initial.invoiceStartNumber}
          required
        />
      </Field>
      <div className="hidden md:block" />

      <Field label="Sender name (email From)">
        <Input
          name="senderName"
          defaultValue={initial.senderName}
          placeholder="PROJECT CIP S.R.L."
        />
      </Field>
      <Field label="Sender email (must be a verified domain)">
        <Input
          type="email"
          name="senderEmail"
          defaultValue={initial.senderEmail}
          placeholder="facturi@domeniul-tau.ro"
        />
      </Field>

      <Field label="IBAN RON (default account)">
        <Input
          name="issuerIban"
          defaultValue={initial.issuerIban}
          className="font-mono"
          placeholder="RO00 INGB ..."
          required
        />
      </Field>
      <Field label="IBAN EUR (used on EUR invoices)">
        <Input
          name="issuerIbanEur"
          defaultValue={initial.issuerIbanEur}
          className="font-mono"
          placeholder="RO00 INGB ... (leave empty if none)"
        />
      </Field>

      <Field label="SWIFT / BIC">
        <Input
          name="issuerSwift"
          defaultValue={initial.issuerSwift}
          className="font-mono"
          placeholder="INGBROBU"
        />
      </Field>
      <div className="hidden md:block" />

      <div className="md:col-span-2 flex justify-end pt-2">
        <Button type="submit" variant="accent" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
