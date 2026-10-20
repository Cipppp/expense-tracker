import { NextResponse } from "next/server";
import { z } from "zod";
import { db, findUserByApiToken } from "@/lib/db";
import { runAsUser } from "@/lib/tenant";
import { parseAnafDay } from "@/lib/spv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * Primeste lista din SPV (listaMesaje), asa cum o da ANAF, de la
 * `tools/anaf-spv-sync` de pe Mac-ul cu tokenul. Pastreaza ce e nou si
 * raspunde cu mesajele carora le lipseste PDF-ul, ca sincronizarea sa le
 * descarce doar pe alea. Acelasi Bearer ca /api/timelog.
 */
const Message = z.object({
  id: z.string().regex(/^\d{1,20}$/),
  cif: z.string().regex(/^\d{2,13}$/),
  tip: z.string().min(1).max(200),
  detalii: z.string().max(2000),
  data_creare: z.string(),
  id_solicitare: z.string().max(40).nullish(),
});
const Body = z.object({ mesaje: z.array(Message).max(1000) });

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const userId = await findUserByApiToken(token);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  return runAsUser(userId, async () => {
    const rows = parsed.data.mesaje.flatMap((m) => {
      const day = parseAnafDay(m.data_creare);
      return day
        ? [{
            userId,
            anafId: m.id,
            cif: m.cif,
            kind: m.tip,
            details: m.detalii,
            anafCreatedAt: day,
            requestId: m.id_solicitare ?? null,
          }]
        : [];
    });
    const created = await db.spvMessage.createMany({ data: rows, skipDuplicates: true });
    await db.settings.upsert({
      where: { userId },
      update: { spvSyncedAt: new Date() },
      create: { userId, spvSyncedAt: new Date() },
    });
    const missing = await db.spvMessage.findMany({
      where: { anafId: { in: rows.map((r) => r.anafId) }, pdf: null },
      select: { anafId: true },
    });
    return NextResponse.json({
      received: parsed.data.mesaje.length,
      created: created.count,
      needPdf: missing.map((m) => m.anafId),
    });
  });
}
