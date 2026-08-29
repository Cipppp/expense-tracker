import Link from "next/link";
import { Plus, FileText, WarningCircle } from "@/lib/icons";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtDate, localISODate } from "@/lib/format";
import { getClientInvoicingSummaries } from "@/lib/queries";
import { ClientSummaryTable } from "@/components/invoices/client-summary-table";
import type { WeekEntry } from "@/components/income/week-grid";

export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<
  string,
  "default" | "accent" | "success" | "secondary" | "outline" | "destructive"
> = {
  draft: "secondary",
  issued: "accent",
  paid: "success",
  void: "outline",
};

export default async function InvoicesPage() {
  const year = new Date().getFullYear();
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59);

  const [invoices, clientSummaries, jobs, incomeRows] = await Promise.all([
    db.invoice.findMany({
      orderBy: [{ issuedAt: "desc" }, { seriesNumber: "desc" }],
      include: { lines: true },
    }),
    getClientInvoicingSummaries(year),
    db.job.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.income.findMany({
      where: {
        date: { gte: yearStart, lte: yearEnd },
        jobId: { not: null },
      },
      include: {
        job: true,
        invoice: { select: { number: true, series: true } },
      },
      orderBy: { date: "asc" },
    }),
  ]);

  const total = invoices.length;
  const paid = invoices.filter((i) => i.status === "paid").length;
  // Issued + past dueAt = overdue. Voided / draft are excluded.
  const now = new Date();
  const isOverdue = (inv: { status: string; dueAt: Date | null }) =>
    inv.status === "issued" && inv.dueAt !== null && inv.dueAt < now;
  const overdueCount = invoices.filter(isOverdue).length;

  // Per-job map of WeekEntry — fed to the expandable calendar previews.
  // Pre-bucketing here keeps the client component small and avoids running
  // the same filter for every render of every row.
  const entriesByJob = new Map<string, WeekEntry[]>();
  for (const r of incomeRows) {
    if (!r.jobId) continue;
    const arr = entriesByJob.get(r.jobId) ?? [];
    arr.push({
      id: r.id,
      date: localISODate(r.date),
      jobId: r.jobId,
      jobName: r.job?.name ?? r.source,
      jobColor: r.job?.color ?? "#999999",
      startMinutes: r.startMinutes,
      endMinutes: r.endMinutes,
      hours: r.hours ?? 0,
      amountUsd: r.amountUsd,
      description: r.description,
      currency: r.job?.defaultCurrency ?? "USD",
      invoiceId: r.invoiceId,
      invoiceNumber: r.invoice
        ? `${r.invoice.series} ${r.invoice.number}`
        : null,
    });
    entriesByJob.set(r.jobId, arr);
  }
  const entriesByJobObj = Object.fromEntries(entriesByJob);

  // JobOpt-shaped projection for the time-entry dialog inside each preview.
  const jobOpts = jobs.map((j) => ({
    id: j.id,
    name: j.name,
    rateUsd: j.rateUsd,
    color: j.color,
    defaultCurrency: j.defaultCurrency,
  }));

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.07em] text-muted-foreground">
            Invoices
          </div>
          <h1 className="mt-1.5 text-[30px] sm:text-[44px] leading-[1.02]">All invoices</h1>
        </div>
        <Button asChild variant="accent" size="sm" className="sm:h-10 sm:px-4">
          <Link href="/invoices/new">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New invoice</span>
            <span className="sm:hidden">New</span>
          </Link>
        </Button>
      </header>

      {overdueCount > 0 && (
        <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
          <WarningCircle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
          <div className="text-foreground">
            <span className="font-medium">{overdueCount} overdue</span>
            {" "}
            <span className="text-muted-foreground">
              {overdueCount === 1 ? "invoice has" : "invoices have"} a due date
              in the past and aren&apos;t marked paid yet.
            </span>
          </div>
        </div>
      )}

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">All invoices</TabsTrigger>
          <TabsTrigger value="clients">By client · {year}</TabsTrigger>
        </TabsList>
        <TabsContent value="list" className="mt-6">
          <Card>
        <CardHeader className="flex flex-row items-baseline justify-between">
          <CardTitle className="text-lg">
            {total} {total === 1 ? "invoice" : "invoices"} ·{" "}
            <span className="text-muted-foreground">{paid} paid</span>
          </CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-muted-foreground">
              No invoices yet.{" "}
              <Link
                className="text-accent underline-offset-4 hover:underline"
                href="/invoices/new"
              >
                Create your first one
              </Link>
              .
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {invoices.map((inv) => {
                const total = inv.lines.reduce((a, l) => a + l.amount, 0);
                const overdue = isOverdue(inv);
                return (
                  <Link
                    key={inv.id}
                    href={`/invoices/${inv.id}`}
                    className="grid grid-cols-12 gap-3 items-center px-4 md:px-6 py-3 hover:bg-secondary/40 transition-colors"
                  >
                    <div className="col-span-3 sm:col-span-2 flex items-center gap-2 min-w-0">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium font-mono text-xs">
                        {inv.series} {inv.number}
                      </span>
                    </div>
                    <div className="col-span-6 sm:col-span-5 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {inv.clientCompany}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {fmtDate(inv.issuedAt)}
                        {inv.dueAt && (
                          <>
                            {" · due "}
                            <span
                              className={
                                overdue ? "text-destructive font-medium" : ""
                              }
                            >
                              {fmtDate(inv.dueAt)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="col-span-3 sm:col-span-2 text-right tabular-nums text-sm">
                      {total.toLocaleString("ro-RO", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      <span className="text-[10px] text-muted-foreground">
                        {inv.invoiceCurrency}
                      </span>
                    </div>
                    <div className="col-span-12 sm:col-span-3 flex sm:justify-end gap-1.5">
                      {overdue && (
                        <Badge variant="destructive" className="text-[10px]">
                          overdue
                        </Badge>
                      )}
                      <Badge
                        variant={STATUS_VARIANT[inv.status] ?? "outline"}
                        className="text-[10px]"
                      >
                        {inv.status}
                      </Badge>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="clients" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">By client · {year}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Hours you&apos;ve worked vs. hours actually invoiced. Outstanding
                = what&apos;s ready to bill.
              </p>
            </CardHeader>
            <Separator />
            <CardContent className="p-0">
              <ClientSummaryTable
                clients={clientSummaries}
                entriesByJob={entriesByJobObj}
                jobs={jobOpts}
                thisMonthLabel={new Date().toLocaleDateString("en-US", { month: "short" })}
                lastMonthLabel={new Date(
                  new Date().getFullYear(),
                  new Date().getMonth() - 1,
                  1,
                ).toLocaleDateString("en-US", { month: "short" })}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
