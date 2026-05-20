"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "@/lib/icons";
import { Button } from "@/components/ui/button";

export function MonthFilter({ year, month }: { year: number; month: number }) {
  const router = useRouter();

  function go(deltaMonths: number) {
    let m = month + deltaMonths;
    let y = year;
    while (m < 1) {
      m += 12;
      y -= 1;
    }
    while (m > 12) {
      m -= 12;
      y += 1;
    }
    router.push(`/expenses?year=${y}&month=${m}`);
  }

  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" size="icon" onClick={() => go(-1)} aria-label="Previous month">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="px-3 text-sm font-medium tabular-nums">
        {new Date(year, month - 1, 1).toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        })}
      </div>
      <Button variant="outline" size="icon" onClick={() => go(1)} aria-label="Next month">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
