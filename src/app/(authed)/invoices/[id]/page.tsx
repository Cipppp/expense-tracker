import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, FileText, FileSpreadsheet } from "@/lib/icons";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { fmtDate } from "@/lib/format";
import { InvoiceActions } from "@/components/invoices/invoice-actions";
import { InvoiceSend } from "@/components/invoices/invoice-send";
import { vatKindForInvoice } from "@/lib/vat";
import { pickIssuerIban } from "@/lib/invoice";

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

export default async function InvoicePage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const inv = await db.invoice.findUnique({
    where: { id },
    include: { lines: { orderBy: { position: "asc" } }, job: true },
  });
  if (!inv) notFound();

  const settings = await db.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  const total = inv.lines.reduce((a, l) => a + l.amount, 0);

  const isOverdue =
    inv.status === "issued" &&
    inv.dueAt !== null &&
    inv.dueAt < new Date();

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href="/invoices"
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          All invoices
        </Link>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.07em] text-muted-foreground flex items-center gap-2">
            <FileText className="h-3 w-3" />
            <span className="font-mono">
              {inv.series} {inv.number}
            </span>
            <Badge
              variant={STATUS_VARIANT[inv.status] ?? "outline"}
              className="text-[10px]"
            >
              {inv.status}
            </Badge>
          </div>
          <h1 className="mt-1.5 text-[28px] sm:text-[34px] leading-[1.05]">
            {inv.clientCompany}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Issued {fmtDate(inv.issuedAt)}
            {inv.dueAt ? ` · due ${fmtDate(inv.dueAt)}` : ""}
            {inv.paidAt ? ` · paid ${fmtDate(inv.paidAt)}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <a
              href={`/api/invoices/${inv.id}/pdf`}
              target="_blank"
              rel="noopener"
            >
              <Download className="h-3.5 w-3.5" />
              PDF
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href={`/api/invoices/${inv.id}/activity-report`}>
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Activity report
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href={`/api/invoices/${inv.id}/efactura`}>
              <FileText className="h-3.5 w-3.5" />
              e-Factura XML
            </a>
          </Button>
          <InvoiceSend
            invoiceId={inv.id}
            clientEmail={inv.job?.email ?? null}
            defaultSubject={`Invoice ${inv.series} ${inv.number} — ${settings.issuerName}`}
            defaultMessage={`Hi,\n\nPlease find attached invoice ${inv.series} ${inv.number} together with the activity report for the period.\n\nBest regards,\n${settings.issuerSigner}\n${settings.issuerName}`}
          />
          <InvoiceActions
            id={inv.id}
            status={inv.status}
            overdue={isOverdue}
            reminderContext={{
              series: inv.series,
              number: inv.number,
              clientCompany: inv.clientCompany,
              dueAt: inv.dueAt ? inv.dueAt.toISOString() : null,
              total,
              currency: inv.invoiceCurrency,
            }}
          />
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Issued to</CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
              Furnizor
            </div>
            <div className="font-medium">{settings.issuerName}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Reg. com.: {settings.issuerReg}
              <br />
              CIF: {settings.issuerCif}
              <br />
              {settings.issuerAddress}
              <br />
              IBAN:{" "}
              <span className="font-mono">
                {pickIssuerIban(settings, inv.clientCountry, inv.invoiceCurrency)}
              </span>
              <br />
              {settings.issuerSwift && (
                <>
                  SWIFT/BIC: {settings.issuerSwift}
                  <br />
                </>
              )}
              Banca: {settings.issuerBank}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
              Client
            </div>
            <div className="font-medium">{inv.clientCompany}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {inv.clientReg && <>Reg.com.: {inv.clientReg}<br /></>}
              {inv.clientCui && <>CIF: {inv.clientCui}<br /></>}
              {inv.clientAddress && <>{inv.clientAddress}<br /></>}
              {inv.clientCountry && (
                <>
                  {inv.clientCountry === "RO" ? "Romania" : inv.clientCountry}
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Lines</CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2 text-left w-10">#</th>
                <th className="px-4 py-2 text-left">Description</th>
                <th className="px-4 py-2 text-center w-16">U.M.</th>
                <th className="px-4 py-2 text-right w-20">Qty</th>
                <th className="px-4 py-2 text-right w-32">Unit price</th>
                <th className="px-4 py-2 text-right w-32">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {inv.lines.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-2 text-muted-foreground">{l.position}</td>
                  <td className="px-4 py-2">{l.description}</td>
                  <td className="px-4 py-2 text-center text-muted-foreground">
                    {l.unit}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {l.quantity}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {l.unitPrice.toLocaleString("ro-RO", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    <span className="text-[10px] text-muted-foreground">
                      {inv.invoiceCurrency}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium">
                    {l.amount.toLocaleString("ro-RO", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    <span className="text-[10px] text-muted-foreground">
                      {inv.invoiceCurrency}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-2">
          {(() => {
            const fmt = (n: number) =>
              n.toLocaleString("ro-RO", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              });
            const vatKind = vatKindForInvoice(
              inv.clientCountry,
              inv.vatRate,
              settings.vatRegistered,
            );
            const reverse = vatKind === "eu_reverse" || vatKind === "export";
            // Presentation currency mirrors the PDF: RO clients in RON,
            // everyone else in their contract currency.
            const present = inv.clientCountry === "RO" ? "RON" : inv.invoiceCurrency;
            const factor = present === inv.invoiceCurrency ? 1 : (inv.bnrRate ?? 1);
            const net = total * factor;
            const vat = net * inv.vatRate;
            const gross = net + vat;
            // The "other" currency equivalent of the gross.
            const showEq = !(present === "RON" && inv.invoiceCurrency === "RON");
            const eqCur = present === "RON" ? inv.invoiceCurrency : "RON";
            const eqAmt = present === "RON" ? gross / (inv.bnrRate ?? 1) : gross * (inv.bnrRate ?? 1);
            return (
              <>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">
                    Subtotal ({present})
                  </span>
                  <span className="font-display text-xl tabular-nums">
                    {fmt(net)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-muted-foreground">
                    VAT{" "}
                    {reverse
                      ? "(reverse charge)"
                      : `(${Math.round(inv.vatRate * 100)}%)`}
                  </span>
                  <span className="tabular-nums">
                    {reverse ? "—" : `${fmt(vat)} ${present}`}
                  </span>
                </div>
                <Separator />
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium">
                    Total to pay ({present})
                  </span>
                  <span className="font-display text-xl tabular-nums">
                    {fmt(gross)}
                  </span>
                </div>
                {showEq && inv.bnrRate ? (
                  <div className="flex items-baseline justify-between text-xs text-muted-foreground">
                    <span>≈ {eqCur} (BNR {inv.bnrRate.toFixed(4)})</span>
                    <span className="tabular-nums">{fmt(eqAmt)}</span>
                  </div>
                ) : null}
                {vatKind === "eu_reverse" ? (
                  <p className="text-[11px] text-muted-foreground pt-1">
                    Intra-community B2B — VAT reverse-charged to the recipient
                    (art. 196 Directive 2006/112/EC).
                  </p>
                ) : vatKind === "export" ? (
                  <p className="text-[11px] text-muted-foreground pt-1">
                    Export of services outside the EU — not taxable in Romania
                    (place of supply at the recipient, art. 278 Cod fiscal).
                  </p>
                ) : null}
              </>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
