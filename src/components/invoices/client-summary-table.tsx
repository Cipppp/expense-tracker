"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronUp, ChevronDown } from "@/lib/icons";
import { fmtCurrency, fmtDate, fmtDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ClientInvoicingSummary } from "@/lib/queries";

type SortKey =
  | "name"
  | "hoursWorked"
  | "hoursInvoiced"
  | "hoursOutstanding"
  | "amountInvoiced"
  | "lastInvoiceAt";

const COLS: Array<{ key: SortKey; label: string; align: "left" | "right" }> = [
  { key: "name", label: "Client", align: "left" },
  { key: "hoursWorked", label: "Worked YTD", align: "right" },
  { key: "hoursInvoiced", label: "Invoiced", align: "right" },
  { key: "hoursOutstanding", label: "Outstanding", align: "right" },
  { key: "amountInvoiced", label: "Total invoiced", align: "right" },
  { key: "lastInvoiceAt", label: "Last invoice", align: "right" },
];

export function ClientSummaryTable({
  clients,
}: {
  clients: ClientInvoicingSummary[];
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>(
    { key: "hoursOutstanding", dir: "desc" },
  );

  const sorted = useMemo(() => {
    const arr = [...clients];
    const { key, dir } = sort;
    const mult = dir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (av === null && bv === null) return 0;
      if (av === null) return 1; // nulls last regardless of direction
      if (bv === null) return -1;
      if (av instanceof Date && bv instanceof Date)
        return (av.getTime() - bv.getTime()) * mult;
      if (typeof av === "number" && typeof bv === "number")
        return (av - bv) * mult;
      return String(av).localeCompare(String(bv)) * mult;
    });
    return arr;
  }, [clients, sort]);

  function toggle(key: SortKey) {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "name" ? "asc" : "desc" },
    );
  }

  if (clients.length === 0) {
    return (
      <div className="px-6 py-12 text-center text-sm text-muted-foreground">
        No clients yet. Add one in{" "}
        <Link
          className="text-accent underline-offset-4 hover:underline"
          href="/settings"
        >
          Settings → Clients
        </Link>
        .
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-secondary/30 text-[10px] uppercase tracking-wider text-muted-foreground">
            {COLS.map((c) => {
              const isActive = sort.key === c.key;
              const Icon = sort.dir === "asc" ? ChevronUp : ChevronDown;
              return (
                <th
                  key={c.key}
                  className={cn(
                    "py-2.5 px-4 font-medium cursor-pointer select-none",
                    c.align === "right" ? "text-right" : "text-left",
                  )}
                  onClick={() => toggle(c.key)}
                >
                  <span
                    className={cn(
                      "inline-flex items-center gap-1",
                      c.align === "right" && "justify-end",
                    )}
                  >
                    {c.label}
                    {isActive && <Icon className="h-3 w-3" />}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {sorted.map((c) => (
            <tr key={c.jobId} className="hover:bg-secondary/30 transition-colors">
              <td className="py-2.5 px-4">
                <span className="inline-flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: c.color }}
                  />
                  <span className="font-medium">{c.name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {c.currency}
                  </span>
                </span>
              </td>
              <td className="py-2.5 px-4 text-right tabular-nums">
                {fmtDuration(c.hoursWorked)}
              </td>
              <td className="py-2.5 px-4 text-right tabular-nums text-muted-foreground">
                {fmtDuration(c.hoursInvoiced)}
              </td>
              <td
                className={cn(
                  "py-2.5 px-4 text-right tabular-nums font-medium",
                  c.hoursOutstanding > 0 && "text-accent",
                )}
              >
                {fmtDuration(c.hoursOutstanding)}
              </td>
              <td className="py-2.5 px-4 text-right tabular-nums">
                {c.amountInvoiced > 0
                  ? fmtCurrency(Math.round(c.amountInvoiced * 100), c.currency)
                  : "—"}
              </td>
              <td className="py-2.5 px-4 text-right tabular-nums text-muted-foreground text-xs">
                {c.lastInvoiceAt ? fmtDate(c.lastInvoiceAt) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
