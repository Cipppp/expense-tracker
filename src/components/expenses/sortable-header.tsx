"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Dir = "asc" | "desc";

export function SortableHeader({
  field,
  label,
  align = "left",
  defaultDir = "desc",
}: {
  field: string;
  label: string;
  align?: "left" | "right";
  defaultDir?: Dir;
}) {
  const params = useSearchParams();
  const activeSort = params.get("sort");
  const activeDir = (params.get("dir") as Dir | null) ?? "desc";
  const isActive = activeSort === field || (activeSort == null && field === "date");

  // Toggle: if active, flip direction. If not active, use defaultDir.
  let nextDir: Dir;
  if (isActive && activeSort !== null) {
    nextDir = activeDir === "asc" ? "desc" : "asc";
  } else {
    nextDir = defaultDir;
  }

  const nextParams = new URLSearchParams(params.toString());
  nextParams.set("sort", field);
  nextParams.set("dir", nextDir);

  const Icon =
    !isActive ? ArrowUpDown : activeDir === "asc" ? ArrowUp : ArrowDown;

  return (
    <Link
      href={`?${nextParams.toString()}`}
      scroll={false}
      className={cn(
        "inline-flex items-center gap-1 group/sort hover:text-foreground transition-colors duration-150 ease-expo",
        align === "right" && "flex-row-reverse",
        isActive ? "text-foreground" : "text-muted-foreground",
      )}
    >
      <span>{label}</span>
      <Icon
        className={cn(
          "h-3 w-3 transition-opacity duration-150",
          isActive ? "opacity-100" : "opacity-40 group-hover/sort:opacity-80",
        )}
      />
    </Link>
  );
}
