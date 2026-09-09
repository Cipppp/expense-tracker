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
    <div className="space-y-8">
      <header>
        <div className="text-xs uppercase tracking-[0.07em] text-muted-foreground">
          Import
        </div>
        <h1 className="mt-1.5 text-[30px] sm:text-[44px] leading-[1.02]">
          Extrase de cont
        </h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
          Două surse, două zone. Fișierele sunt recunoscute după antet, deci
          nimic nu se strică dacă le încurci — zonele separate sunt ca să știi
          ce cauți. Deduplicarea păstrează tranzacțiile gemene și sare peste
          rândurile deja importate.
        </p>
      </header>

      {/*
        Pe lat, cele doua zone stau in stanga si istoricul in dreapta. Cu
        totul intr-o coloana de 4xl, jumatate de ecran ramanea gol si trebuia
        sa dai scroll ca sa vezi daca importul de acum un minut a intrat.
      */}
      <div className="grid grid-cols-1 gap-4 items-start xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(320px,0.9fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Personal — Revolut</CardTitle>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              Cheltuielile de pe cardul tău. Se importă doar rândurile în RON cu
              starea <span className="font-mono text-foreground">COMPLETED</span>.
            </p>
          </CardHeader>
          <Separator />
          <CardContent className="p-6">
            <ImportDropzone variant="revolut" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Firmă — ING Business</CardTitle>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              Toate cele trei conturi. Din ele ies taxele plătite, dividendele
              scoase și cheltuielile firmei — marcate separat în dashboard.
            </p>
          </CardHeader>
          <Separator />
          <CardContent className="p-6">
            <ImportDropzone variant="ing" />
          </CardContent>
        </Card>

      <Card className="xl:max-h-[640px] xl:overflow-auto">
        <CardHeader>
          <CardTitle className="text-lg">Ultimele importuri</CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          {recent.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              Niciun import încă.
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
    </div>
  );
}
