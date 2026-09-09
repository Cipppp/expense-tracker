import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

const Body = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(10, "Parola trebuie să aibă cel puțin 10 caractere"),
  name: z.string().trim().max(80).optional(),
});

/**
 * Crearea unui cont.
 *
 * Implicit se poate crea DOAR primul cont — cel al persoanei care instalează
 * aplicația. Instanța rulează la tine acasă sau pe Vercel-ul tău; dacă
 * oricine ar putea să-și facă cont, prima adresă găsită de un scanner ar
 * deveni un vecin în baza ta de date. Pentru mai mulți oameni pe aceeași
 * instanță se pune `ALLOW_SIGNUP=true`.
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Date invalide" },
      { status: 400 },
    );
  }

  const existing = await db.user.count();
  if (existing > 0 && process.env.ALLOW_SIGNUP !== "true") {
    return NextResponse.json(
      { error: "Înregistrările sunt închise pe instanța asta." },
      { status: 403 },
    );
  }

  const { email, password, name } = parsed.data;
  if (await db.user.findUnique({ where: { email } })) {
    return NextResponse.json({ error: "Există deja un cont cu emailul ăsta." }, { status: 409 });
  }

  const user = await db.user.create({
    data: { email, passwordHash: await hashPassword(password), name: name ?? "" },
  });

  /*
   * Setările se creează odată cu contul. Fără rândul ăsta, prima pagină pe
   * care intră omul face un `findUnique` care întoarce null și pică pe cursuri
   * inexistente — un cont nou n-ar trebui să înceapă cu o eroare.
   */
  await db.settings.create({ data: { userId: user.id } });

  const session = await getSession();
  session.userId = user.id;
  session.isAuthed = true;
  session.loginAt = Date.now();
  await session.save();

  return NextResponse.json({ ok: true });
}
