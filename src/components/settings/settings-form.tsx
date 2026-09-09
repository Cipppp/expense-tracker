"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Initial = {
  fxRonToUsd: number;
  fxEurToUsd: number;
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
  issuerIbanUsd: string;
  issuerSwift: string;
  issuerName: string;
  issuerCif: string;
  issuerReg: string;
  issuerAddress: string;
  issuerBank: string;
  issuerCapital: string;
  issuerSigner: string;
  invoiceSeries: string;
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
      fxEurToUsd: Number(fd.get("fxEurToUsd")),
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
      issuerIbanUsd: String(fd.get("issuerIbanUsd") ?? "").trim(),
      issuerSwift: String(fd.get("issuerSwift") ?? "").trim(),
      issuerName: String(fd.get("issuerName") ?? "").trim(),
      issuerCif: String(fd.get("issuerCif") ?? "").trim(),
      issuerReg: String(fd.get("issuerReg") ?? "").trim(),
      issuerAddress: String(fd.get("issuerAddress") ?? "").trim(),
      issuerBank: String(fd.get("issuerBank") ?? "").trim(),
      issuerCapital: String(fd.get("issuerCapital") ?? "").trim(),
      issuerSigner: String(fd.get("issuerSigner") ?? "").trim(),
      invoiceSeries: String(fd.get("invoiceSeries") ?? "").trim(),
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
      <Field label="EUR → USD rate">
        <Input
          type="number"
          step="0.0001"
          name="fxEurToUsd"
          defaultValue={initial.fxEurToUsd}
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
      <Field label="IBAN USD (used on USD invoices)">
        <Input
          name="issuerIbanUsd"
          defaultValue={initial.issuerIbanUsd}
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

      {/*
        Datele firmei care emite. Erau valori implicite in schema, deci o
        instalare noua scotea prima factura cu CIF-ul si IBAN-ul altcuiva —
        clientul platea in alt cont, iar incarcarea in SPV pleca pe alt CUI.
      */}
      <div className="md:col-span-2 pt-4">
        <div className="eyebrow">Firma care emite</div>
        <p className="mt-1 text-xs text-muted-foreground">
          Apar pe factură, în PDF și în XML-ul trimis la ANAF.
        </p>
      </div>

      <Field label="Denumire">
        <Input name="issuerName" defaultValue={initial.issuerName} placeholder="EXEMPLU S.R.L." />
      </Field>

      <Field label="CIF">
        <Input name="issuerCif" defaultValue={initial.issuerCif} className="font-mono" placeholder="12345678" />
      </Field>

      <Field label="Nr. reg. comerțului">
        <Input name="issuerReg" defaultValue={initial.issuerReg} className="font-mono" placeholder="J40/1234/2026" />
      </Field>

      <Field label="Adresă">
        <Input name="issuerAddress" defaultValue={initial.issuerAddress} placeholder="Str. Exemplu nr. 1, București" />
      </Field>

      <Field label="Bancă">
        <Input name="issuerBank" defaultValue={initial.issuerBank} placeholder="ING BANK NV" />
      </Field>

      <Field label="Capital social">
        <Input name="issuerCapital" defaultValue={initial.issuerCapital} placeholder="200 Lei" />
      </Field>

      <Field label="Semnatar">
        <Input name="issuerSigner" defaultValue={initial.issuerSigner} placeholder="Nume Prenume" />
      </Field>

      <Field label="Serie factură">
        <Input name="invoiceSeries" defaultValue={initial.invoiceSeries} className="font-mono" placeholder="CP" />
      </Field>

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
