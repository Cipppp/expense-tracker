import { NextResponse } from "next/server";
import { renderActivityReport } from "@/lib/invoice-render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Download the black-and-white .xlsx activity report (Clockify-style timesheet)
 * for an invoice. Generation lives in lib/invoice-render so the email route
 * attaches the exact same file.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const result = await renderActivityReport(id);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(result.buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
    },
  });
}
