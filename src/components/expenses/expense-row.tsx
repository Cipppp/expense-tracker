"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { fmtRon, fmtUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

const CATEGORY_COLORS: Record<
  string,
  "default" | "accent" | "success" | "warning" | "destructive" | "secondary" | "outline"
> = {
  Food: "accent",
  Groceries: "success",
  Transport: "warning",
  Health: "destructive",
  Bills: "secondary",
  Subscriptions: "secondary",
  Shopping: "accent",
  Transfer: "outline",
  Savings: "outline",
  Other: "outline",
};

export type ExpenseRowData = {
  id: string;
  date: string;          // ISO yyyy-mm-dd
  dateShort: string;     // e.g. "18 May"
  description: string;
  category: string;
  amountRon: number;
  amountUsd: number;
  excluded: boolean;
  isHotDay: boolean;
};

export function ExpenseRow({ row }: { row: ExpenseRowData }) {
  const router = useRouter();
  const [optimisticExcluded, setOptimisticExcluded] = useState(row.excluded);
  const [pending, startTransition] = useTransition();

  async function toggle() {
    const next = !optimisticExcluded;
    setOptimisticExcluded(next);
    const res = await fetch(`/api/expenses/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ excluded: next }),
    });
    if (!res.ok) {
      setOptimisticExcluded(!next);
      toast.error("Failed to update");
      return;
    }
    toast.success(next ? "Excluded from analytics" : "Included again");
    startTransition(() => router.refresh());
  }

  return (
    <tr
      className={cn(
        "group/row transition-colors",
        optimisticExcluded
          ? "bg-muted/40 opacity-60"
          : "hover:bg-secondary/40",
        pending && "animate-pulse",
      )}
    >
      <td className="px-4 py-2 whitespace-nowrap text-xs text-muted-foreground tabular-nums">
        {row.dateShort}
      </td>
      <td className="px-4 py-2">
        <span
          className={cn(
            "font-medium",
            optimisticExcluded && "line-through decoration-1",
          )}
        >
          {row.description}
        </span>
      </td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-1.5">
          <Badge
            variant={CATEGORY_COLORS[row.category] ?? "outline"}
            className={cn(
              "text-[10px] font-normal",
              optimisticExcluded && "opacity-70",
            )}
          >
            {row.category}
          </Badge>
          {optimisticExcluded && (
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
              excluded
            </span>
          )}
        </div>
      </td>
      <td
        className={cn(
          "px-4 py-2 text-right tabular-nums whitespace-nowrap font-semibold",
          optimisticExcluded
            ? "text-muted-foreground line-through decoration-1 font-normal"
            : row.isHotDay
              ? "text-destructive"
              : "",
        )}
      >
        -{fmtRon(row.amountRon).replace("- ", "")}
      </td>
      <td
        className={cn(
          "px-4 py-2 text-right tabular-nums text-muted-foreground whitespace-nowrap font-medium",
          optimisticExcluded && "line-through decoration-1 font-normal",
        )}
      >
        -{fmtUsd(row.amountUsd).replace("-", "")}
      </td>
      <td className="px-2 py-2 text-right w-[44px] md:w-[40px]">
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          aria-label={
            optimisticExcluded ? "Include" : "Exclude from analytics"
          }
          title={
            optimisticExcluded
              ? "Include in analytics"
              : "Exclude from analytics"
          }
          className={cn(
            "inline-flex items-center justify-center rounded-md transition-all duration-150 ease-expo h-9 w-9 md:h-7 md:w-7",
            optimisticExcluded
              ? "opacity-100 text-muted-foreground hover:text-foreground hover:bg-secondary"
              : "opacity-100 md:opacity-0 md:group-hover/row:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10",
          )}
        >
          {optimisticExcluded ? (
            <Eye className="h-4 w-4 md:h-3.5 md:w-3.5" />
          ) : (
            <EyeOff className="h-4 w-4 md:h-3.5 md:w-3.5" />
          )}
        </button>
      </td>
    </tr>
  );
}
