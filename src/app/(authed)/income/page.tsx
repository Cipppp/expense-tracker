import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtUsd, localISODate, weekDates } from "@/lib/format";
import { WeekView, type WeekEntry } from "@/components/income/week-view";
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
  const weekStart = days[0];
  const weekEnd = new Date(days[6]);
  weekEnd.setHours(23, 59, 59, 999);
  const year = new Date().getFullYear();

  const [allJobs, weekRows, ytdIncome, lumpSumRows] = await Promise.all([
    db.job.findMany({ orderBy: { name: "asc" } }),
    db.income.findMany({
      where: {
        date: { gte: weekStart, lte: weekEnd },
        jobId: { not: null },
      },
      include: { job: true },
      orderBy: { date: "asc" },
    }),
    db.income.findMany({
      where: { date: { gte: new Date(year, 0, 1) } },
    }),
    db.income.findMany({
      where: { jobId: null, date: { gte: new Date(year, 0, 1) } },
      orderBy: { date: "desc" },
    }),
  ]);

  const activeJobs = allJobs.filter((j) => j.active);
  const totalYtd = ytdIncome.reduce((a, b) => a + b.amountUsd, 0);

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
  }));

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
            Income
          </div>
          <h1 className="mt-1 font-display text-4xl tracking-tight">Time tracker</h1>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Total YTD
          </div>
          <div className="font-display text-2xl tabular-nums text-success">
            {fmtUsd(totalYtd)}
          </div>
        </div>
      </header>

      <Tabs defaultValue="hours">
        <TabsList>
          <TabsTrigger value="hours">Hours</TabsTrigger>
          <TabsTrigger value="projects">Projects / lump-sum</TabsTrigger>
        </TabsList>
        <TabsContent value="hours" className="space-y-6">
          <WeekView
            anchorIso={localISODate(anchor)}
            entries={weekEntries}
            jobs={activeJobs.map((j) => ({
              id: j.id,
              name: j.name,
              rateUsd: j.rateUsd,
              color: j.color,
            }))}
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
