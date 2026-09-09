"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Loader2 } from "@/lib/icons";
import { cn } from "@/lib/utils";

type Summary = {
  filename: string;
  rowsRead: number;
  rowsInserted: number;
  rowsSkipped: number;
  /** Prezent doar pe extrasele ING — defalcarea pe ce a produs fisierul. */
  kind?: "ing";
  currency?: string;
  taxesInserted?: number;
  payoutsInserted?: number;
  expensesInserted?: number;
  ownerUnset?: boolean;
  skippedOtherCurrency?: number;
  skippedCurrencies?: string[];
};

/**
 * Zona de incarcare. `variant` schimba doar textul: fisierul e recunoscut
 * oricum dupa antet, deci un extras ING aruncat in zona de Revolut se importa
 * corect — zonele separate exista ca sa stii ce cauti, nu ca sa te oblige.
 */
export function ImportDropzone({
  variant = "revolut",
}: {
  variant?: "revolut" | "ing";
} = {}) {
  const [pending, setPending] = useState(false);
  const [last, setLast] = useState<{
    totals: { rowsRead: number; rowsInserted: number; rowsSkipped: number };
    summaries: Summary[];
  } | null>(null);
  const router = useRouter();

  const onDrop = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setPending(true);
      const fd = new FormData();
      for (const f of files) fd.append("file", f);

      try {
        const res = await fetch("/api/import", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Importul a eșuat");
        setLast(data);
        toast.success(
          `${data.totals.rowsInserted} rânduri noi`,
          {
            description: `Citite ${data.totals.rowsRead} · sărite ${data.totals.rowsSkipped}`,
          },
        );
        /*
         * Fara numele asociatului in Settings nu avem cum sti care virament e
         * dividend. Importul reuseste, dar impozitul pe dividende va lipsi din
         * estimare — si asta trebuie spus, nu lasat sa se vada peste o luna.
         */
        if (data.summaries?.some((x: Summary) => x.ownerUnset)) {
          toast.warning("Nu știu cine e asociatul", {
            description:
              "Completează „Asociat” în Settings, altfel dividendele trec drept cheltuieli de firmă.",
          });
        }
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Importul a eșuat");
      } finally {
        setPending(false);
      }
    },
    [router],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"], "text/plain": [".csv"] },
    multiple: true,
    disabled: pending,
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-all duration-200 ease-expo",
          isDragActive
            ? "border-accent bg-accent/5"
            : "border-border hover:border-accent/40 hover:bg-secondary/40",
          pending && "opacity-60 cursor-wait",
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          {pending ? (
            <Loader2 className="h-8 w-8 text-accent animate-spin" />
          ) : (
            <div className="rounded-full bg-accent/10 p-3">
              <Upload className="h-6 w-6 text-accent" />
            </div>
          )}
          <div className="space-y-1">
            <div className="font-display text-lg">
              {isDragActive
                ? "Dă-le drumul aici…"
                : variant === "ing"
                  ? "Extrase ING Business"
                  : "Extrase Revolut"}
            </div>
            <div className="text-sm text-muted-foreground">
              {variant === "ing"
                ? "sau apasă ca să alegi · toate cele trei conturi odată — RON, EUR, USD"
                : "sau apasă ca să alegi · mai multe fișiere deodată"}
            </div>
          </div>
        </div>
      </div>

      {last && (
        <div className="rounded-md border border-border bg-card p-4 space-y-2 animate-fade-in">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileSpreadsheet className="h-4 w-4 text-accent" />
            Ultimul import
          </div>
          <div className="space-y-1">
            {last.summaries.map((s) => (
              <div
                key={s.filename}
                className="flex items-center justify-between text-xs text-muted-foreground tabular-nums"
              >
                <span className="truncate">{s.filename}</span>
                <span>
                  {s.kind === "ing" ? (
                    <>
                      {s.currency} · {s.taxesInserted ?? 0} taxe ·{" "}
                      {s.payoutsInserted ?? 0} dividende ·{" "}
                      <span className="text-success font-medium">
                        {s.expensesInserted ?? 0}
                      </span>{" "}
                      cheltuieli
                    </>
                  ) : (
                    <>
                      citite {s.rowsRead} · adăugate{" "}
                      <span className="text-success font-medium">
                        {s.rowsInserted}
                      </span>{" "}
                      · sărite {s.rowsSkipped}
                      {(s.skippedOtherCurrency ?? 0) > 0 && (
                        <>
                          {" "}
                          ·{" "}
                          <span className="text-warning">
                            {s.skippedOtherCurrency} în{" "}
                            {(s.skippedCurrencies ?? []).join("/")}
                          </span>
                        </>
                      )}
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
