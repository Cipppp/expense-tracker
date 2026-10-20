import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PDF-ul unui mesaj, pentru pagina ANAF. Deschiderea il marcheaza citit. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await db.spvMessage.findFirst({ where: { id }, select: { id: true, anafId: true, pdf: true, readAt: true } });
  if (!m?.pdf) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!m.readAt) await db.spvMessage.updateMany({ where: { id: m.id }, data: { readAt: new Date() } });
  return new NextResponse(Buffer.from(m.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="SPV-${m.anafId}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
