import { runAsUser } from "../src/lib/tenant";
import { requireUserId } from "@/lib/queries";
/*
 * Emite o factura din orele nefacturate ale unui client, exact cum ar face
 * formularul "New invoice" (o linie pe luna, tariful din orele logate), si
 * randeaza PDF-ul + activity report-ul pe Desktop.
 *
 *   NODE_PATH=/tmp/efx/node_modules node --import tsx scripts/issue-invoice.ts \
 *     --job SPOTLITE --month 2026-08 --issued 2026-09-02 --bnr 5.2555 [--dry]
 *
 * NU trimite la Oblio / ANAF: asta se face din pagina facturii (butonul are
 * nevoie de credentialele de pe Vercel). `server-only` are nevoie de un stub
 * gol pe NODE_PATH cand ruleaza in afara Next.
 */
import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { db } from "../src/lib/db";
import { getNextInvoiceNumber, sumLines } from "../src/lib/invoice";
import { dateAtNoonUTC } from "../src/lib/format";
import { deriveVat } from "../src/lib/vat";
import { renderActivityReport, renderInvoicePdf } from "../src/lib/invoice-render";

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1 || !process.argv[i + 1]) {
    if (fallback !== undefined) return fallback;
    throw new Error(`--${name} is required`);
  }
  return process.argv[i + 1];
}
const DRY = process.argv.includes("--dry");

async function main() {
  const jobName = arg("job");
  const ym = arg("month"); // yyyy-mm
  const issuedISO = arg("issued");
  const bnr = Number(arg("bnr", "0")) || null;
  const dueDays = Number(arg("due-days", "5"));

  /*
   * Scriptul ruleaza in afara unei cereri, deci nu exista sesiune din care sa
   * iasa contul. Il ia pe primul — o instalare self-hosted are unul singur — si
   * intra explicit in contextul lui, ca filtrarea din stratul de date sa stie
   * pe cine sa filtreze.
   */
  const owner = await db.user.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
  const userId = owner.id;

  return runAsUser(userId, async () => {
  const job = await db.job.findFirstOrThrow({ where: { name: jobName } });
  const settings = await db.settings.findUniqueOrThrow({ where: { userId } });
  const [y, m] = ym.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1));
  const to = new Date(Date.UTC(y, m, 1));

  const rows = await db.income.findMany({
    where: { jobId: job.id, invoiceId: null, hours: { not: null }, date: { gte: from, lt: to } },
    orderBy: { date: "asc" },
  });
  if (!rows.length) throw new Error(`No unbilled hours for ${jobName} in ${ym}`);
  const hours = rows.reduce((a, r) => a + (r.hours ?? 0), 0);
  const amount = rows.reduce((a, r) => a + r.amountUsd, 0) / 100;
  // Tariful din orele DEJA logate, ca in formular — factura si raportul de
  // activitate aduna acelasi timp la acelasi tarif.
  const effective = hours > 0 ? Math.round((amount / hours) * 100) / 100 : job.rateUsd;

  const monthName = from.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
  const description = (job.invoiceDescription || "Consulting services")
    .replace(/\{month\}/g, monthName)
    .replace(/\{monthShort\}/g, monthName.slice(0, 3))
    .replace(/\{year\}/g, String(y))
    .replace(/\{lastDay\}/g, String(new Date(Date.UTC(y, m, 0)).getUTCDate()))
    .replace(/\{period\}/g, `${monthName} ${y}`);

  const currency = (job.defaultCurrency || "RON") as "RON" | "USD" | "EUR";
  if (currency !== "RON" && !bnr) throw new Error("--bnr is required for a non-RON invoice");
  const { vatRate } = deriveVat(job.companyCountry, settings.vatRate, settings.vatRegistered);
  const { number, seriesNumber } = await getNextInvoiceNumber(settings.invoiceSeries);
  const issuedAt = dateAtNoonUTC(issuedISO);
  const dueAt = new Date(issuedAt.getTime() + dueDays * 86_400_000);
  const lineAmount = Math.round(hours * effective * 100) / 100;

  console.log(
    JSON.stringify(
      {
        number: `${settings.invoiceSeries} ${number}`,
        client: job.companyName,
        cui: job.companyCui,
        country: job.companyCountry,
        issuedAt: issuedISO,
        dueAt: dueAt.toISOString().slice(0, 10),
        currency,
        bnr,
        vatRate,
        line: { description, unit: "h", quantity: hours, unitPrice: effective, amount: lineAmount },
        entries: rows.length,
      },
      null,
      2,
    ),
  );
  if (DRY) return;

  const invoice = await db.invoice.create({
    data: {
      userId,
      number,
      series: settings.invoiceSeries,
      seriesNumber,
      issuedAt,
      dueAt,
      jobId: job.id,
      clientName: job.name,
      clientCompany: job.companyName ?? job.name,
      clientCui: job.companyCui ?? null,
      clientReg: job.companyReg || null,
      clientAddress: job.companyAddress ?? null,
      clientCountry: job.companyCountry ?? null,
      clientCounty: (job.companyCountry ?? "RO") === "RO" ? job.companyCounty ?? null : null,
      invoiceCurrency: currency,
      legalCurrency: "RON",
      bnrRate: bnr,
      vatRate,
      footerNote: null,
      status: "draft",
      lines: { create: [{ position: 1, description, unit: "h", quantity: hours, unitPrice: effective, amount: lineAmount }] },
    },
    include: { lines: true },
  });
  await db.income.updateMany({
    where: { id: { in: rows.map((r) => r.id) }, invoiceId: null, jobId: job.id },
    data: { invoiceId: invoice.id },
  });
  console.log("created", invoice.id, `${invoice.series} ${invoice.number}`, "total", sumLines(invoice.lines), currency);

  const desktop = join(homedir(), "Desktop");
  const pdf = await renderInvoicePdf(invoice.id);
  if ("error" in pdf) throw new Error(pdf.error);
  writeFileSync(join(desktop, pdf.filename), pdf.buffer);
  console.log("pdf ->", join(desktop, pdf.filename));
  const ar = await renderActivityReport(invoice.id);
  if (ar) {
    writeFileSync(join(desktop, ar.filename), ar.buffer);
    console.log("activity report ->", join(desktop, ar.filename));
  }
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
