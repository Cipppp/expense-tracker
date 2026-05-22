"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { DisplayCurrency } from "@/lib/format";

/**
 * Segmented control that flips the app's display currency between USD and
 * RON. Persists to /api/settings (a partial PATCH that only writes the one
 * field), then router.refresh()es so server-rendered pages re-fetch with
 * the new preference.
 */
export function CurrencyToggle({
  value,
  fxRonToUsd,
}: {
  value: DisplayCurrency;
  fxRonToUsd: number;
}) {
  const router = useRouter();
  const [optimistic, setOptimistic] = useState<DisplayCurrency>(value);
  const [pending, startTransition] = useTransition();

  async function set(next: DisplayCurrency) {
    if (next === optimistic) return;
    setOptimistic(next);
    startTransition(async () => {
      try {
        await fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayCurrency: next }),
        });
        router.refresh();
      } catch {
        // Best-effort; let next refresh reconcile.
      }
    });
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <div className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground">
        Currency
      </div>
      <div
        className={cn(
          "inline-flex items-center rounded-md border border-border bg-secondary/40 p-0.5",
          pending && "opacity-70",
        )}
        role="group"
        aria-label="Display currency"
      >
        {(["USD", "RON"] as const).map((c) => {
          const active = optimistic === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => set(c)}
              className={cn(
                "px-2.5 py-1 text-xs font-medium tabular-nums rounded transition-colors duration-200 ease-expo",
                active
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-pressed={active}
            >
              {c}
            </button>
          );
        })}
      </div>
      <div className="text-[10px] font-mono text-muted-foreground/70 tabular-nums">
        1 RON ≈ ${fxRonToUsd.toFixed(4)}
      </div>
    </div>
  );
}
