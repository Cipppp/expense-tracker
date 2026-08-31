"use client";

import { vatKindForInvoice, type VatKind } from "@/lib/vat";
import { cn } from "@/lib/utils";

/*
 * Previzualizarea facturii, in HTML.
 *
 * Nu e PDF-ul: acela se randeaza pe server cu @react-pdf/renderer si ar cere
 * un drum dus-intors la fiecare tasta. E o oglinda a lui, construita din
 * aceleasi campuri si cu aceleasi reguli de TVA (`vatKindForInvoice`), ca sa
 * nu existe doua adevaruri despre ce scrie pe factura.
 *
 * Daca se schimba antetul din invoice-pdf.tsx, se schimba si aici.
 */

export type PreviewIssuer = {
  name: string;
  cif: string;
  vatIntra: string;
  vatRegistered: boolean;
  reg: string;
  address: string;
  iban: string;
  ibanEur: string;
  swift: string;
  bank: string;
  capital: string;
  signer: string;
};

export type PreviewInvoice = {
  series: string;
  number: string;
  issuedAt: string; // yyyy-mm-dd
  dueAt?: string | null;
  clientCompany: string;
  clientCui?: string | null;
  clientReg?: string | null;
  clientAddress?: string | null;
  clientCountry?: string | null;
  invoiceCurrency: string;
  bnrRate?: number | null;
  vatRate: number;
  footerNote?: string | null;
  lines: Array<{
    description: string;
    unit: string;
    quantity: number;
    unitPrice: number;
  }>;
};

