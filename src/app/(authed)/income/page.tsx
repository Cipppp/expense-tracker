import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  endOfMonth,
  endOfUTCDay,
  fmtDisplay,
  fmtMonth,
  localISODate,
  startOfMonth,
  startOfUTCDay,
  usdCentsToDisplay,
  weekDates,
  type DisplayCurrency,
} from "@/lib/format";
import { getSettings, incomeToUsdCents } from "@/lib/queries";
import { WeekGrid, type WeekEntry } from "@/components/income/week-grid";
import { LumpSumForm } from "@/components/income/lump-sum-form";
import { LumpSumList } from "@/components/income/lump-sum-list";

export const dynamic = "force-dynamic";

export default async function IncomePage(props: {
  searchParams: Promise<{ week?: string }>;
}) {
  const params = await props.searchParams;
  const anchor = params.week
    ? new Date(`${params.week}T12:00:00`)
    : new Date();
  const days = weekDates(anchor);
  // Span the full UTC calendar days of the week. Stored entries live at
  // noon UTC, so [startOfUTCDay(Mon), endOfUTCDay(Sun)] always catches them
  // regardless of the server's timezone. Don't use the raw `days[i]` here —
  // those are noon-in-server-local-time and miss entries on Vercel (UTC).
  const weekStart = startOfUTCDay(days[0]);
  const weekEnd = endOfUTCDay(days[6]);
  const year = new Date().getFullYear();
  // The "Month" header total tracks whichever month the current week's
  // anchor sits in — navigating weeks rolls the figure forward naturally.
  const anchorYear = anchor.getFullYear();
  const anchorMonth = anchor.getMonth() + 1;
  const monthStart = startOfMonth(anchorYear, anchorMonth);
  const monthEnd = endOfMonth(anchorYear, anchorMonth);

  const [allJobs, weekRows, ytdIncome, monthIncome, lumpSumRows, settings] = await Promise.all([
    db.job.findMany({ orderBy: { name: "asc" } }),
    db.income.findMany({
      where: {
        date: { gte: weekStart, lte: weekEnd },
        jobId: { not: null },
      },
      include: { job: true, invoice: { select: { number: true, series: true } } },
      orderBy: { date: "asc" },
    }),
    db.income.findMany({
      where: { date: { gte: new Date(year, 0, 1) } },
    }),
    db.income.findMany({
      where: { date: { gte: monthStart, lte: monthEnd } },
      select: { amountUsd: true, currency: true },
    }),
    db.income.findMany({
      where: { jobId: null, date: { gte: new Date(year, 0, 1) } },
      orderBy: { date: "desc" },
    }),
    getSettings(),
  ]);

  const activeJobs = allJobs.filter((j) => j.active);
  // Entries carry their own billing currency, so these have to be converted
  // before they can be added up — see incomeToUsdCents.
  const totalYtd = incomeToUsdCents(ytdIncome, settings);
  const totalMonth = incomeToUsdCents(monthIncome, settings);
  const displayCurrency: DisplayCurrency =
    (settings.displayCurrency as DisplayCurrency) ?? "USD";
  const totalYtdDisplay = fmtDisplay(
    usdCentsToDisplay(totalYtd, displayCurrency, settings.fxRonToUsd),
    displayCurrency,
  );
  const totalMonthDisplay = fmtDisplay(
    usdCentsToDisplay(totalMonth, displayCurrency, settings.fxRonToUsd),
    displayCurrency,
  );
  const monthLabel = fmtMonth(anchorYear, anchorMonth);

  const weekEntries: WeekEntry[] = weekRows.map((r) => ({
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
    currency: r.currency,
    invoiceId: r.invoiceId,
    invoiceNumber: r.invoice
      ? `${r.invoice.series} ${r.invoice.number}`
      : null,
  }));

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.07em] text-muted-foreground">
            Income
          </div>
          <h1 className="mt-1.5 text-[30px] sm:text-[44px] leading-[1.02]">Time tracker</h1>
        </div>
        <div className="flex items-start gap-5 sm:gap-8">
          <div className="text-right">
            <div className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground">
              {monthLabel}
            </div>
            <div className="font-display text-lg sm:text-xl tabular-nums text-success">
              {totalMonthDisplay}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground">
              Total YTD
            </div>
            <div className="font-display text-xl sm:text-2xl tabular-nums text-success">
              {totalYtdDisplay}
            </div>
          </div>
        </div>
      </header>

      <Tabs defaultValue="hours">
        <TabsList>
          <TabsTrigger value="hours">Hours</TabsTrigger>
          <TabsTrigger value="projects">Projects / lump-sum</TabsTrigger>
        </TabsList>
        <TabsContent value="hours" className="space-y-6">
          <WeekGrid
            anchorIso={localISODate(anchor)}
            entries={weekEntries}
            jobs={activeJobs.map((j) => ({
              id: j.id,
              name: j.name,
              rateUsd: j.rateUsd,
              color: j.color,
              defaultCurrency: j.defaultCurrency,
            }))}
            fxEurToUsd={settings.fxEurToUsd}
            fxRonToUsd={settings.fxRonToUsd}
          />
        </TabsContent>
        <TabsContent value="projects" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">New project payment</CardTitle>
              <p className="text-sm text-muted-foreground">
                One-off lump sums (e.g. invoiced fixed-price projects).
              </p>
            </CardHeader>
            <Separator />
            <CardContent className="pt-6">
              <LumpSumForm />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">All project payments · {year}</CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="p-0">
              <LumpSumList
                rows={lumpSumRows.map((r) => ({
                  id: r.id,
                  date: r.date.toISOString(),
                  description: r.description,
                  source: r.source,
                  amountUsd: r.amountUsd,
                }))}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
