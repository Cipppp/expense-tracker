import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, getSessionRemember } from "@/lib/session";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";

export const runtime = "nodejs";

/*
 * Franare la ghicit.
 *
 * O parola unica, fara limita de incercari, e o parola care se sparge in
 * cateva ore de la o singura masina. Zece incercari gresite pe IP intr-un
 * sfert de ora, apoi cincisprezece minute de pauza. Memoria e per-proces:
 * nu tine peste redeploy si nu e o aparare in fata unui botnet, dar taie
 * exact cazul care conteaza aici — cineva care incearca dintr-un singur loc.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attempts = new Map<string, { count: number; first: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now - rec.first > WINDOW_MS) {
    attempts.set(ip, { count: 0, first: now });
    return false;
  }
  return rec.count >= MAX_ATTEMPTS;
}

function recordFailure(ip: string) {
  const rec = attempts.get(ip);
  if (rec) rec.count += 1;
  // Curatenie oportunista, ca harta sa nu creasca la nesfarsit.
  if (attempts.size > 500) {
    const now = Date.now();
    for (const [k, v] of attempts) if (now - v.first > WINDOW_MS) attempts.delete(k);
  }
}


const Body = z.object({
  /*
   * Emailul e optional pentru instalarile care veneau de pe parola unica: daca
   * exista un singur cont, il alegem pe el si utilizatorul nu trebuie sa-si
   * aminteasca ce email s-a scris la migrare.
   */
  email: z.string().trim().toLowerCase().optional(),
  password: z.string(),
  remember: z.boolean().optional(),
});

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Prea multe încercări. Încearcă din nou peste 15 minute." },
      { status: 429 },
    );
  }
  const body = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { email, password } = parsed.data;
  const user = email
    ? await db.user.findUnique({ where: { email } })
    : await pickSoleUser();

  /*
   * Acelasi raspuns si cand contul nu exista, si cand parola e gresita. Un
   * mesaj diferit ar spune cine are cont pe instanta asta.
   */
  const ok = user
    ? (await verifyPassword(password, user.passwordHash)) ||
      (await adoptEnvPassword(user, password))
    : false;
  if (!user || !ok) {
    recordFailure(ip);
    return NextResponse.json({ error: "Email sau parolă greșită" }, { status: 401 });
  }
  attempts.delete(ip);

  const session = parsed.data.remember
    ? await getSessionRemember()
    : await getSession();
  session.userId = user.id;
  session.isAuthed = true;
  session.loginAt = Date.now();
  await session.save();
  return NextResponse.json({ ok: true });
}

/**
 * Puntea de la parola din mediu la parola contului.
 *
 * Pana la conturi, parola statea in ACCESS_PASSWORD si era a instalarii, nu a
 * cuiva anume. Migrarea nu putea s-o mute: SQL-ul nu hashuieste, iar secretul
 * nu se poate citi inapoi din Vercel — variabilele sensibile se scriu, nu se
 * citesc. Singurul loc unde valoarea exista e aplicatia care ruleaza.
 *
 * Deci se muta singura, la prima autentificare reusita: daca tocmai contul a
 * ramas cu hash-ul gol si ce-ai tastat e chiar ACCESS_PASSWORD, parola devine
 * a contului. De-atunci `verifyPassword` raspunde primul si functia asta nu se
 * mai atinge — hash-ul nu mai e gol.
 *
 * Nu slabeste nimic: cat timp hash-ul e gol, singura parola care merge e
 * exact aia care mergea si inainte. Dupa prima intrare, ACCESS_PASSWORD nu mai
 * conteaza si poate fi sters din Vercel.
 */
async function adoptEnvPassword(
  user: { id: string; passwordHash: string },
  typed: string,
): Promise<boolean> {
  if (user.passwordHash !== "") return false;
  const fromEnv = process.env.ACCESS_PASSWORD ?? "";
  if (fromEnv.length < 8) return false;

  const a = Buffer.from(typed);
  const b = Buffer.from(fromEnv);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(typed) },
  });
  return true;
}

/** O instalare cu un singur cont nu trebuie sa ceara si emailul. */
async function pickSoleUser() {
  const users = await db.user.findMany({ take: 2 });
  return users.length === 1 ? users[0] : null;
}
