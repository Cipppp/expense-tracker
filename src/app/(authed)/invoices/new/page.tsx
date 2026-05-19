import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { InvoiceForm } from "@/components/invoices/invoice-form";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage(props: {
  searchParams: Promise<{ jobId?: string }>;
}) {
  const params = await props.searchParams;
  const jobs = await db.job.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
  return (
    <div className="space-y-8 max-w-4xl">
      <header>
        <div className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
          Invoices
        </div>
        <h1 className="mt-1 font-display text-4xl tracking-tight">New invoice</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Invoice details</CardTitle>
          <p className="text-sm text-muted-foreground">
            Pick a client to autofill the company block. Add one or more lines,
            then preview the PDF.
          </p>
        </CardHeader>
        <Separator />
        <CardContent className="pt-6">
          <InvoiceForm
            jobs={jobs.map((j) => ({
              id: j.id,
              name: j.name,
              rateUsd: j.rateUsd,
              companyName: j.companyName ?? "",
              companyCui: j.companyCui ?? "",
              companyReg: j.companyReg ?? "",
              companyAddress: j.companyAddress ?? "",
              companyCountry: j.companyCountry ?? "RO",
              defaultCurrency: j.defaultCurrency,
            }))}
            preselectJobId={params.jobId ?? null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
