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
};

export function ImportDropzone() {
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
        if (!res.ok) throw new Error(data?.error ?? "Import failed");
        setLast(data);
        toast.success(
          `Inserted ${data.totals.rowsInserted} new transaction${data.totals.rowsInserted === 1 ? "" : "s"}`,
          {
            description: `Read ${data.totals.rowsRead} · skipped ${data.totals.rowsSkipped}`,
          },
        );
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Import failed");
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
              {isDragActive ? "Drop the files here…" : "Drop Revolut CSVs"}
            </div>
            <div className="text-sm text-muted-foreground">
              or click to choose · multiple files supported
            </div>
          </div>
        </div>
      </div>

      {last && (
        <div className="rounded-md border border-border bg-card p-4 space-y-2 animate-fade-in">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileSpreadsheet className="h-4 w-4 text-accent" />
            Last import
          </div>
          <div className="space-y-1">
            {last.summaries.map((s) => (
              <div
                key={s.filename}
                className="flex items-center justify-between text-xs text-muted-foreground tabular-nums"
              >
                <span className="truncate">{s.filename}</span>
                <span>
                  read {s.rowsRead} · inserted{" "}
                  <span className="text-success font-medium">{s.rowsInserted}</span> ·
                  skipped {s.rowsSkipped}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
