import { db } from "@/lib/db";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { getNextInvoiceNumber } from "@/lib/invoice";
import { getSettings } from "@/lib/queries";
import { oblioConfigured } from "@/lib/oblio";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage(props: {
  searchParams: Promise<{ jobId?: string }>;
}) {
  const params = await props.searchParams;
  const [jobs, settings] = await Promise.all([
    db.job.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    getSettings(),
  ]);
  // Numarul e doar pentru previzualizare; cel definitiv se ia tot aici, la
  // salvare, ca doua taburi deschise sa nu iasa cu acelasi numar.
  const { number } = await getNextInvoiceNumber(settings.invoiceSeries);

  return (
    <div className="space-y-8">
      <header>
        <div className="text-xs uppercase tracking-[0.07em] text-muted-foreground">
          Invoices
        </div>
        <h1 className="mt-1.5 text-[30px] sm:text-[44px] leading-[1.02]">
          New invoice
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick a client, pull the month from the time tracker, and watch the
          invoice build itself as you type.
        </p>
      </header>

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
          invoiceDescription: j.invoiceDescription ?? "",
        }))}
        preselectJobId={params.jobId ?? null}
        series={settings.invoiceSeries}
        nextNumber={number}
        roVatRate={settings.vatRate}
        oblioReady={oblioConfigured()}
        issuer={{
          name: settings.issuerName,
          cif: settings.issuerCif,
          vatIntra: settings.issuerVatIntra,
          vatRegistered: settings.vatRegistered,
          reg: settings.issuerReg,
          address: settings.issuerAddress,
          iban: settings.issuerIban,
          ibanEur: settings.issuerIbanEur,
          swift: settings.issuerSwift,
          bank: settings.issuerBank,
          capital: settings.issuerCapital,
          signer: settings.issuerSigner,
        }}
      />
    </div>
  );
}
