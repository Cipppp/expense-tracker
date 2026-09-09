import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getObject } from "@/lib/s3";
import { parseAnafZip } from "@/lib/anaf/archive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET ?file=zip|xml|sig — originalul sigilat de la ANAF pentru factura asta,
 * din S3 sau din copia inline. `xml` e factura (sau raportul de erori pe
 * nok), `sig` e semnatura MF.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const file = new URL(req.url).searchParams.get("file") ?? "zip";
  const inv = await db.invoice.findUnique({
    where: { id },
    include: { efacturaCurrent: true },
  });
  const sub = inv?.efacturaCurrent;
  if (!inv || !sub) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let zip: Buffer | null = null;
  if (sub.zipS3Key) zip = await getObject(sub.zipS3Key);
  if (!zip && sub.zipInline) zip = Buffer.from(sub.zipInline, "base64");
  if (!zip) return NextResponse.json({ error: "Not archived yet" }, { status: 404 });

  const stem = `eFactura_${inv.series}${inv.number}_${sub.indexIncarcare ?? sub.id}`;
  if (file === "zip") {
    return new NextResponse(new Uint8Array(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${stem}.zip"`,
      },
    });
  }
  const parsed = parseAnafZip(new Uint8Array(zip));
  const body = file === "sig" ? parsed.sigXml : parsed.docXml;
  const name = file === "sig" ? parsed.sigName : parsed.docName;
  if (!body) return NextResponse.json({ error: `No ${file} in archive` }, { status: 404 });
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${stem}_${(name ?? file).split("/").pop()}"`,
    },
  });
}
