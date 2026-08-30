"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown } from "@/lib/icons";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const STATUSES = ["draft", "issued", "paid", "void"] as const;
export type InvoiceStatus = (typeof STATUSES)[number];

const TONE: Record<string, string> = {
  draft: "bg-secondary text-muted-foreground border-border",
  issued: "bg-accent/15 text-accent-text dark:text-accent border-accent/30",
  paid: "bg-success/15 text-success border-success/30",
  void: "bg-destructive/10 text-destructive border-destructive/25",
};

/**
 * Schimba statusul direct din lista, fara sa deschizi factura.
 *
 * Conteaza mai mult decat pare: Earned numara doar veniturile incasate, deci
 * bifarea unei facturi ca platita e ce muta banii in dashboard. Sa fie nevoie
 * de doua pagini pentru asta insemna ca cifra ramanea gresita pana te
 * osteneai.
 */
export function InvoiceStatusPicker({
  invoiceId,
  status,
  overdue = false,
}: {
  invoiceId: string;
  status: string;
  overdue?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [optimistic, setOptimistic] = useState<string | null>(null);
  const shown = optimistic ?? status;

  function change(next: InvoiceStatus) {
    if (next === shown) return;
    setOptimistic(next);
    start(async () => {
      const body: Record<string, unknown> = { status: next };
      // Marcarea ca platita fara data face venitul sa cada pe ziua de azi;
      // ziua de azi e raspunsul corect cand nu stii alta.
      if (next === "paid") body.paidAt = new Date().toISOString().slice(0, 10);
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setOptimistic(null);
        const err = await res.json().catch(() => ({}));
        toast.error("Couldn't change the status", {
          description: typeof err?.error === "string" ? err.error : undefined,
        });
        return;
      }
      toast.success(`Marked ${next}`);
      router.refresh();
      setOptimistic(null);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          // Randul e un <Link>; fara asta un clic pe status deschide factura.
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          disabled={pending}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
            "text-[10px] font-semibold transition-all duration-200 ease-expo",
            "hover:brightness-110 disabled:opacity-60",
            TONE[shown] ?? TONE.draft,
          )}
        >
          {shown}
          {overdue && shown === "issued" ? " · overdue" : ""}
          <ChevronDown className="h-2.5 w-2.5 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {STATUSES.map((s) => (
          <DropdownMenuItem
            key={s}
            onSelect={() => change(s)}
            className={cn("text-xs", s === shown && "font-semibold")}
          >
            <span
              className={cn(
                "inline-block h-2 w-2 rounded-full mr-2 border",
                TONE[s],
              )}
            />
            {s}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
