"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Clock, RefreshCw } from "@/lib/icons";
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
import { fmtCurrency, fmtDuration, localISODate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { deriveVat } from "@/lib/vat";
import {
  InvoicePreview,
  type PreviewIssuer,
} from "@/components/invoices/invoice-preview";
import Link from "next/link";

type JobOption = {
  id: string;
  name: string;
  rateUsd: number;
  companyName: string;
  companyCui: string;
  companyReg: string;
  companyAddress: string;
  companyCountry: string;
  /** ISO 3166-2:RO al clientului (RO-B, RO-CJ); gol pentru straini. */
  companyCounty: string;
  defaultCurrency: string;
  invoiceDescription: string;
};

type Line = {
  description: string;
  unit: string;
  quantity: string;
  unitPrice: string;
};

/** Termenul de plata implicit, in zile de la emitere. */
const DEFAULT_DUE_DAYS = 5;

/** yyyy-mm-dd + n zile, prin UTC ca sa nu sara o zi la schimbarea de ora. */
function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return "";
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const emptyLine = (): Line => ({
  description: "",
  unit: "buc",
  quantity: "1",
  unitPrice: "",
});

export function InvoiceForm({
  jobs,
  preselectJobId,
  issuer,
  series,
  nextNumber,
  roVatRate,
  oblioReady,
  anafReady = false,
}: {
  jobs: JobOption[];
  preselectJobId: string | null;
  issuer: PreviewIssuer;
  series: string;
  nextNumber: string;
  /** Cota standard din setari; se aplica doar clientilor din RO. */
  roVatRate: number;
  /** OBLIO_EMAIL + OBLIO_SECRET sunt setate pe server. */
  oblioReady: boolean;
  /** ANAF e conectat direct (OAuth). Inlocuieste Oblio cand e true. */
  anafReady?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  /*
   * Ziua din calendarul LOCAL, nu din UTC. Cu `toISOString()`, intre miezul
   * noptii si ora 3 dimineata data emiterii se pre-completa cu ziua de ieri —
   * exact intervalul in care se emit facturile aici.
   */
  const today = localISODate(new Date());

  const [jobId, setJobId] = useState<string>(preselectJobId ?? jobs[0]?.id ?? "");
  const selectedJob = useMemo(
    () => jobs.find((j) => j.id === jobId) ?? null,
    [jobId, jobs],
  );

  /*
   * Datele clientului se CITESC din fisa lui, nu se editeaza aici.
   *
   * Erau campuri libere pre-completate, ca sa poti face o exceptie punctuala.
   * In practica singurul lucru care se intampla era sa modifici din greseala
   * CIF-ul sau adresa pe o factura, fara ca fisa clientului sa se schimbe —
   * adica exact tipul de eroare pe care nu-l prinzi decat la contabilitate.
   * Se schimba din Setari > Clienti, unde se schimba pentru toate facturile.
   */
  const clientName = selectedJob?.name ?? "";
  const companyName = selectedJob?.companyName ?? "";
  const companyCui = selectedJob?.companyCui ?? "";
  const companyReg = selectedJob?.companyReg ?? "";
  const companyAddress = selectedJob?.companyAddress ?? "";
  const companyCountry = selectedJob?.companyCountry ?? "RO";
  const companyCounty = selectedJob?.companyCounty ?? "";

  /*
   * Scadenta implicita: emitere + 5 zile.
   *
   * `dueAtTouched` retine daca ai scris tu o data. Cat timp nu ai scris,
   * scadenta urmeaza data emiterii; din clipa in care ai schimbat-o manual,
   * ramane cum ai pus-o. Fara asta, mutarea datei de emitere ti-ar rescrie
   * pe tacute termenul convenit cu clientul.
   */
  const [issuedAt, setIssuedAt] = useState(today);
  const [dueAt, setDueAt] = useState(() => addDays(today, DEFAULT_DUE_DAYS));
  const [dueAtTouched, setDueAtTouched] = useState(false);
  const [toOblio, setToOblio] = useState(oblioReady && !anafReady);
  /*
   * e-Factura la creare. Bifat implicit cand legea o cere (client din RO sau
   * cu cod de TVA RO); pentru clientii straini e optional si porneste debifat.
   * Odata atins de mana, ramane cum l-ai pus si daca schimbi clientul.
   */
  const anafRequired =
    companyCountry.trim().toUpperCase() === "RO" ||
    /^RO\d{2,10}$/i.test(companyCui.replace(/\s+/g, ""));
  const [toAnafManual, setToAnafManual] = useState<boolean | null>(null);
  const toAnaf = toAnafManual ?? (anafReady && anafRequired);

  useEffect(() => {
    if (!dueAtTouched) setDueAt(addDays(issuedAt, DEFAULT_DUE_DAYS));
  }, [issuedAt, dueAtTouched]);
  const [invoiceCurrency, setInvoiceCurrency] = useState<"RON" | "USD" | "EUR">(
    (selectedJob?.defaultCurrency as "RON" | "USD" | "EUR") ?? "RON",
  );
  const [bnrRate, setBnrRate] = useState<string>("");
  const [bnrLoading, setBnrLoading] = useState(false);
  const [bnrSource, setBnrSource] = useState<{
    date: string;
    fellBack: boolean;
  } | null>(null);
  const [footerNote, setFooterNote] = useState("");

  const [lines, setLines] = useState<Line[]>([emptyLine()]);

  // Unbilled time-tracker hours for the picked client. The user can tick
  // months to auto-add invoice lines + link those Income rows on save.
  type UnbilledGroup = {
    month: string; // yyyy-mm
    hours: number;
    amount: number; // cents
    entries: { id: string; date: string; hours: number; description: string }[];
  };
  const [unbilled, setUnbilled] = useState<UnbilledGroup[] | null>(null);
  const [unbilledLoading, setUnbilledLoading] = useState(false);
  const [pickedMonths, setPickedMonths] = useState<Set<string>>(new Set());
  // Income row IDs to tag with the new invoice on save.
  const [linkedIncomeIds, setLinkedIncomeIds] = useState<string[]>([]);

  function applyJob(id: string) {
    setJobId(id);
    setUnbilled(null);
    setPickedMonths(new Set());
    setLinkedIncomeIds([]);
    const j = jobs.find((x) => x.id === id);
    if (!j) return;
    setInvoiceCurrency(
      (j.defaultCurrency as "RON" | "USD" | "EUR") ?? "RON",
    );
  }

  // Fetch unbilled hours whenever the client changes.
  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    setUnbilledLoading(true);
    fetch(`/api/income/unbilled?jobId=${encodeURIComponent(jobId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setUnbilled(data.groups ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setUnbilled([]);
      })
      .finally(() => {
        if (!cancelled) setUnbilledLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  /**
   * Replace any auto-generated lines with one consolidated line per picked
   * month, and remember the Income IDs that those hours come from so we can
   * tag them with the new invoice on save.
   */
  function addPickedToLines(nextPicked: Set<string>) {
    if (!unbilled || !selectedJob) return;
    /*
     * Descrierea liniei vine din fisa clientului, nu dintr-un sablon comun.
     * Fiecare client are formularea lui si ea nu se schimba de la o luna la
     * alta — NETOP cere trimiterea la contract, BLNG cere perioada de
     * serviciu. Un "Consulting services — August 2026" pentru toti nu semana
     * cu nicio factura emisa vreodata.
     */
    const lineFor = (ym: string) => {
      const [y, m] = ym.split("-").map(Number);
      const d = new Date(Date.UTC(y, m - 1, 15));
      const tpl = selectedJob.invoiceDescription?.trim();
      const vals: Record<string, string> = {
        month: d.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" }),
        monthShort: d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
        year: String(y),
        lastDay: String(new Date(Date.UTC(y, m, 0)).getUTCDate()),
        period: `${d.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" })} ${y}`,
      };
      if (!tpl) return `Consulting services — ${vals.month} ${vals.year}`;
      return tpl.replace(/\{(\w+)\}/g, (all, k) => vals[k] ?? all);
    };
    const ids: string[] = [];
    const generated: Line[] = [];
    for (const g of unbilled) {
      if (!nextPicked.has(g.month)) continue;
      for (const e of g.entries) ids.push(e.id);
      /*
       * Tariful se ia din orele DEJA logate, nu din tariful de azi al
       * clientului. Altfel emailul pleaca cu o factura la tariful nou si un
       * raport de activitate care aduna acelasi timp la tariful vechi — doua
       * documente care nu se potrivesc.
       */
      const effective = g.hours > 0 ? g.amount / 100 / g.hours : selectedJob.rateUsd;
      generated.push({
        description: lineFor(g.month),
        unit: "h",
        quantity: String(g.hours),
        unitPrice: String(Math.round(effective * 100) / 100),
      });
    }
    // Keep manual (non-generated) lines around; replace the previous batch
    // of auto lines. We use a marker on the description prefix.
    setLines((prev) => {
      const generatedNow = new Set(generated.map((g) => g.description));
      const prevGenerated = new Set(
        (unbilled ?? []).map((g) => lineFor(g.month)),
      );
      const manual = prev.filter(
        (l) =>
          !prevGenerated.has(l.description) &&
          !generatedNow.has(l.description) &&
          !l.description.startsWith("Consulting services — "),
      );
      // If everything's been removed manually but the user picks months
      // again, drop the empty placeholder.
      const cleaned = manual.filter(
        (l) => l.description.trim() || Number(l.unitPrice) > 0,
      );
      return [...generated, ...cleaned];
    });
    setLinkedIncomeIds(ids);
  }

  function toggleMonth(ym: string) {
    setPickedMonths((cur) => {
      const next = new Set(cur);
      if (next.has(ym)) next.delete(ym);
      else next.add(ym);
      addPickedToLines(next);
      return next;
    });
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

  // Refs, nu state: functia async de mai jos are nevoie de valoarea de ACUM,
  // nu de cea capturata cand a pornit cererea.
  const currencyRef = useRef(invoiceCurrency);
  const issuedAtRef = useRef(issuedAt);
  useEffect(() => {
    currencyRef.current = invoiceCurrency;
    issuedAtRef.current = issuedAt;
  }, [invoiceCurrency, issuedAt]);

  /*
   * Aceeasi regula ca in ruta POST (`deriveVat`), ca previzualizarea sa arate
   * exact ce se salveaza. Diferenta dintre "scutit art. 310" si "taxare
   * inversa" nu e cosmetica — e ce scrie pe factura la ANAF.
   */
  const { vatRate, kind: vatKind } = useMemo(
    () => deriveVat(companyCountry, roVatRate, issuer.vatRegistered),
    [companyCountry, roVatRate, issuer.vatRegistered],
  );
  const vatLabel =
    vatKind === "eu_reverse"
      ? "Reverse charge (art. 196)"
      : vatKind === "export"
        ? "Out of scope (art. 278)"
        : vatKind === "exempt_310"
          ? "Exempt (art. 310)"
          : `${Math.round(vatRate * 100)}% VAT`;

  const needsBnrRate = invoiceCurrency !== "RON";
  const bnrRateNum = Number(bnrRate) || 0;
  const legalTotal = needsBnrRate && bnrRateNum > 0 ? subtotal * bnrRateNum : subtotal;

  // Pull the official BNR reference rate. Returns true if a rate was set.
  async function fetchBnrRate(force = false) {
    if (invoiceCurrency === "RON") return false;
    if (bnrLoading) return false;
    if (!force && bnrRate.trim()) return false;
    /*
     * Snapshot what we are asking about. Change the currency from EUR to USD
     * while the EUR request is still in flight and the late answer would land
     * in the field as if it were the USD rate — a wrong BNR rate on a filed
     * invoice, which is the one number ANAF actually checks. The guard below
     * throws away any answer that no longer matches the form.
     */
    const askedCurrency = invoiceCurrency;
    const askedDate = issuedAt;
    setBnrLoading(true);
    try {
      const res = await fetch(
        `/api/bnr-rate?currency=${askedCurrency}&date=${askedDate}`,
      );
      const data = await res.json();
      if (
        askedCurrency !== currencyRef.current ||
        askedDate !== issuedAtRef.current
      ) {
        return false; // stale answer, the form moved on
      }
      if (!res.ok || typeof data.rate !== "number") {
        toast.error(data?.error ?? "Could not fetch BNR rate");
        return false;
      }
      setBnrRate(String(data.rate));
      setBnrSource({ date: data.date, fellBack: !!data.fellBack });
      if (data.fellBack) {
        toast.info(`Used BNR rate from ${data.date} (no publication for ${issuedAt})`);
      }
      return true;
    } catch (err) {
      toast.error(`Could not fetch BNR rate: ${err instanceof Error ? err.message : "unknown"}`);
      return false;
    } finally {
      setBnrLoading(false);
    }
  }

  // Auto-fill the rate whenever the currency turns non-RON or the issue
  // date changes, unless the user already typed something custom.
  useEffect(() => {
    if (!needsBnrRate) return;
    // Reset stale source label if currency switches.
    setBnrSource(null);
    fetchBnrRate(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceCurrency, issuedAt]);

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
        // Snapshot, ca si restul datelor clientului: judetul de la emitere
        // ramane pe factura si daca fisa clientului se schimba.
        clientCounty:
          companyCountry.trim().toUpperCase() === "RO" ? companyCounty || null : null,
        issuedAt,
        dueAt: dueAt || null,
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
        incomeIds: linkedIncomeIds.length ? linkedIncomeIds : undefined,
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
    const label = `${data.invoice.series} ${data.invoice.number}`;

    /*
     * ANAF / Oblio dupa, nu inainte: daca al doilea pas cade, factura din
     * aplicatie ramane buna si panoul de pe pagina ei o poate trimite mai
     * tarziu. Invers, o factura la ANAF fara pereche in aplicatie nu se poate
     * repara decat cu o stornare.
     */
    if (toAnaf && anafReady) {
      try {
        const r = await fetch(`/api/invoices/${data.invoice.id}/efactura/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force: !anafRequired }),
        });
        const out = await r.json().catch(() => ({}));
        if (!r.ok) {
          toast.warning(`${label} created — ANAF did not take it`, {
            description:
              Array.isArray(out?.details) && out.details.length
                ? out.details[0]
                : typeof out?.error === "string"
                  ? out.error
                  : undefined,
          });
        } else {
          const st = out?.submission?.state as string | undefined;
          toast.success(`${label} created · sent to ANAF`, {
            description:
              st === "ok"
                ? "Validated by ANAF."
                : st === "nok"
                  ? "Rejected by ANAF — see the invoice page."
                  : out?.submission?.indexIncarcare
                    ? `index_incarcare ${out.submission.indexIncarcare} · in prelucrare`
                    : undefined,
          });
        }
      } catch (err) {
        toast.warning(`${label} created — ANAF could not be reached`, {
          description: err instanceof Error ? err.message : undefined,
        });
      }
    } else if (toOblio && oblioReady && !anafReady) {
      try {
        const o = await fetch(`/api/invoices/${data.invoice.id}/oblio`, {
          method: "POST",
        });
        const ob = await o.json().catch(() => ({}));
        if (!o.ok) {
          toast.warning(`${label} created — but Oblio refused it`, {
            description: typeof ob?.error === "string" ? ob.error : undefined,
          });
        } else {
          toast.success(`${label} created · Oblio ${ob.oblioNumber ?? "ok"}`, {
            description: "Oblio forwards it to SPV.",
          });
        }
      } catch (err) {
        toast.warning(`${label} created — Oblio could not be reached`, {
          description: err instanceof Error ? err.message : undefined,
        });
      }
    } else {
      toast.success(`Invoice ${label} created`);
    }
    router.push(`/invoices/${data.invoice.id}`);
  }

  const valid =
    clientName.trim() &&
    companyName.trim() &&
    lines.some((l) => l.description.trim() && Number(l.unitPrice) > 0) &&
    (!needsBnrRate || bnrRateNum > 0);

  const previewInvoice = {
    series,
    number: nextNumber,
    issuedAt,
    dueAt: dueAt || null,
    clientCompany: companyName || clientName,
    clientCui: companyCui,
    clientReg: companyReg,
    clientAddress: companyAddress,
    clientCountry: companyCountry,
    invoiceCurrency,
    bnrRate: needsBnrRate ? bnrRateNum : null,
    vatRate,
    footerNote: footerNote || null,
    lines: lines.map((l) => ({
      description: l.description,
      unit: l.unit || "buc",
      quantity: Number(l.quantity) || 0,
      unitPrice: Number(l.unitPrice) || 0,
    })),
  };

  return (
    /*
     * Formular in stanga, factura in dreapta. Pe ecran lat coloana din dreapta
     * statea goala, iar singurul mod de a vedea ce iese era sa salvezi mai
     * intai. Sub xl previzualizarea trece dedesubt, in ordinea fireasca de
     * citire pe telefon.
     */
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6 xl:gap-8 items-start">
      <div className="space-y-6 min-w-0">
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
        <Field label="Due at">
          <Input
            type="date"
            value={dueAt}
            min={issuedAt}
            onChange={(e) => {
              setDueAtTouched(true);
              setDueAt(e.target.value);
            }}
          />
        </Field>
        {needsBnrRate && (
          <Field label={`BNR rate ${invoiceCurrency}/RON`}>
            <div className="flex gap-1.5">
              <Input
                type="number"
                step="0.0001"
                min="0"
                value={bnrRate}
                onChange={(e) => {
                  setBnrRate(e.target.value);
                  setBnrSource(null);
                }}
                placeholder={bnrLoading ? "Loading…" : "e.g. 4.4085"}
                disabled={bnrLoading}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => fetchBnrRate(true)}
                disabled={bnrLoading}
                title="Re-fetch BNR rate"
                aria-label="Re-fetch BNR rate"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", bnrLoading && "animate-spin")} />
              </Button>
            </div>
            {bnrSource && (
              <p className="text-[10px] text-muted-foreground mt-1">
                BNR · {bnrSource.date}
                {bnrSource.fellBack && " (rolled back to last business day)"}
              </p>
            )}
          </Field>
        )}
      </div>

      {/* Fisa clientului — se vede, nu se editeaza. */}
      {selectedJob ? (
        <div className="rounded-md border border-border bg-secondary/30 px-4 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Billed to
            </Label>
            <Link
              href="/settings"
              className="text-[11px] text-accent underline-offset-4 hover:underline"
            >
              Edit in settings
            </Link>
          </div>
          <div className="mt-2 text-sm font-medium">{companyName || clientName}</div>
          <dl className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-[11.5px]">
            <Ro label="CIF / VAT ID" value={companyCui} />
            <Ro label="Reg.com / CVR" value={companyReg} />
            <Ro label="Address" value={companyAddress} className="sm:col-span-2" />
            <Ro label="Country" value={companyCountry} />
            <Ro label="VAT treatment" value={vatLabel} />
          </dl>
        </div>
      ) : (
        <p className="rounded-md border border-border bg-secondary/30 px-4 py-3 text-xs text-muted-foreground">
          Pick a client to fill the company block.
        </p>
      )}

      {/* Unbilled hours picker — pull periods straight from the time
          tracker. Each picked month becomes a "Consulting services — Apr
          2026" line at the client's rate, and the corresponding Income
          rows get tagged with this invoice on save. */}
      {jobId && (
        <div className="space-y-2 rounded-md border border-border bg-secondary/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-accent" />
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Pull from time tracker
            </Label>
          </div>
          {unbilledLoading ? (
            <p className="text-xs text-muted-foreground">Looking up unbilled hours…</p>
          ) : !unbilled || unbilled.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No unbilled hours for {selectedJob?.name ?? "this client"}.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {unbilled.map((g) => {
                const picked = pickedMonths.has(g.month);
                const label = new Date(`${g.month}-15T12:00:00Z`).toLocaleDateString(
                  "en-US",
                  { month: "short", year: "numeric" },
                );
                return (
                  <button
                    key={g.month}
                    type="button"
                    onClick={() => toggleMonth(g.month)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-all duration-200 ease-expo",
                      picked
                        ? "border-accent bg-accent/15 text-accent"
                        : "border-border hover:border-foreground/40",
                    )}
                  >
                    <span className="font-medium">{label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {fmtDuration(g.hours)}
                      {selectedJob && (
                        <>
                          {" · "}
                          {fmtCurrency(
                            g.amount,
                            invoiceCurrency,
                          )}
                        </>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

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

      </div>

      <div className="min-w-0 xl:sticky xl:top-6 space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Preview · {series} {nextNumber}
          </Label>
          <span className="text-[11px] text-muted-foreground">
            {vatLabel}
          </span>
        </div>

        <InvoicePreview issuer={issuer} invoice={previewInvoice} />

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 pt-1">
          <div className="min-w-0">
            {anafReady ? (
              <label className="flex items-center gap-2 text-[11px] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={toAnaf}
                  onChange={(e) => setToAnafManual(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[hsl(var(--accent))]"
                />
                <span>
                  Send to ANAF e-Factura on create
                  <span className="text-muted-foreground">
                    {" "}
                    {anafRequired
                      ? "— mandatory, 5 working days"
                      : "— optional for this client (extern=DA)"}
                  </span>
                </span>
              </label>
            ) : oblioReady ? (
              <label className="flex items-center gap-2 text-[11px] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={toOblio}
                  onChange={(e) => setToOblio(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[hsl(var(--accent))]"
                />
                <span>
                  Also issue in Oblio
                  <span className="text-muted-foreground">
                    {" "}
                    — it forwards to SPV
                  </span>
                </span>
              </label>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                {valid
                  ? "The PDF is rendered server-side on save and will match this."
                  : "Pick a client and add at least one priced line."}
              </p>
            )}
          </div>
          <Button
            variant="accent"
            onClick={submit}
            disabled={pending || !valid}
            className="w-full sm:w-auto"
          >
            {pending ? "Creating…" : "Create invoice"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Ro({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline gap-2 min-w-0", className)}>
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className="truncate">{value || "—"}</dd>
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