const money = (n: number) =>
  n.toLocaleString("ro-RO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** yyyy-mm-dd -> dd/mm/yyyy, fara sa treaca prin Date (fara surprize de fus). */
function ddmmyyyy(iso: string) {
  const [y, m, d] = (iso ?? "").split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}
const dotted = (iso: string) => ddmmyyyy(iso).replace(/\//g, ".");

const VAT_LABEL: Record<VatKind, string> = {
  eu_reverse: "taxare inversa",
  export: "neimpozabil",
  exempt_310: "scutit art. 310",
  domestic: "",
  none: "",
};

const VAT_NOTE: Record<VatKind, string> = {
  eu_reverse:
    "Operatiune neimpozabila in Romania - taxare inversa (reverse charge). TVA se achita de beneficiar conform art. 196 din Directiva 2006/112/CE (servicii intracomunitare B2B).",
  exempt_310:
    "Neplatitor de TVA - scutit conform art. 310 din Legea nr. 227/2015 privind Codul fiscal (regim special de scutire pentru intreprinderile mici).",
  export:
    "Operatiune neimpozabila in Romania - export de servicii catre un beneficiar din afara UE (locul prestarii la beneficiar, art. 278 Cod fiscal). TVA conform legislatiei din tara beneficiarului.",
  domestic: "",
  none: "",
};

export function InvoicePreview({
  issuer,
  invoice,
  className,
}: {
  issuer: PreviewIssuer;
  invoice: PreviewInvoice;
  className?: string;
}) {
  const kind = vatKindForInvoice(
    invoice.clientCountry,
    invoice.vatRate,
    issuer.vatRegistered,
  );
  const foreign = invoice.invoiceCurrency !== "RON";
  const rate = invoice.bnrRate ?? 0;
  const rows = invoice.lines.filter(
    (l) => l.description.trim() || l.unitPrice > 0,
  );
  const net = rows.reduce((a, l) => a + l.quantity * l.unitPrice, 0);
  const vat = net * invoice.vatRate;
  const gross = net + vat;

  /*
   * Pe facturile catre UE merge codul art. 317, nu CIF-ul firmei. Sunt doua
   * numere diferite si ANAF il verifica pe cel din VIES.
   */
  const issuerFiscalId =
    kind === "eu_reverse" && issuer.vatIntra ? issuer.vatIntra : issuer.cif;
  const iban =
    invoice.invoiceCurrency === "EUR" && issuer.ibanEur
      ? issuer.ibanEur
      : issuer.iban;

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card text-card-foreground",
        "px-5 py-5 sm:px-7 sm:py-7 text-[11px] leading-[1.5]",
        className,
      )}
    >
      {/* Antet: furnizor | FACTURA | client */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-5 sm:gap-4">
        <div className="min-w-0">
          <div className="font-semibold">Furnizor: {issuer.name}</div>
          <Line>Reg. com.: {issuer.reg}</Line>
          <Line>CIF: {issuerFiscalId}</Line>
          <Line>Adresa: {issuer.address}</Line>
          <Line>IBAN: {iban}</Line>
          <Line>Banca: {issuer.bank}</Line>
          <Line>Capital social: {issuer.capital}</Line>
        </div>

        <div className="text-center sm:px-3">
          <div className="font-display text-base tracking-wide">FACTURA</div>
          <div className="mt-2 inline-block rounded-md border border-border px-3 py-2 text-left">
            <div className="tabular-nums">
              Seria {invoice.series} nr. {invoice.number}
            </div>
            <div className="tabular-nums">
              Data: {ddmmyyyy(invoice.issuedAt)}
            </div>
            {VAT_LABEL[kind] && <div>Cota TVA: {VAT_LABEL[kind]}</div>}
            {kind === "domestic" && (
              <div>Cota TVA: {Math.round(invoice.vatRate * 100)}%</div>
            )}
            {invoice.dueAt && (
              <div className="tabular-nums">
                Termen plata: {ddmmyyyy(invoice.dueAt)}
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 sm:text-right">
          <div className="font-semibold break-words">
            Client: {invoice.clientCompany || "—"}
          </div>
          {invoice.clientReg && <Line>Reg. com.: {invoice.clientReg}</Line>}
          {invoice.clientCui && <Line>CIF: {invoice.clientCui}</Line>}
          {invoice.clientAddress && <Line>Adresa: {invoice.clientAddress}</Line>}
          {invoice.clientCountry && <Line>Tara: {invoice.clientCountry}</Line>}
        </div>
      </div>

      {/* Liniile */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse">
          <thead>
            <tr className="border-y border-border text-[9.5px] uppercase tracking-[0.06em] text-muted-foreground">
              <th className="py-1.5 pr-2 text-left font-medium w-6">Nr.</th>
              <th className="py-1.5 pr-2 text-left font-medium">
                Denumirea serviciilor
              </th>
              <th className="py-1.5 px-2 text-left font-medium w-12">U.M.</th>
              <th className="py-1.5 px-2 text-right font-medium w-14">Cant.</th>
              <th className="py-1.5 px-2 text-right font-medium w-24">
                Pret unitar
              </th>
              <th className="py-1.5 pl-2 text-right font-medium w-24">Valoarea</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-8 text-center text-muted-foreground"
                >
                  Adaugă o linie ca să apară aici.
                </td>
              </tr>
            ) : (
              rows.map((l, i) => (
                <tr key={i} className="border-b border-border/60 align-top">
                  <td className="py-2 pr-2 tabular-nums text-muted-foreground">
                    {i + 1}
                  </td>
                  <td className="py-2 pr-2">
                    {l.description || (
                      <span className="text-muted-foreground">
                        (fără descriere)
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-2">{l.unit}</td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    {l.quantity}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    {money(l.unitPrice)}
                  </td>
                  <td className="py-2 pl-2 text-right tabular-nums font-medium">
                    {money(l.quantity * l.unitPrice)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Totaluri */}
      <div className="mt-4 flex justify-end">
        <div className="w-full sm:w-64 space-y-1">
          <Total label={`Total (${invoice.invoiceCurrency})`} value={money(net)} />
          {invoice.vatRate > 0 && (
            <>
              <Total
                label={`TVA ${Math.round(invoice.vatRate * 100)}%`}
                value={money(vat)}
                muted
              />
              <Total
                label={`Total plata (${invoice.invoiceCurrency})`}
                value={money(gross)}
                strong
              />
            </>
          )}
          {foreign && rate > 0 && (
            <Total
              label="Echivalent RON"
              value={money(gross * rate)}
              muted
            />
          )}
        </div>
      </div>

      {foreign && rate > 0 && (
        <p className="mt-4 text-[10px] text-muted-foreground">
          Echivalent {money(gross)} {invoice.invoiceCurrency} la cursul BNR din{" "}
          {dotted(invoice.issuedAt)}, 1 {invoice.invoiceCurrency} ={" "}
          {rate.toFixed(4)} RON.
        </p>
      )}

      {VAT_NOTE[kind] && (
        <p className="mt-3 rounded-md bg-secondary/50 px-3 py-2 text-[10px] text-muted-foreground">
          {VAT_NOTE[kind]}
        </p>
      )}

      {invoice.footerNote && (
        <p className="mt-2 rounded-md bg-secondary/50 px-3 py-2 text-[10px] text-muted-foreground">
          {invoice.footerNote}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-end justify-between gap-3 border-t border-border pt-3 text-[10px] text-muted-foreground">
        <span>Intocmit de: {issuer.signer}</span>
        <span>
          Factura este valabila fara semnatura si stampila, conform art. 319
          alin. 29 din legea 227/2015.
        </span>
      </div>
    </div>
  );
}

function Line({ children }: { children: React.ReactNode }) {
  return <div className="text-muted-foreground break-words">{children}</div>;
}

function Total({
  label,
  value,
  muted,
  strong,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className={cn("text-[10.5px]", muted && "text-muted-foreground")}>
        {label}
      </span>
      <span
        className={cn(
          "tabular-nums",
          strong ? "font-display text-sm font-semibold" : "text-[11.5px]",
          muted && "text-muted-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}
