import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ImportDropzone } from "@/components/import/dropzone";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const recent = await db.importBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <div className="space-y-8 max-w-4xl">
      <header>
        <div className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
          Import
        </div>
        <h1 className="mt-1 font-display text-4xl tracking-tight">Revolut CSV</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
          Drop one or more Revolut statement CSVs below. Only RON expenses with
          state <span className="font-mono text-foreground">COMPLETED</span> are imported. Dedup
          preserves twin transactions and skips cross-import duplicates automatically.
        </p>
      </header>

      <Card>
        <CardContent className="p-6">
          <ImportDropzone />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent imports</CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          {recent.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              No imports yet.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recent.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between px-6 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{b.filename}</div>
                    <div className="text-xs text-muted-foreground">
                      {fmtDate(b.createdAt)} ·{" "}
                      {b.createdAt.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-xs tabular-nums">
                    <span className="text-muted-foreground">
                      Read{" "}
                      <span className="text-foreground font-medium">{b.rowsRead}</span>
                    </span>
                    <span className="text-success">
                      Inserted{" "}
                      <span className="font-medium">{b.rowsInsert}</span>
                    </span>
                    <span className="text-muted-foreground">
                      Skipped{" "}
                      <span className="text-foreground font-medium">{b.rowsSkipped}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
