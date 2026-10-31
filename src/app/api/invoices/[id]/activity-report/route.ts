import { NextResponse } from "next/server";
import { renderActivityReport } from "@/lib/invoice-render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Download the activity report for an invoice: a PDF in the invoice's look
 * for invoices on the new template, the Clockify-style .xlsx for older ones.
 * `?format=xlsx` or `?format=pdf` asks for one explicitly. Generation lives in
 * lib/invoice-render so the email route attaches the exact same file.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const f = new URL(req.url).searchParams.get("format");
  const result = await renderActivityReport(id, f === "pdf" || f === "xlsx" ? { format: f } : {});
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(result.buffer), {
    status: 200,
    headers: {
      "Content-Type": result.contentType,
      "Content-Disposition": `attachment; filename="${result.filename}"`,
    },
  });
}
