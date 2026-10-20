import { NextResponse } from "next/server";
import { db, findUserByApiToken } from "@/lib/db";
import { runAsUser } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 4 * 1024 * 1024; // sub limita de 4,5 MB a unei cereri pe Vercel

/*
 * PDF-ul unui mesaj SPV, descarcat de pe Mac (`descarcare?id=`). Corpul e
 * chiar PDF-ul; mesajul trebuie sa existe deja, trimis prin /sync.
 */
export async function PUT(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const userId = await findUserByApiToken(token);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const anafId = new URL(req.url).searchParams.get("anafId") ?? "";
  if (!/^\d{1,20}$/.test(anafId)) return NextResponse.json({ error: "anafId invalid" }, { status: 400 });

  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.length > MAX_BYTES) return NextResponse.json({ error: "PDF prea mare" }, { status: 413 });
  // ANAF intoarce JSON cu "eroare" cand nu poate da documentul; asta nu e un PDF.
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
    return NextResponse.json({ error: "Corpul nu e un PDF" }, { status: 400 });
  }

  return runAsUser(userId, async () => {
    const r = await db.spvMessage.updateMany({ where: { anafId }, data: { pdf: bytes } });
    if (r.count === 0) return NextResponse.json({ error: "Mesaj necunoscut" }, { status: 404 });
    return NextResponse.json({ ok: true });
  });
}
