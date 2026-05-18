import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtDate, fmtUsd } from "@/lib/format";
import { IncomeForm } from "@/components/income/income-form";

export const dynamic = "force-dynamic";

export default async function IncomePage() {
  const year = new Date().getFullYear();
  const [income, jobs] = await Promise.all([
    db.income.findMany({
      where: { date: { gte: new Date(year, 0, 1) } },
      orderBy: { date: "desc" },
    }),
    db.job.findMany({ orderBy: { name: "asc" } }),
  ]);

  const total = income.reduce((a, b) => a + b.amountUsd, 0);

  return (
    <div className="space-y-8 max-w-5xl">
      <header className="flex items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
            Income
          </div>
          <h1 className="mt-1 font-display text-4xl tracking-tight">{year}</h1>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Total YTD
          </div>
          <div className="font-display text-2xl tabular-nums text-success">
            {fmtUsd(total)}
          </div>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Log income</CardTitle>
          <p className="text-sm text-muted-foreground">
            Hourly work or lump-sum project payments — both go here.
          </p>
        </CardHeader>
        <Separator />
        <CardContent className="pt-6">
          <IncomeForm jobs={jobs.map((j) => ({ name: j.name, rateUsd: j.rateUsd }))} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Entries</CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          {income.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-muted-foreground">
              No income entries yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">Date</TableHead>
                  <TableHead>Source / description</TableHead>
                  <TableHead className="text-right w-[100px]">Hours</TableHead>
                  <TableHead className="text-right w-[120px]">Rate</TableHead>
                  <TableHead className="text-right w-[140px]">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {income.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="text-muted-foreground text-xs num">
                      {fmtDate(i.date)}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{i.description}</div>
                      <div className="text-xs text-muted-foreground">{i.source}</div>
                    </TableCell>
                    <TableCell className="text-right num text-muted-foreground">
                      {i.hours ? i.hours.toFixed(1) + "h" : "—"}
                    </TableCell>
                    <TableCell className="text-right num text-muted-foreground">
                      {i.hourlyRate ? `$${i.hourlyRate.toFixed(0)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right num text-success font-medium">
                      {fmtUsd(i.amountUsd)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
