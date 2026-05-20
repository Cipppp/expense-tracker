"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Two themed dropdowns for hour + minute, replacing native <input type=time>.
 * Hour: 00–23, minute: in steps of `stepMinutes` (default 15).
 *
 * Value uses minutes-since-the-day's-start. Values >= 1440 are interpreted
 * as "next day" — the picker shows wall-clock (hour mod 24) and onChange
 * emits the picker's wall-clock value; the parent decides how to combine
 * with its start time to detect overnight (see time-entry-dialog).
 */
export function TimePicker({
  value,
  onChange,
  stepMinutes = 15,
  id,
}: {
  value: number;
  onChange: (v: number) => void;
  stepMinutes?: number;
  id?: string;
}) {
  const safe = Math.max(0, value);
  const hour = Math.floor(safe / 60) % 24;
  const minute = safe % 60;

  // Snap minute to step grid.
  const snapped = Math.round(minute / stepMinutes) * stepMinutes;

  const hours = React.useMemo(
    () => Array.from({ length: 24 }, (_, i) => i),
    [],
  );
  const minutes = React.useMemo(
    () =>
      Array.from(
        { length: Math.floor(60 / stepMinutes) },
        (_, i) => i * stepMinutes,
      ),
    [stepMinutes],
  );

  function setHour(h: number) {
    onChange(h * 60 + snapped);
  }
  function setMinute(m: number) {
    onChange(hour * 60 + m);
  }

  return (
    <div className="flex items-center gap-1" id={id}>
      <Select value={String(hour)} onValueChange={(v) => setHour(Number(v))}>
        <SelectTrigger className="w-[68px] tabular-nums">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-[260px]">
          {hours.map((h) => (
            <SelectItem key={h} value={String(h)} className="tabular-nums">
              {String(h).padStart(2, "0")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-muted-foreground">:</span>
      <Select
        value={String(snapped)}
        onValueChange={(v) => setMinute(Number(v))}
      >
        <SelectTrigger className="w-[68px] tabular-nums">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {minutes.map((m) => (
            <SelectItem key={m} value={String(m)} className="tabular-nums">
              {String(m).padStart(2, "0")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
