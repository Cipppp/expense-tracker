"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function ExpenseFilters({
  categories,
  initial,
}: {
  categories: string[];
  initial: {
    category: string;
    minRon: string;
    maxRon: string;
    q: string;
  };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [category, setCategory] = useState(initial.category);
  const [minRon, setMinRon] = useState(initial.minRon);
  const [maxRon, setMaxRon] = useState(initial.maxRon);
  const [q, setQ] = useState(initial.q);

  // Debounced application of search box.
  useEffect(() => {
    const id = setTimeout(() => apply({ q }), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function apply(partial: Partial<{ category: string; minRon: string; maxRon: string; q: string }>) {
    const next = new URLSearchParams(searchParams.toString());
    const values = {
      category,
      minRon,
      maxRon,
      q,
      ...partial,
    };
    for (const [key, value] of Object.entries(values)) {
      if (value && value !== "all") next.set(key, value);
      else next.delete(key);
    }
    startTransition(() => router.push(`/expenses?${next.toString()}`));
  }

  function clearAll() {
    setCategory("all");
    setMinRon("");
    setMaxRon("");
    setQ("");
    const next = new URLSearchParams(searchParams.toString());
    next.delete("category");
    next.delete("minRon");
    next.delete("maxRon");
    next.delete("q");
    startTransition(() => router.push(`/expenses?${next.toString()}`));
  }

  const activeFilterCount =
    (category && category !== "all" ? 1 : 0) +
    (minRon ? 1 : 0) +
    (maxRon ? 1 : 0) +
    (q ? 1 : 0);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative flex-1 min-w-full md:min-w-[200px] md:max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search description…"
          className="pl-9 pr-8 h-10 md:h-9"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Category */}
      <Select
        value={category}
        onValueChange={(v) => {
          setCategory(v);
          apply({ category: v });
        }}
      >
        <SelectTrigger className="h-10 md:h-9 w-full md:w-[180px] flex-1 md:flex-none min-w-[150px]">
          <SelectValue placeholder="All categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Price range popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-10 md:h-9",
              (minRon || maxRon) && "border-accent text-accent",
            )}
          >
            <Filter className="h-3.5 w-3.5" />
            {minRon || maxRon ? (
              <span className="tabular-nums">
                {minRon || "0"}–{maxRon || "∞"} RON
              </span>
            ) : (
              "Price range"
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="end">
          <div className="space-y-3">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Amount (RON)
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="1"
                min="0"
                value={minRon}
                onChange={(e) => setMinRon(e.target.value)}
                placeholder="Min"
                className="num"
              />
              <span className="text-muted-foreground text-xs">to</span>
              <Input
                type="number"
                step="1"
                min="0"
                value={maxRon}
                onChange={(e) => setMaxRon(e.target.value)}
                placeholder="Max"
                className="num"
              />
            </div>
            <div className="flex items-center justify-between gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMinRon("");
                  setMaxRon("");
                  apply({ minRon: "", maxRon: "" });
                }}
                disabled={!minRon && !maxRon}
              >
                Clear
              </Button>
              <Button
                variant="accent"
                size="sm"
                onClick={() => apply({ minRon, maxRon })}
              >
                Apply
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {activeFilterCount > 0 && (
        <Button variant="ghost" size="sm" onClick={clearAll} className="h-9 text-muted-foreground">
          <X className="h-3.5 w-3.5" />
          Clear all
          <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded-full">
            {activeFilterCount}
          </span>
        </Button>
      )}

      {pending && (
        <span className="text-xs text-muted-foreground animate-pulse">Updating…</span>
      )}
    </div>
  );
}
