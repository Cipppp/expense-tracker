"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "@/lib/icons";
import { toast } from "sonner";
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

type JobOption = {
  id: string;
  name: string;
  rateUsd: number;
  companyName: string;
  companyCui: string;
  companyReg: string;
  companyAddress: string;
  companyCountry: string;
  defaultCurrency: string;
};

type Line = {
  description: string;
  unit: string;
  quantity: string;
  unitPrice: string;
};

const emptyLine = (): Line => ({
  description: "",
  unit: "buc",
  quantity: "1",
  unitPrice: "",
});

export function InvoiceForm({
  jobs,
  preselectJobId,
}: {
  jobs: JobOption[];
  preselectJobId: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const [jobId, setJobId] = useState<string>(preselectJobId ?? jobs[0]?.id ?? "");
  const selectedJob = useMemo(
    () => jobs.find((j) => j.id === jobId) ?? null,
    [jobId, jobs],
  );

  // Client snapshot fields — pre-filled from the selected job but editable
  // for one-off overrides without changing the client record.
  const [clientName, setClientName] = useState(selectedJob?.name ?? "");
  const [companyName, setCompanyName] = useState(selectedJob?.companyName ?? "");
  const [companyCui, setCompanyCui] = useState(selectedJob?.companyCui ?? "");
  const [companyReg, setCompanyReg] = useState(selectedJob?.companyReg ?? "");
  const [companyAddress, setCompanyAddress] = useState(
    selectedJob?.companyAddress ?? "",
  );
  const [companyCountry, setCompanyCountry] = useState(
    selectedJob?.companyCountry ?? "RO",
  );

  const [issuedAt, setIssuedAt] = useState(today);
  const [invoiceCurrency, setInvoiceCurrency] = useState<"RON" | "USD" | "EUR">(
    (selectedJob?.defaultCurrency as "RON" | "USD" | "EUR") ?? "RON",
  );
  const [bnrRate, setBnrRate] = useState<string>("");
  const [footerNote, setFooterNote] = useState("");

  const [lines, setLines] = useState<Line[]>([emptyLine()]);

  function applyJob(id: string) {
    setJobId(id);
    const j = jobs.find((x) => x.id === id);
    if (!j) return;
    setClientName(j.name);
    setCompanyName(j.companyName);
    setCompanyCui(j.companyCui);
    setCompanyReg(j.companyReg);
    setCompanyAddress(j.companyAddress);
    setCompanyCountry(j.companyCountry);
    setInvoiceCurrency(
      (j.defaultCurrency as "RON" | "USD" | "EUR") ?? "RON",
    );
  }

  function updateLine(i: number, key: keyof Line, value: string) {
    setLines((rows) => rows.map((r, j) => (j === i ? { ...r, [key]: value } : r)));
  }

  function removeLine(i: number) {
    setLines((rows) => rows.filter((_, j) => j !== i));
  }

  const subtotal = useMemo(
    () =>
      lines.reduce((a, l) => {
        const q = Number(l.quantity) || 0;
        const p = Number(l.unitPrice) || 0;
        return a + q * p;
      }, 0),
    [lines],
  );

  const needsBnrRate = invoiceCurrency !== "RON";
  const bnrRateNum = Number(bnrRate) || 0;
  const legalTotal = needsBnrRate && bnrRateNum > 0 ? subtotal * bnrRateNum : subtotal;

  async function submit() {
    setPending(true);
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId: jobId || null,
        clientName,
        clientCompany: companyName,
        clientCui: companyCui || null,
        clientReg: companyReg || null,
        clientAddress: companyAddress || null,
        clientCountry: companyCountry || null,
        issuedAt,
        invoiceCurrency,
        bnrRate: needsBnrRate ? bnrRateNum : null,
        footerNote: footerNote || null,
        lines: lines
          .filter((l) => l.description.trim() && Number(l.unitPrice) > 0)
          .map((l) => ({
            description: l.description.trim(),
            unit: l.unit || "buc",
            quantity: Number(l.quantity),
            unitPrice: Number(l.unitPrice),
          })),
      }),
    });
    setPending(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error("Failed to create invoice", {
        description: JSON.stringify(err.error ?? err),
      });
      return;
    }
    const data = await res.json();
    toast.success(`Invoice ${data.invoice.series} ${data.invoice.number} created`);
    router.push(`/invoices/${data.invoice.id}`);
  }

  const valid =
    clientName.trim() &&
    companyName.trim() &&
    lines.some((l) => l.description.trim() && Number(l.unitPrice) > 0) &&
    (!needsBnrRate || bnrRateNum > 0);

  return (
    <div className="space-y-6">
      {/* Client picker */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="Client" className="md:col-span-2">
          <Select value={jobId} onValueChange={applyJob}>
            <SelectTrigger>
              <SelectValue placeholder="Pick a client" />
            </SelectTrigger>
            <SelectContent>
              {jobs.map((j) => (
                <SelectItem key={j.id} value={j.id}>
                  {j.name}
                  {j.companyName ? ` — ${j.companyName}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Invoice currency">
          <Select
            value={invoiceCurrency}
            onValueChange={(v) =>
              setInvoiceCurrency(v as "RON" | "USD" | "EUR")
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="RON">RON</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Issued at">
          <Input
            type="date"
            value={issuedAt}
            onChange={(e) => setIssuedAt(e.target.value)}
          />
        </Field>
        {needsBnrRate && (
          <Field label={`BNR rate ${invoiceCurrency}/RON`}>
            <Input
              type="number"
              step="0.0001"
              min="0"
              value={bnrRate}
              onChange={(e) => setBnrRate(e.target.value)}
              placeholder="e.g. 4.4085"
            />
          </Field>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Client display name">
          <Input
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Display name"
          />
        </Field>
        <Field label="Company (legal entity)">
          <Input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="e.g. FUSECON S.R.L."
          />
        </Field>
        <Field label="CIF / VAT ID">
          <Input
            value={companyCui}
            onChange={(e) => setCompanyCui(e.target.value)}
            placeholder="e.g. RO38855898"
          />
        </Field>
        <Field label="Reg.com / CVR">
          <Input
            value={companyReg}
            onChange={(e) => setCompanyReg(e.target.value)}
            placeholder="e.g. J20180020021404"
          />
        </Field>
        <Field label="Address" className="md:col-span-2">
          <Input
            value={companyAddress}
            onChange={(e) => setCompanyAddress(e.target.value)}
            placeholder="Address line"
          />
        </Field>
        <Field label="Country (ISO)">
          <Input
            value={companyCountry}
            onChange={(e) => setCompanyCountry(e.target.value.toUpperCase())}
            placeholder="RO"
            maxLength={2}
          />
        </Field>
      </div>

      {/* Lines */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Lines
          </Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setLines((l) => [...l, emptyLine()])}
          >
            <Plus className="h-3.5 w-3.5" />
            Add line
          </Button>
        </div>
        <div className="space-y-2">
          {lines.map((line, i) => (
            <div
              key={i}
              className="grid grid-cols-12 gap-2 items-end rounded-md border border-border bg-card px-3 py-2"
            >
              <div className="col-span-12 md:col-span-6">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Description
                </Label>
                <Input
                  value={line.description}
                  onChange={(e) => updateLine(i, "description", e.target.value)}
                  placeholder="e.g. IT consulting services as per service agreement..."
                />
              </div>
              <div className="col-span-3 md:col-span-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  U.M.
                </Label>
                <Input
                  value={line.unit}
                  onChange={(e) => updateLine(i, "unit", e.target.value)}
                />
              </div>
              <div className="col-span-3 md:col-span-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Qty
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={line.quantity}
                  onChange={(e) => updateLine(i, "quantity", e.target.value)}
                />
              </div>
              <div className="col-span-4 md:col-span-2">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Unit price ({invoiceCurrency})
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={line.unitPrice}
                  onChange={(e) => updateLine(i, "unitPrice", e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="col-span-2 md:col-span-2 flex items-end justify-end gap-1">
                <span className="text-sm tabular-nums">
                  {(
                    (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0)
                  ).toLocaleString("ro-RO", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                {lines.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removeLine(i)}
                    aria-label="Remove line"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Totals */}
      <div className="rounded-md bg-secondary/50 px-4 py-3 space-y-1.5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">
            Subtotal ({invoiceCurrency})
          </span>
          <span className="font-display text-lg tabular-nums">
            {subtotal.toLocaleString("ro-RO", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
        {needsBnrRate && bnrRateNum > 0 && (
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-muted-foreground">
              Equivalent (RON, at BNR {bnrRateNum.toFixed(4)})
            </span>
            <span className="text-sm tabular-nums">
              {legalTotal.toLocaleString("ro-RO", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button
          variant="accent"
          onClick={submit}
          disabled={pending || !valid}
        >
          {pending ? "Creating…" : "Create invoice"}
        </Button>
      </div>
    </div>
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
