import { NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import { db } from "@/lib/db";
import { renderInvoicePdf, renderActivityReport } from "@/lib/invoice-render";
import { buildEfacturaXml } from "@/lib/efactura";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  to: z.string().email().optional(), // override the client's stored email
  subject: z.string().optional(),
  message: z.string().optional(),
  includeActivityReport: z.boolean().optional().default(true),
  includeXml: z.boolean().optional().default(false),
});

const iso = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Email isn't configured. Add a RESEND_API_KEY env var (resend.com) and set a verified sender in Settings.",
      },
      { status: 503 },
    );
  }

  const { id } = await ctx.params;
  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const v = parsed.data;

  const invoice = await db.invoice.findUnique({
    where: { id },
    include: { lines: { orderBy: { position: "asc" } }, job: true },
  });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const settings = await db.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  const to = v.to ?? invoice.job?.email ?? null;
  if (!to) {
    return NextResponse.json(
      { error: "No recipient — add an email for this client in Settings → Clients." },
      { status: 422 },
    );
  }
  if (!settings.senderEmail) {
    return NextResponse.json(
      { error: "No sender — set a verified sender email in Settings." },
      { status: 422 },
    );
  }

  // Build the PDF (always) + the optional attachments.
  const pdf = await renderInvoicePdf(id);
  if ("error" in pdf) {
    return NextResponse.json({ error: pdf.error }, { status: pdf.status });
  }
  const attachments: Array<{ filename: string; content: string }> = [
    { filename: pdf.filename, content: pdf.buffer.toString("base64") },
  ];

  if (v.includeActivityReport) {
    const ar = await renderActivityReport(id);
    if (ar) attachments.push({ filename: ar.filename, content: ar.buffer.toString("base64") });
  }

  if (v.includeXml) {
    const xml = buildEfacturaXml({
      issuer: {
        name: settings.issuerName,
        cif: settings.issuerCif,
        reg: settings.issuerReg,
        address: settings.issuerAddress,
        iban: settings.issuerIban,
      },
      invoice: {
        series: invoice.series,
        number: invoice.number,
        issuedAtISO: iso(invoice.issuedAt),
        dueAtISO: invoice.dueAt ? iso(invoice.dueAt) : null,
        clientCompany: invoice.clientCompany,
        clientCui: invoice.clientCui,
        clientReg: invoice.clientReg,
        clientAddress: invoice.clientAddress,
        clientCountry: invoice.clientCountry,
        invoiceCurrency: invoice.invoiceCurrency,
        bnrRate: invoice.bnrRate,
        vatRate: invoice.vatRate,
        lines: invoice.lines.map((l) => ({
          description: l.description,
          unit: l.unit,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          amount: l.amount,
        })),
      },
    });
    attachments.push({
      filename: `eFactura_${invoice.series}${invoice.number}.xml`,
      content: Buffer.from(xml, "utf-8").toString("base64"),
    });
  }

  const subject =
    v.subject?.trim() ||
    `Invoice ${invoice.series} ${invoice.number} — ${settings.issuerName}`;
  const messageText =
    v.message?.trim() ||
    `Hi,\n\nPlease find attached invoice ${invoice.series} ${invoice.number} together with the activity report.\n\nBest regards,\n${settings.issuerSigner}\n${settings.issuerName}`;

  const resend = new Resend(apiKey);
  const from = settings.senderName
    ? `${settings.senderName} <${settings.senderEmail}>`
    : settings.senderEmail;

  const { data, error } = await resend.emails.send({
    from,
    to,
    subject,
    text: messageText,
    attachments,
  });

  if (error) {
    return NextResponse.json(
      { error: typeof error === "string" ? error : (error.message ?? "Send failed") },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    to,
    attachments: attachments.map((a) => a.filename),
    id: data?.id,
  });
}
